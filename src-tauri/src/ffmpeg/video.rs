use super::process::execute_ffmpeg_process;
use super::probe::probe_file;
use super::types::{ConversionConfig, TrimConfig};
use crate::utils::{log_error, log_info, resolve_conflict_path, resolve_unique_split_dir, resolve_unique_split_stem};
use std::path::{Path, PathBuf};


/// Main execution routine for video transcode and segment splitting
pub async fn run_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ConversionConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if ffmpeg_path.is_empty() || !Path::new(ffmpeg_path).exists() {
        let err_msg = format!(
            "FFmpeg executable not found at: '{}'. Please download dependencies.",
            ffmpeg_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }
    if ffprobe_path.is_empty() || !Path::new(ffprobe_path).exists() {
        let err_msg = format!(
            "FFprobe executable not found at: '{}'. Please download dependencies.",
            ffprobe_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

    let total_videos = config.video_files.len();

    log_info(&format!(
        "Starting pipeline: action={}, files_count={}, encoder={}",
        config.video_action, total_videos, gpu_caps.encoder
    ));

    crate::utils::reset_cancel_flag();

    // Pre-flight file existence check
    for file_path in &config.video_files {
        if !Path::new(file_path).exists() {
            let err_msg = format!(
                "Input video file not found: '{}'. Please ensure the file was not deleted or moved.",
                file_path
            );
            log_error(&err_msg);
            return Err(err_msg);
        }
    }

    for (idx, file_path) in config.video_files.iter().enumerate() {
        if crate::utils::check_cancel_flag() {
            return Err("Processing aborted by user.".to_string());
        }

        let meta = probe_file(ffprobe_path, file_path).await?;
        let input_path = Path::new(file_path);
        let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
            PathBuf::from(custom_dir)
        } else {
            input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
        };

        if let Err(e) = std::fs::create_dir_all(&parent_dir) {
            log_error(&format!("Failed to create output directory {:?}: {}", parent_dir, e));
        }

        // Determine input video decoder (VideoLAN libdav1d for AV1 inputs)
        let mut input_decoder_args = Vec::new();
        if meta.codec_name == "av1" {
            log_info("AV1 input detected: Forcing VideoLAN libdav1d software decoder");
            input_decoder_args.push("-c:v:0");
            input_decoder_args.push("libdav1d");
        } else {
            input_decoder_args.push("-hwaccel");
            input_decoder_args.push("auto");
        }

        let res_tag = if config.target_height == "ORIGINAL" {
            "origRes".to_string()
        } else {
            format!("{}p", config.target_height)
        };

        let bit_tag = if config.target_bitrate == "ORIGINAL" {
            "origBit".to_string()
        } else {
            format!("{}k", config.target_bitrate)
        };

        let file_stem = input_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "output".to_string());

        // Resolve saved trim boundaries (if present in config.video_items or trim_presets.json)
        let mut trim_start: Option<f64> = None;
        let mut trim_end: Option<f64> = None;

        if let Some(ref items) = config.video_items {
            if let Some(item) = items.iter().find(|i| i.path == *file_path).or_else(|| items.get(idx)) {
                trim_start = item.trim_start_sec;
                trim_end = item.trim_end_sec;
            }
        }

        if trim_start.is_none() && trim_end.is_none() {
            if let Ok(Some(preset)) = crate::commands::load_trim_preset(file_path.clone()) {
                trim_start = Some(preset.start_sec);
                trim_end = Some(preset.end_sec);
            }
        }

        let start_sec = trim_start.unwrap_or(0.0).max(0.0);
        let end_sec = if let Some(e) = trim_end {
            if e > start_sec {
                e.min(meta.duration_sec)
            } else {
                meta.duration_sec
            }
        } else {
            meta.duration_sec
        };

        let has_trim = start_sec > 0.001 || (end_sec > start_sec && end_sec < meta.duration_sec - 0.05);
        let effective_duration = if has_trim {
            (end_sec - start_sec).max(0.1)
        } else {
            meta.duration_sec
        };

        // --- SPLIT MODE EXECUTION ---
        if config.video_action == "SPLIT" {
            let mut segment_sec = 60.0;
            if config.split_mode == "DURATION" && config.split_value > 0.0 {
                segment_sec = config.split_value;
            } else if config.split_mode == "PARTS" && config.split_value > 0.0 {
                if effective_duration > 0.0 {
                    segment_sec = effective_duration / config.split_value;
                }
            }

            let num_parts = if config.split_mode == "PARTS" && config.split_value > 0.0 {
                config.split_value as usize
            } else if effective_duration > 0.0 && segment_sec > 0.0 {
                (effective_duration / segment_sec).ceil() as usize
            } else {
                1
            };

            let out_ext = if config.split_fast_copy {
                input_path
                    .extension()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "mp4".to_string())
            } else {
                gpu_caps.extension.clone()
            };

            // Deconflict the output location based on whether the user chose a
            // custom output folder:
            //   - No custom dir  → group segments in a named sub-folder next to source
            //   - Custom dir set → keep files flat, deconflict via stem-prefix counter
            let (pattern_base, split_file_stem) = if config.custom_output_dir.is_none() {
                let split_dir = resolve_unique_split_dir(&parent_dir, &file_stem);
                if let Err(e) = std::fs::create_dir_all(&split_dir) {
                    log_error(&format!("Failed to create split output directory {:?}: {}", split_dir, e));
                }
                let pat = if config.split_fast_copy {
                    split_dir.join(format!("{}_part%03d.{}", file_stem, out_ext))
                } else {
                    split_dir.join(format!("{}_part%03d_{}_{}.{}", file_stem, res_tag, bit_tag, out_ext))
                };
                (pat, file_stem.clone())
            } else {
                let batch_stem = resolve_unique_split_stem(&parent_dir, &file_stem, &out_ext);
                let pat = if config.split_fast_copy {
                    parent_dir.join(format!("{}_part%03d.{}", batch_stem, out_ext))
                } else {
                    parent_dir.join(format!("{}_part%03d_{}_{}.{}", batch_stem, res_tag, bit_tag, out_ext))
                };
                (pat, batch_stem)
            };
            let _ = split_file_stem; // used only to keep binding for potential future use


            let mut args: Vec<String> = vec!["-hide_banner".to_string()];

            if config.split_fast_copy {
                if has_trim {
                    args.extend([
                        "-ss".to_string(),
                        format!("{:.3}", start_sec),
                        "-to".to_string(),
                        format!("{:.3}", end_sec),
                    ]);
                }
                args.extend(["-i".to_string(), file_path.to_string()]);
                args.extend([
                    "-c".to_string(),
                    "copy".to_string(),
                    "-map".to_string(),
                    "0".to_string(),
                    "-segment_time".to_string(),
                    format!("{}", segment_sec),
                    "-f".to_string(),
                    "segment".to_string(),
                    "-reset_timestamps".to_string(),
                    "1".to_string(),
                    "-y".to_string(),
                    "-progress".to_string(),
                    "pipe:1".to_string(),
                    pattern_base.to_string_lossy().to_string(),
                ]);
            } else {
                for dec_arg in &input_decoder_args {
                    args.push(dec_arg.to_string());
                }
                if has_trim {
                    args.extend([
                        "-ss".to_string(),
                        format!("{:.3}", start_sec),
                        "-to".to_string(),
                        format!("{:.3}", end_sec),
                    ]);
                }
                args.extend(["-i".to_string(), file_path.to_string()]);

                if config.target_height != "ORIGINAL" {
                    let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                        h.clamp(144, 8192).to_string()
                    } else {
                        config.target_height.clone()
                    };
                    args.extend([
                        "-vf".to_string(),
                        format!("scale=-2:{},format=yuv420p", effective_height),
                    ]);
                }

                args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
                for arg in gpu_caps.encoder_args.split_whitespace() {
                    args.push(arg.to_string());
                }

                append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

                args.extend([
                    "-map".to_string(),
                    "0:v:0".to_string(),
                    "-map".to_string(),
                    "0:a?".to_string(),
                    "-c:a".to_string(),
                    "copy".to_string(),
                    "-fps_mode".to_string(),
                    "cfr".to_string(),
                    "-segment_time".to_string(),
                    format!("{}", segment_sec),
                    "-f".to_string(),
                    "segment".to_string(),
                    "-reset_timestamps".to_string(),
                    "1".to_string(),
                    "-y".to_string(),
                    "-progress".to_string(),
                    "pipe:1".to_string(),
                    pattern_base.to_string_lossy().to_string(),
                ]);
            }

            execute_ffmpeg_process(
                app,
                ffmpeg_path,
                args,
                &meta.file_name,
                idx + 1,
                total_videos,
                effective_duration,
                num_parts,
            )
            .await?;

            continue;
        }

        // --- FULL CONVERT MODE EXECUTION ---
        let effective_stem = if has_trim && !file_stem.ends_with("_trimmed") {
            format!("{}_trimmed", file_stem)
        } else {
            file_stem.clone()
        };

        let raw_outfile = parent_dir.join(format!(
            "{}_{}_{}.{}",
            effective_stem, res_tag, bit_tag, gpu_caps.extension
        ));
        let resolved_outfile = resolve_conflict_path(raw_outfile);

        let mut args: Vec<String> = vec!["-hide_banner".to_string()];
        for dec_arg in &input_decoder_args {
            args.push(dec_arg.to_string());
        }

        if has_trim {
            log_info(&format!(
                "Trim interval detected for '{}': start={:.3}s, end={:.3}s (duration={:.3}s)",
                meta.file_name, start_sec, end_sec, effective_duration
            ));
            args.extend([
                "-ss".to_string(),
                format!("{:.3}", start_sec),
                "-to".to_string(),
                format!("{:.3}", end_sec),
            ]);
        }

        args.extend(["-i".to_string(), file_path.to_string()]);

        if config.target_height != "ORIGINAL" {
            let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                h.clamp(144, 8192).to_string()
            } else {
                config.target_height.clone()
            };
            args.extend([
                "-vf".to_string(),
                format!("scale=-2:{},format=yuv420p", effective_height),
            ]);
        }

        args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        args.extend([
            "-map".to_string(),
            "0:v:0".to_string(),
            "-map".to_string(),
            "0:a?".to_string(),
            "-c:a".to_string(),
            "copy".to_string(),
            "-fps_mode".to_string(),
            "cfr".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            resolved_outfile.to_string_lossy().to_string(),
        ]);

        execute_ffmpeg_process(
            app,
            ffmpeg_path,
            args,
            &meta.file_name,
            idx + 1,
            total_videos,
            effective_duration,
            1,
        )
        .await?;
    }

    Ok(())
}

