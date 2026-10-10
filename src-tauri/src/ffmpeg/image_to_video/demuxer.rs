use crate::ffmpeg::process::is_ffmpeg_native_image_format;
use crate::ffmpeg::types::{FfmpegProgressPayload, ImageToVideoConfig};
use crate::gpu::GpuCapability;
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

pub async fn run_concat_demuxer<R: tauri::Runtime, F>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    magick_path: &str,
    config: &ImageToVideoConfig,
    gpu_caps: &GpuCapability,
    sorted_inputs: &[String],
    resolved_out: &Path,
    scale_w: u32,
    scale_h: u32,
    mode: &str,
    stem: &str,
    get_img_info: F,
) -> Result<(), String>
where
    F: Fn(f64) -> (usize, String),
{
    let total_count = sorted_inputs.len();
    let temp_dir = std::env::temp_dir();
    let batch_id = format!(
        "{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let mut temp_files_to_cleanup: Vec<PathBuf> = Vec::new();

    let frame_dur = if mode == "SEQUENCE" {
        1.0 / (config.fps as f64)
    } else {
        config.duration_sec
    };

    let manifest_file = temp_dir.join(format!("alitken_concat_{}.txt", batch_id));
    temp_files_to_cleanup.push(manifest_file.clone());

    let mut has_preprocessing = false;

    let manifest_input_paths: Vec<String> = if mode == "SEQUENCE" {
        // Mode 2: Image Sequence Mode
        sorted_inputs.to_vec()
    } else {
        // Mode 1: Photo Slideshow Mode
        // Pre-normalize EVERY image to uniform (scale_w x scale_h) PNG frames
        // to prevent FFmpeg concat demuxer dimension lock / frame drop issues
        has_preprocessing = true;
        let mut processed_paths = Vec::new();

        let vf_prep = format!(
            "scale={}:{}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p",
            scale_w, scale_h, scale_w, scale_h
        );

        for (idx, raw_path_str) in sorted_inputs.iter().enumerate() {
            if crate::utils::check_cancel_flag() {
                for p in &temp_files_to_cleanup {
                    let _ = std::fs::remove_file(p);
                }
                return Err("Processing aborted by user.".to_string());
            }

            let temp_png = temp_dir.join(format!("alitken_frame_{}_{}.png", batch_id, idx));
            temp_files_to_cleanup.push(temp_png.clone());

            let file_name = Path::new(raw_path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| stem.to_string());

            let _ = app.emit(
                "ffmpeg-progress",
                FfmpegProgressPayload {
                    current_file: file_name,
                    file_index: idx + 1,
                    total_files: total_count,
                    percent: ((idx as f64) / (total_count as f64)) * 20.0,
                    current_part: 1,
                    total_parts: 1,
                    status: format!("Pre-normalizing image {} of {}...", idx + 1, total_count),
                },
            );

            let is_native = is_ffmpeg_native_image_format(raw_path_str);
            let mut success = false;

            // Non-native formats (e.g. HEIC, TIFF, ICO): Use ImageMagick
            if !is_native && !magick_path.is_empty() && Path::new(magick_path).exists() {
                let mut magick_cmd = create_tokio_hidden_cmd(magick_path);
                magick_cmd
                    .arg(raw_path_str)
                    .arg("-resize")
                    .arg(format!("{}x{}", scale_w, scale_h))
                    .arg("-background")
                    .arg("black")
                    .arg("-gravity")
                    .arg("center")
                    .arg("-extent")
                    .arg(format!("{}x{}", scale_w, scale_h))
                    .arg(&temp_png);

                if let Ok(st) = magick_cmd.status().await {
                    if st.success() {
                        success = true;
                    }
                }
            }

            // For native formats (PNG/JPG/WEBP) or FFmpeg fallback: use FFmpeg scale & pad
            if !success && !crate::utils::check_cancel_flag() {
                let mut ffmpeg_prep = create_tokio_hidden_cmd(ffmpeg_path);
                ffmpeg_prep.args([
                    "-y",
                    "-i",
                    raw_path_str,
                    "-vf",
                    &vf_prep,
                    "-vframes",
                    "1",
                    &temp_png.to_string_lossy(),
                ]);

                if let Ok(st) = ffmpeg_prep.status().await {
                    if st.success() {
                        success = true;
                    }
                }
            }

            // Final fallback: ImageMagick direct convert if FFmpeg prep failed
            if !success && !crate::utils::check_cancel_flag() && !magick_path.is_empty() && Path::new(magick_path).exists() {
                let mut magick_cmd = create_tokio_hidden_cmd(magick_path);
                magick_cmd.arg(raw_path_str).arg(&temp_png);
                if let Ok(st) = magick_cmd.status().await {
                    if st.success() {
                        success = true;
                    }
                }
            }

            if !success {
                for p in &temp_files_to_cleanup {
                    let _ = std::fs::remove_file(p);
                }
                if crate::utils::check_cancel_flag() {
                    return Err("Processing aborted by user.".to_string());
                }
                return Err(format!(
                    "Failed to pre-normalize image {}: {}",
                    idx + 1,
                    Path::new(raw_path_str)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                ));
            }

            processed_paths.push(temp_png.to_string_lossy().to_string());
        }
        processed_paths
    };

    // Manifest Generation for Concat Demuxer
    let mut manifest_content = String::new();
    for file_path in &manifest_input_paths {
        let escaped_path = file_path.replace('\\', "/").replace('\'', "'\\''");
        manifest_content.push_str(&format!("file '{}'\nduration {}\n", escaped_path, frame_dur));
    }
    // Concat demuxer spec requires repeating the last file line without duration at the end
    if let Some(last_path) = manifest_input_paths.last() {
        let escaped_path = last_path.replace('\\', "/").replace('\'', "'\\''");
        manifest_content.push_str(&format!("file '{}'\n", escaped_path));
    }

    std::fs::write(&manifest_file, &manifest_content).map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        format!("Failed to write concat manifest file: {}", e)
    })?;

    let total_expected_sec = if mode == "SEQUENCE" {
        (total_count as f64) / (config.fps as f64)
    } else {
        config.duration_sec * (total_count as f64)
    };

    let vf_filter = if mode == "SEQUENCE" {
        format!(
            "scale={}:{}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p",
            scale_w, scale_h, scale_w, scale_h
        )
    } else {
        "setsar=1,format=yuv420p".to_string()
    };

    // FFmpeg Execution with Concat Demuxer
    let mut cmd = create_tokio_hidden_cmd(ffmpeg_path);
    cmd.args([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        &manifest_file.to_string_lossy(),
    ]);

    if let Some(ref audio_path) = config.audio_path {
        if Path::new(audio_path).exists() {
            cmd.args(["-i", audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"]);
        }
    }

    cmd.args(["-c:v", &gpu_caps.encoder]);
    for arg in gpu_caps.encoder_args.split_whitespace() {
        cmd.arg(arg);
    }
    cmd.args(["-r", &config.fps.to_string()]);
    cmd.args(["-fps_mode", "cfr"]);
    cmd.args(["-vf", &vf_filter]);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(resolved_out.to_string_lossy().to_string());

    log_info(&format!("Spawning FFmpeg Image-to-Video: {:?}", cmd));

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        format!("Failed to spawn FFmpeg for image to video: {}", e)
    })?;

    // Asynchronously read stderr in a background task to prevent stdout/stderr pipe deadlocks
    let stderr_stream = child.stderr.take();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        if let Some(stderr) = stderr_stream {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                lines.push(line);
            }
        }
        let start = lines.len().saturating_sub(40);
        lines[start..].join("\n")
    });

    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if crate::utils::check_cancel_flag() {
                let _ = child.kill().await;
                for p in &temp_files_to_cleanup {
                    let _ = std::fs::remove_file(p);
                }
                return Err("Processing aborted by user.".to_string());
            }

            if line.starts_with("out_time_ms=") {
                let ms_str = line.trim_start_matches("out_time_ms=");
                if let Ok(ms) = ms_str.parse::<f64>() {
                    let current_sec = ms / 1_000_000.0;
                    let render_pct = (current_sec / total_expected_sec)
                        * if has_preprocessing { 80.0 } else { 100.0 };
                    let pct = if has_preprocessing {
                        (20.0 + render_pct).clamp(20.0, 100.0)
                    } else {
                        render_pct.clamp(0.0, 100.0)
                    };
                    let (file_idx, file_name) = get_img_info(current_sec);
                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: file_name,
                            file_index: file_idx,
                            total_files: total_count,
                            percent: pct,
                            current_part: 1,
                            total_parts: 1,
                            status: format!(
                                "Rendering video ({:.1}s / {:.1}s)...",
                                current_sec, total_expected_sec
                            ),
                        },
                    );
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        e.to_string()
    })?;

    let stderr_output = stderr_handle.await.unwrap_or_default();

    // Cleanup Temp Files
    for temp_path in &temp_files_to_cleanup {
        let _ = std::fs::remove_file(temp_path);
    }

    if crate::utils::check_cancel_flag() {
        return Err("Processing aborted by user.".to_string());
    }

    if !status.success() {
        log_error(&format!("FFmpeg image-to-video failed. Stderr:\n{}", stderr_output));
        return Err(format!(
            "FFmpeg processing failed: {}",
            stderr_output.trim()
        ));
    }

    log_info(&format!("Successfully completed Image-to-Video conversion -> {:?}", resolved_out));

    Ok(())
}
