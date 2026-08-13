use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::types::ExtractFramesConfig;
use crate::utils::{log_info, resolve_unique_frames_dir};
use std::path::{Path, PathBuf};

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

/// Extracts all frames from each queued video into separate `<video_stem>_frames/` image directories.
pub async fn run_extract_frames_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ExtractFramesConfig,
) -> Result<(), String> {
    if config.video_files.is_empty() {
        return Err("No video files provided for frame extraction.".to_string());
    }

    crate::utils::reset_cancel_flag();
    let total_files = config.video_files.len();

    for (file_idx, file_path) in config.video_files.iter().enumerate() {
        if crate::utils::check_cancel_flag() {
            return Err("Processing aborted by user.".to_string());
        }

        let input_path = Path::new(file_path);
        if !input_path.exists() {
            return Err(format!("Video file not found: '{}'", file_path));
        }

        let meta = probe_file(ffprobe_path, file_path).await?;
        let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
            PathBuf::from(custom_dir)
        } else {
            input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
        };

        let file_stem = input_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "frames".to_string());

        let out_dir = resolve_unique_frames_dir(&parent_dir, &file_stem);
        if let Err(e) = std::fs::create_dir_all(&out_dir) {
            return Err(format!(
                "Failed to create frame output directory {:?}: {}",
                out_dir, e
            ));
        }

        let format_ext = match config.output_format.to_uppercase().as_str() {
            "JPEG" | "JPG" => "jpg",
            "WEBP" => "webp",
            _ => "png",
        };

        let output_pattern = out_dir
            .join(format!("frame_%05d.{}", format_ext))
            .to_string_lossy()
            .to_string();

        let mut args: Vec<String> = vec!["-hide_banner".to_string()];

        // Decoder handling (AV1 libdav1d enforcement per Domain Principle #4)
        if meta.codec_name == "av1" {
            log_info("AV1 input detected: Forcing VideoLAN libdav1d software decoder");
            args.push("-c:v:0".to_string());
            args.push("libdav1d".to_string());
        }

        args.push("-i".to_string());
        args.push(file_path.clone());

        // Frame rate filter
        match config.frame_rate.as_str() {
            "30" => {
                args.push("-vf".to_string());
                args.push("fps=30".to_string());
            }
            "10" => {
                args.push("-vf".to_string());
                args.push("fps=10".to_string());
            }
            "5" => {
                args.push("-vf".to_string());
                args.push("fps=5".to_string());
            }
            "1" => {
                args.push("-vf".to_string());
                args.push("fps=1".to_string());
            }
            _ => {
                // "MAX" / Every Frame (Modern FFmpeg fps_mode passthrough)
                args.push("-fps_mode".to_string());
                args.push("passthrough".to_string());
            }
        }

        // Quality mapping
        let q_val = config.quality.unwrap_or(85);
        match format_ext {
            "png" => {
                args.push("-compression_level".to_string());
                args.push("2".to_string());
            }
            "jpg" => {
                // Map 1..100 quality to ffmpeg JPEG q:v (2 is best, 31 is worst)
                let q_scale =
                    (((100.0 - q_val as f64) / 100.0 * 29.0) + 2.0).clamp(2.0, 31.0) as u32;
                args.push("-q:v".to_string());
                args.push(q_scale.to_string());
            }
            "webp" => {
                args.push("-quality".to_string());
                args.push(q_val.to_string());
            }
            _ => {}
        }

        args.push("-progress".to_string());
        args.push("pipe:1".to_string());
        args.push("-y".to_string());
        args.push(output_pattern);

        log_info(&format!(
            "Extracting frames: file='{}' -> dir='{:?}', fmt={}, rate={}",
            file_path, out_dir, format_ext, config.frame_rate
        ));

        execute_ffmpeg_process(
            app,
            ffmpeg_path,
            args,
            &file_stem,
            file_idx + 1,
            total_files,
            meta.duration_sec,
            1,
            Some(&format!("Extracting {} frames", format_ext.to_uppercase())),
        )
        .await?;
    }

    Ok(())
}