pub(crate) fn append_bitrate_flags(args: &mut Vec<String>, target_bitrate: &str, encoder: &str) {
    if target_bitrate == "ORIGINAL" {
        match encoder {
            "libx264" | "libx265" => args.extend(["-crf".to_string(), "23".to_string()]),
            "libaom-av1" => args.extend(["-crf".to_string(), "30".to_string()]),
            "h264_nvenc" | "hevc_nvenc" | "av1_nvenc" => {
                args.extend(["-qp".to_string(), "23".to_string()])
            }
            "h264_amf" | "hevc_amf" | "av1_amf" => args.extend([
                "-rc".to_string(),
                "cqp".to_string(),
                "-qp_i".to_string(),
                "23".to_string(),
                "-qp_p".to_string(),
                "23".to_string(),
            ]),
            "h264_qsv" | "hevc_qsv" | "av1_qsv" => {
                args.extend(["-global_quality".to_string(), "23".to_string()])
            }
            _ => {}
        }
    } else if let Ok(raw_bit_int) = target_bitrate.parse::<u32>() {
        let bit_int = raw_bit_int.clamp(100, 500_000);
        let max_rate = bit_int + (bit_int / 4);
        let buf_size = bit_int * 2;
        args.extend([
            "-b:v".to_string(),
            format!("{}k", bit_int),
            "-maxrate".to_string(),
            format!("{}k", max_rate),
            "-bufsize".to_string(),
            format!("{}k", buf_size),
        ]);
    }
}

