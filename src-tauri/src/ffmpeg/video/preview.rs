use crate::ffmpeg::probe::probe_file;
use crate::utils::{log_error, log_info};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::{oneshot, Notify};

fn fast_hash_str(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn get_in_flight_previews() -> &'static Mutex<HashMap<String, Arc<Notify>>> {
    static IN_FLIGHT: OnceLock<Mutex<HashMap<String, Arc<Notify>>>> = OnceLock::new();
    IN_FLIGHT.get_or_init(|| Mutex::new(HashMap::new()))
}

struct SingleFlightGuard<'a> {
    file_path: &'a str,
}

impl<'a> Drop for SingleFlightGuard<'a> {
    fn drop(&mut self) {
        let notify_to_trigger = {
            let mut map = get_in_flight_previews().lock().unwrap();
            map.remove(self.file_path)
        };
        if let Some(notify) = notify_to_trigger {
            notify.notify_waiters();
        }
    }
}

fn get_cancelled_previews() -> &'static Mutex<HashSet<String>> {
    static CANCELLED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CANCELLED.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn is_preview_cancelled(file_path: &str) -> bool {
    if let Ok(map) = get_cancelled_previews().lock() {
        map.contains(file_path)
    } else {
        false
    }
}

pub fn mark_preview_cancelled(file_path: &str) {
    if let Ok(mut map) = get_cancelled_previews().lock() {
        map.insert(file_path.to_string());
    }
}

pub fn clear_preview_cancelled(file_path: &str) {
    if let Ok(mut map) = get_cancelled_previews().lock() {
        map.remove(file_path);
    }
}

static NEXT_SESSION_ID: AtomicU64 = AtomicU64::new(1);

fn next_session_id() -> u64 {
    NEXT_SESSION_ID.fetch_add(1, Ordering::SeqCst)
}

struct ActivePreviewSession {
    session_id: u64,
    _file_path: String,
    cancel_tx: Option<oneshot::Sender<()>>,
    child_pid: Option<u32>,
}

fn get_preview_sessions() -> &'static Mutex<HashMap<String, ActivePreviewSession>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, ActivePreviewSession>>> = OnceLock::new();
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn kill_process_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(crate::utils::CREATE_NO_WINDOW)
            .output();
    }
}

pub fn cancel_and_kill_session_for_file(file_path: &str) {
    mark_preview_cancelled(file_path);

    let session = {
        let mut map = get_preview_sessions().lock().unwrap();
        map.remove(file_path)
    };

    if let Some(mut sess) = session {
        log_info(&format!(
            "Terminating active preview session #{} process tree for '{}'",
            sess.session_id, file_path
        ));
        if let Some(tx) = sess.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(pid) = sess.child_pid {
            kill_process_tree(pid);
        }
    }
}

pub async fn cancel_preview_video(file_path: &str) {
    cancel_and_kill_session_for_file(file_path);
}

async fn run_preview_command(
    ffmpeg_path: &str,
    args: &[&str],
    file_path: &str,
    session_id: u64,
    temp_preview: &Path,
) -> Result<bool, String> {
    if is_preview_cancelled(file_path) {
        return Err("Preview generation cancelled".to_string());
    }

    let mut child = crate::utils::create_tokio_hidden_cmd(ffmpeg_path)
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    let child_id = child.id();
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    {
        let mut map = get_preview_sessions().lock().unwrap();
        map.insert(
            file_path.to_string(),
            ActivePreviewSession {
                session_id,
                _file_path: file_path.to_string(),
                cancel_tx: Some(cancel_tx),
                child_pid: child_id,
            },
        );
    }

    let res = tokio::select! {
        status = child.wait() => {
            Ok(status.map(|s| s.success()).unwrap_or(false))
        }
        _ = &mut cancel_rx => {
            log_info(&format!("Killing active preview session #{} process for '{}'", session_id, file_path));
            if let Some(pid) = child_id {
                kill_process_tree(pid);
            }
            let _ = child.kill().await;
            Err("Preview generation cancelled".to_string())
        }
    };

    // Remove session if this task is still the active session for file_path
    {
        let mut map = get_preview_sessions().lock().unwrap();
        if let Some(sess) = map.get(file_path) {
            if sess.session_id == session_id {
                map.remove(file_path);
            }
        }
    }

    match res {
        Ok(success) => {
            let ok = success && temp_preview.exists() && std::fs::metadata(temp_preview).map(|m| m.len() > 1024).unwrap_or(false);
            if !ok && temp_preview.exists() {
                let _ = std::fs::remove_file(temp_preview);
            }
            Ok(ok)
        }
        Err(e) => {
            if temp_preview.exists() {
                let _ = std::fs::remove_file(temp_preview);
            }
            Err(e)
        }
    }
}