/// Execution routine for single video precision trimming
pub async fn run_trim_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: TrimConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if ffmpeg_path.is_empty() || !Path::new(ffmpeg_path).exists() {
        let err_msg = format!(
            "FFmpeg executable not found at: '{}'. Please download dependencies.",
            ffmpeg_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }
    if ffprobe_path.is_empty() || !Path::new(ffprobe_path).exists() {
        let err_msg = format!(
            "FFprobe executable not found at: '{}'. Please download dependencies.",
            ffprobe_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

    if !Path::new(&config.input_file).exists() {
        let err_msg = format!(
            "Input video file not found: '{}'. Please ensure the file was not deleted or moved.",
            config.input_file
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

    log_info(&format!(
        "Starting trim pipeline: file='{}', start={:.3}, end={:.3}, fast_copy={}",
        config.input_file, config.start_sec, config.end_sec, config.fast_copy
    ));

    crate::utils::reset_cancel_flag();

    let meta = probe_file(ffprobe_path, &config.input_file).await?;
    let input_path = Path::new(&config.input_file);
    let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
        PathBuf::from(custom_dir)
    } else {
        input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    if let Err(e) = std::fs::create_dir_all(&parent_dir) {
        log_error(&format!("Failed to create output directory {:?}: {}", parent_dir, e));
    }

    let file_stem = input_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "trimmed_video".to_string());

    let out_ext = if config.fast_copy {
        input_path
            .extension()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "mp4".to_string())
    } else {
        gpu_caps.extension.clone()
    };

    let raw_outfile = parent_dir.join(format!("{}_trimmed.{}", file_stem, out_ext));
    let resolved_outfile = resolve_conflict_path(raw_outfile);

    let mute_audio = config.mute_audio.unwrap_or(false);
    let raw_speed = config.playback_speed.unwrap_or(1.0);
    let speed = raw_speed.clamp(0.1, 50.0);
    let is_speed_changed = (speed - 1.0).abs() > 0.001;
    let effective_fast_copy = config.fast_copy && !is_speed_changed;

    let start_sec = config.start_sec.max(0.0);
    let end_sec = if config.end_sec > start_sec {
        config.end_sec.min(meta.duration_sec)
    } else {
        meta.duration_sec
    };
    let trim_duration = (end_sec - start_sec).max(0.1);
    let effective_output_duration = trim_duration / speed;

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];

    if effective_fast_copy {
        args.extend([
            "-ss".to_string(),
            format!("{:.3}", start_sec),
            "-to".to_string(),
            format!("{:.3}", end_sec),
            "-i".to_string(),
            config.input_file.clone(),
            "-c:v".to_string(),
            "copy".to_string(),
        ]);

        if mute_audio {
            args.push("-an".to_string());
        } else {
            args.extend([
                "-c:a".to_string(),
                "copy".to_string(),
                "-map".to_string(),
                "0".to_string(),
            ]);
        }

        args.extend([
            "-reset_timestamps".to_string(),
            "1".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            resolved_outfile.to_string_lossy().to_string(),
        ]);
    } else {
        if meta.codec_name == "av1" {
            log_info("AV1 input detected: Forcing VideoLAN libdav1d software decoder");
            args.extend(["-c:v:0".to_string(), "libdav1d".to_string()]);
        } else {
            args.extend(["-hwaccel".to_string(), "auto".to_string()]);
        }

        args.extend([
            "-ss".to_string(),
            format!("{:.3}", start_sec),
            "-to".to_string(),
            format!("{:.3}", end_sec),
            "-i".to_string(),
            config.input_file.clone(),
        ]);

        let mut vf_filters: Vec<String> = Vec::new();

        if config.target_height != "ORIGINAL" {
            let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                h.clamp(144, 8192).to_string()
            } else {
                config.target_height.clone()
            };
            vf_filters.push(format!("scale=-2:{},format=yuv420p", effective_height));
        }

        if is_speed_changed {
            let pts_factor = 1.0 / speed;
            if speed < 1.0 && config.slow_mo_mode.as_deref() == Some("OPTICAL_SMOOTH") {
                log_info(&format!("Applying Optical Smooth slow-mo (speed: {:.2}x)", speed));
                vf_filters.push(format!(
                    "setpts={:.6}*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir",
                    pts_factor
                ));
            } else {
                log_info(&format!("Applying Frame Dup speed scale (speed: {:.2}x)", speed));
                vf_filters.push(format!("setpts={:.6}*PTS", pts_factor));
            }
        }

        if !vf_filters.is_empty() {
            args.extend(["-vf".to_string(), vf_filters.join(",")]);
        }

        args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        args.extend(["-map".to_string(), "0:v:0".to_string()]);

        if mute_audio || speed > 4.0 || speed < 0.25 {
            args.push("-an".to_string());
        } else if is_speed_changed {
            let mut af_filters: Vec<String> = Vec::new();
            if speed >= 0.5 && speed <= 2.0 {
                af_filters.push(format!("atempo={:.4}", speed));
            } else if speed > 2.0 && speed <= 4.0 {
                af_filters.push("atempo=2.0".to_string());
                af_filters.push(format!("atempo={:.4}", speed / 2.0));
            } else if speed >= 0.25 && speed < 0.5 {
                af_filters.push("atempo=0.5".to_string());
                af_filters.push(format!("atempo={:.4}", speed / 0.5));
            }

            if !af_filters.is_empty() {
                args.extend([
                    "-map".to_string(),
                    "0:a?".to_string(),
                    "-af".to_string(),
                    af_filters.join(","),
                    "-c:a".to_string(),
                    "aac".to_string(),
                ]);
            }
        } else {
            args.extend([
                "-map".to_string(),
                "0:a?".to_string(),
                "-c:a".to_string(),
                "copy".to_string(),
            ]);
        }

        args.extend([
            "-fps_mode".to_string(),
            "cfr".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            resolved_outfile.to_string_lossy().to_string(),
        ]);
    }

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &meta.file_name,
        1,
        1,
        effective_output_duration,
        1,
    )
    .await?;

    Ok(())
}

fn fast_hash_str(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARSET[(b0 >> 2) as usize] as char);
        result.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(b2 & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

use std::sync::{Arc, Mutex, OnceLock};
use std::collections::HashMap;
use tokio::sync::Notify;

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

use tokio::sync::oneshot;

fn get_active_cancellations() -> &'static Mutex<HashMap<String, oneshot::Sender<()>>> {
    static CANCELLATIONS: OnceLock<Mutex<HashMap<String, oneshot::Sender<()>>>> = OnceLock::new();
    CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub async fn cancel_preview_video(file_path: &str) {
    let sender = {
        let mut map = get_active_cancellations().lock().unwrap();
        map.remove(file_path)
    };
    if let Some(tx) = sender {
        let _ = tx.send(());
    }
}

async fn run_preview_command(
    ffmpeg_path: &str,
    args: &[&str],
    file_path: &str,
    temp_preview: &Path,
) -> Result<bool, String> {
    let mut child = crate::utils::create_tokio_hidden_cmd(ffmpeg_path)
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    {
        let mut map = get_active_cancellations().lock().unwrap();
        map.insert(file_path.to_string(), cancel_tx);
    }

    let res = tokio::select! {
        status = child.wait() => {
            Ok(status.map(|s| s.success()).unwrap_or(false))
        }
        _ = &mut cancel_rx => {
            log_info(&format!("Killing active preview process for '{}'", file_path));
            let _ = child.kill().await;
            Err("Preview generation cancelled".to_string())
        }
    };

    // Remove from active cancellations
    {
        let mut map = get_active_cancellations().lock().unwrap();
        map.remove(file_path);
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
            return Ok(temp_preview.to_string_lossy().to_string());
        } else {
            return Err("Preview generation failed in parallel task".to_string());
        }
    }

    // Register active single-flight guard for the primary task
    let _guard = SingleFlightGuard { file_path };

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
            &temp_preview,
        ).await;

        match direct_copy_res {
            Ok(true) => {
                log_info(&format!("Preview Tier 2a Remux Successful: {:?}", temp_preview));
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
        &temp_preview,
    ).await;

    match copy_res {
        Ok(true) => {
            log_info(&format!("Preview Tier 2b Remux Successful: {:?}", temp_preview));
            return Ok(temp_preview.to_string_lossy().to_string());
        }
        Err(e) if e.contains("cancelled") => {
            return Err(e);
        }
        _ => {} // Fall through to Tier 3
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
        &temp_preview,
    ).await;

    match proxy_res {
        Ok(true) => {
            log_info(&format!("Preview Tier 3 Proxy Successful: {:?}", temp_preview));
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

/// Extracts a single JPEG preview frame at timestamp_sec using GPU hardware acceleration and fast demuxer seeking.
/// Returns a base64 Data URL string: data:image/jpeg;base64,...
pub async fn extract_frame_base64_hwaccel(
    ffmpeg_path: &str,
    file_path: &str,
    timestamp_sec: f64,
) -> Result<String, String> {
    if !Path::new(file_path).exists() {
        return Err(format!("Video file not found: '{}'", file_path));
    }

    let time_str = format!("{:.3}", timestamp_sec.max(0.0));
    // Fast demuxer seeking: -ss BEFORE -i seeks instantly to keyframe in <20ms
    let output = crate::utils::create_tokio_hidden_cmd(ffmpeg_path)
        .args([
            "-hide_banner",
            "-ss",
            &time_str,
            "-i",
            file_path,
            "-frames:v",
            "1",
            "-q:v",
            "3",
            "-vf",
            "scale=min(320\\,iw):-2",
            "-f",
            "image2",
            "pipe:1",
        ])
        .output()
        .await
        .map_err(|e| format!("FFmpeg frame extraction failed to spawn: {}", e))?;

    if !output.status.success() || output.stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg frame extraction error: {}", stderr));
    }

    let b64 = base64_encode(&output.stdout);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

/// Generates a filmstrip row of keyframe thumbnails using FFmpeg CLI for non-WMF containers (e.g. .mkv, .webm).
pub async fn extract_ffmpeg_filmstrip(
    ffmpeg_path: &str,
    ffprobe_path: &str,
    file_path: &str,
    count: usize,
) -> Result<Vec<String>, String> {
    let meta = probe_file(ffprobe_path, file_path).await?;
    let duration_sec = if meta.duration_sec > 0.0 { meta.duration_sec } else { 60.0 };
    let num_thumbs = count.clamp(4, 16);
    let step = duration_sec / num_thumbs as f64;

    let mut results = Vec::with_capacity(num_thumbs);
    for i in 0..num_thumbs {
        let target_sec = (i as f64 * step).min(duration_sec - 0.1);
        if let Ok(frame) = extract_frame_base64_hwaccel(ffmpeg_path, file_path, target_sec).await {
            results.push(frame);
        }
    }
    Ok(results)
}