/// Prepares a browser-compatible video for instant 60 FPS preview in Trimmer mode.
/// Tier 1: Returns original path if already .mp4/.webm with web-compatible codec.
/// Tier 2: Performs ultra-fast lossless container remux with stereo AAC audio map (-c:v copy -c:a aac -movflags +faststart) in <200ms.
/// Tier 3: Falls back to fast GPU proxy transcode for 10-bit / raw / ProRes codecs.
pub async fn prepare_preview_video(
    ffmpeg_path: &str,
    ffprobe_path: &str,
    file_path: &str,
) -> Result<String, String> {
    if !Path::new(file_path).exists() {
        return Err(format!("Input video file not found: '{}'", file_path));
    }

    cancel_and_kill_session_for_file(file_path);
    clear_preview_cancelled(file_path);
    let session_id = next_session_id();

    let input_path = Path::new(file_path);
    let ext = input_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let meta = probe_file(ffprobe_path, file_path).await?;
    let codec = meta.codec_name.to_lowercase();
    let audio_codec = meta.audio_codec.to_lowercase();

    // Tier 1: Check if already native web format
    let is_native_container = ext == "mp4" || ext == "webm" || ext == "m4v";
    let is_native_codec = codec == "h264" || codec == "vp8" || codec == "vp9" || codec == "av1";
    let is_native_audio = audio_codec.is_empty() || audio_codec == "aac" || audio_codec == "mp3" || audio_codec == "opus" || audio_codec == "flac";

    if is_native_container && is_native_codec && is_native_audio {
        log_info(&format!("Preview Tier 1 (Direct native stream): {}", file_path));
        return Ok(file_path.to_string());
    }

    // Cache key based on file path and size
    let file_size = std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);
    let path_hash = format!("{:016x}", fast_hash_str(&format!("{}_{}", file_path, file_size)));
    let temp_dir = crate::utils::get_temp_dir();
    let temp_preview = temp_dir.join(format!("preview_{}.mp4", path_hash));

    // Instant cache hit
    if temp_preview.exists() {
        if let Ok(metadata) = std::fs::metadata(&temp_preview) {
            if metadata.len() > 1024 {
                log_info(&format!("Preview Cache Hit: {:?}", temp_preview));
                crate::utils::register_active_preview(file_path, temp_preview.clone());
                return Ok(temp_preview.to_string_lossy().to_string());
            }
        }
    }

    // Single-Flight Guard: Deduplicate concurrent preview generation tasks for the same file
    let notify_waiter = {
        let mut map = get_in_flight_previews().lock().unwrap();
        if let Some(notify) = map.get(file_path) {
            Some(notify.clone())
        } else {
            map.insert(file_path.to_string(), Arc::new(Notify::new()));
            None
        }
    };

    if let Some(notify) = notify_waiter {
        log_info(&format!("Preview generation for '{}' is already in-flight. Awaiting existing task...", file_path));
        notify.notified().await;
        
        if temp_preview.exists() {
            crate::utils::register_active_preview(file_path, temp_preview.clone());
            return Ok(temp_preview.to_string_lossy().to_string());
        } else {
            return Err("Preview generation failed in parallel task".to_string());
        }
    }

    // Register active single-flight guard for the primary task
    let _guard = SingleFlightGuard { file_path };

    if is_preview_cancelled(file_path) {
        return Err("Preview generation cancelled".to_string());
    }

    // Tier 2a: Instant double stream copy (video copy + audio copy)
    // Only attempt if audio codec is native to web browsers (AAC, MP3, Opus, FLAC).
    // Non-web audio (DTS, AC3, TrueHD) inside MP4 will fail browser playback (silent audio).
    if is_native_audio {
        log_info(&format!("Preview Tier 2a (Instant stream copy): {} -> {:?}", file_path, temp_preview));
        let temp_str = temp_preview.to_str().unwrap_or("preview.mp4");

        let direct_copy_res = run_preview_command(
            ffmpeg_path,
            &[
                "-hide_banner",
                "-y",
                "-i",
                file_path,
                "-c:v",
                "copy",
                "-c:a",
                "copy",
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-movflags",
                "+faststart",
                temp_str,
            ],
            file_path,
            session_id,
            &temp_preview,
        ).await;

        match direct_copy_res {
            Ok(true) => {
                log_info(&format!("Preview Tier 2a Remux Successful: {:?}", temp_preview));
                crate::utils::register_active_preview(file_path, temp_preview.clone());
                return Ok(temp_preview.to_string_lossy().to_string());
            }
            Err(e) if e.contains("cancelled") => {
                return Err(e);
            }
            _ => {} // Fall through to Tier 2b
        }
    } else {
        log_info(&format!(
            "Preview skipping Tier 2a due to non-web audio codec '{}'. Defaulting to Tier 2b AAC transcode.",
            audio_codec
        ));
    }

    if is_preview_cancelled(file_path) {
        return Err("Preview generation cancelled".to_string());
    }

    log_info(&format!("Preview Tier 2b (Video copy + AAC audio remux): {} -> {:?}", file_path, temp_preview));
    let temp_str = temp_preview.to_str().unwrap_or("preview.mp4");

    // Tier 2b: Stream copy video with safe audio mapping to stereo AAC
    let copy_res = run_preview_command(
        ffmpeg_path,
        &[
            "-hide_banner",
            "-y",
            "-i",
            file_path,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-b:a",
            "128k",
            "-threads",
            "0",
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-movflags",
            "+faststart",
            temp_str,
        ],
        file_path,
        session_id,
        &temp_preview,
    ).await;

    match copy_res {
        Ok(true) => {
            log_info(&format!("Preview Tier 2b Remux Successful: {:?}", temp_preview));
            crate::utils::register_active_preview(file_path, temp_preview.clone());
            return Ok(temp_preview.to_string_lossy().to_string());
        }
        Err(e) if e.contains("cancelled") => {
            return Err(e);
        }
        _ => {} // Fall through to Tier 3
    }

    if is_preview_cancelled(file_path) {
        return Err("Preview generation cancelled".to_string());
    }

    // Tier 3: GPU Hardware proxy transcode (for 10-bit / raw / ProRes / uncopyable streams)
    log_info(&format!("Preview Tier 3 (GPU Proxy Transcode): {}", file_path));
    let temp_str = temp_preview.to_str().unwrap_or("preview.mp4");

    let proxy_res = run_preview_command(
        ffmpeg_path,
        &[
            "-hide_banner",
            "-y",
            "-hwaccel",
            "auto",
            "-i",
            file_path,
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-tune",
            "fastdecode",
            "-vf",
            "scale=min(1280\\,iw):-2,format=yuv420p",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-movflags",
            "+faststart",
            temp_str,
        ],
        file_path,
        session_id,
        &temp_preview,
    ).await;

    match proxy_res {
        Ok(true) => {
            log_info(&format!("Preview Tier 3 Proxy Successful: {:?}", temp_preview));
            crate::utils::register_active_preview(file_path, temp_preview.clone());
            Ok(temp_preview.to_string_lossy().to_string())
        }
        Err(e) => {
            log_error(&format!("Preview generation failed or cancelled: {}", e));
            Ok(file_path.to_string())
        }
        Ok(false) => {
            log_error("Preview generation process failed");
            Ok(file_path.to_string())
        }
    }
}

pub fn unregister_preview_video(file_path: &str) {
    cancel_and_kill_session_for_file(file_path);
    crate::utils::unregister_active_preview(file_path);
}
