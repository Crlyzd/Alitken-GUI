use super::process::{is_ffmpeg_native_image_format, resolve_conflict_path};
use super::probe::probe_file;
use super::types::{FfmpegProgressPayload, ImageToVideoConfig};
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

pub async fn run_image_to_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    magick_path: &str,
    config: ImageToVideoConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if config.input_files.is_empty() {
        return Err("No input files provided for Image to Video conversion.".to_string());
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");

    log_info(&format!(
        "Starting Image-to-Video pipeline ({}). Inputs: {}, Duration: {}s, FPS: {}",
        mode,
        config.input_files.len(),
        config.duration_sec,
        config.fps
    ));

    let first_file = Path::new(&config.input_files[0]);
    let out_dir = if let Some(ref d) = config.output_dir {
        PathBuf::from(d)
    } else {
        first_file.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let stem = if config.input_files.len() == 1 {
        first_file.file_stem().unwrap_or_default().to_string_lossy().to_string()
    } else if mode == "SEQUENCE" {
        "Animation_Render".to_string()
    } else {
        "Image_Slideshow".to_string()
    };

    let target_file = out_dir.join(format!("{}.mp4", stem));
    let resolved_out = resolve_conflict_path(target_file);

    let (scale_w, scale_h) = match config.resolution.as_str() {
        "4k" => (3840, 2160),
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        "ORIGINAL" | _ => {
            let mut max_w = 0u32;
            let mut max_h = 0u32;

            // Probe input files using fast binary header reader first
            for file_path in &config.input_files {
                let (w, h) = crate::utils::get_image_dimensions(file_path);
                if w > max_w {
                    max_w = w;
                }
                if h > max_h {
                    max_h = h;
                }
            }

            // Fallback to probe_file (ffprobe) if needed
            if max_w == 0 || max_h == 0 {
                let sample_count = std::cmp::min(config.input_files.len(), 10);
                for file_path in &config.input_files[..sample_count] {
                    if let Ok(meta) = probe_file(ffprobe_path, file_path).await {
                        if meta.width > max_w {
                            max_w = meta.width;
                        }
                        if meta.height > max_h {
                            max_h = meta.height;
                        }
                    }
                }
            }

            if max_w > 0 && max_h > 0 {
                let w = if max_w % 2 != 0 { max_w + 1 } else { max_w };
                let h = if max_h % 2 != 0 { max_h + 1 } else { max_h };
                log_info(&format!("Probed original resolution canvas for Image-to-Video: {}x{}", w, h));
                (w, h)
            } else {
                log_info("Could not probe image dimensions; falling back to 1920x1080 canvas.");
                (1920, 1080)
            }
        }
    };

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

    // Natural sort files if in sequence mode
    let mut sorted_inputs = config.input_files.clone();
    if mode == "SEQUENCE" {
        sorted_inputs.sort();
    }

    let total_count = sorted_inputs.len();

    let get_img_info = |sec: f64| -> (usize, String) {
        if total_count == 0 {
            return (1, stem.clone());
        }
        let idx = if mode == "SEQUENCE" {
            (sec * config.fps as f64).floor() as usize
        } else {
            (sec / config.duration_sec).floor() as usize
        };
        let clamped_idx = idx.min(total_count - 1);
        let name = Path::new(&sorted_inputs[clamped_idx])
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| stem.clone());
        (clamped_idx + 1, name)
    };

    let has_non_native = sorted_inputs.iter().any(|p| !is_ffmpeg_native_image_format(p));

    // STREAM PIPE PATH: Zero-Disk In-Memory Pipe Streaming for Non-Native Formats (e.g. HEIC/TIFF/RAW)
    if has_non_native && !magick_path.is_empty() && Path::new(magick_path).exists() {
        log_info("Non-native images detected (e.g. HEIC/TIFF). Engaging Zero-Disk In-Memory Pipe Stream.");

        let initial_file_name = sorted_inputs
            .first()
            .and_then(|p| Path::new(p).file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| stem.clone());

        let _ = app.emit(
            "ffmpeg-progress",
            FfmpegProgressPayload {
                current_file: initial_file_name,
                file_index: 1,
                total_files: total_count,
                percent: 5.0,
                current_part: 1,
                total_parts: 1,
                status: format!("Initializing in-memory pipe stream for {} images...", total_count),
            },
        );

        let input_fps = if mode == "SEQUENCE" {
            config.fps as f64
        } else {
            1.0 / config.duration_sec
        };

        let mut ffmpeg_cmd = create_tokio_hidden_cmd(ffmpeg_path);
        ffmpeg_cmd.args([
            "-y",
            "-f",
            "image2pipe",
            "-framerate",
            &input_fps.to_string(),
            "-i",
            "-",
        ]);

        if let Some(ref audio_path) = config.audio_path {
            if Path::new(audio_path).exists() {
                ffmpeg_cmd.args(["-i", audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"]);
            }
        }

        ffmpeg_cmd.args(["-c:v", &gpu_caps.encoder]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            ffmpeg_cmd.arg(arg);
        }
        ffmpeg_cmd.args(["-r", &config.fps.to_string()]);
        ffmpeg_cmd.args(["-fps_mode", "cfr"]);
        ffmpeg_cmd.args(["-vf", "setsar=1,format=yuv420p"]);
        ffmpeg_cmd.args(["-progress", "pipe:1"]);
        ffmpeg_cmd.arg(resolved_out.to_string_lossy().to_string());

        ffmpeg_cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Ok(mut ffmpeg_child) = ffmpeg_cmd.spawn() {
            if let Some(mut ffmpeg_stdin) = ffmpeg_child.stdin.take() {
                let sorted_inputs_clone = sorted_inputs.clone();
                let magick_path_clone = magick_path.to_string();

                let streamer_handle = tokio::spawn(async move {
                    for (idx, path) in sorted_inputs_clone.iter().enumerate() {
                        let mut magick_cmd = create_tokio_hidden_cmd(&magick_path_clone);
                        magick_cmd
                            .arg(path)
                            .arg("-resize")
                            .arg(format!("{}x{}", scale_w, scale_h))
                            .arg("-background")
                            .arg("black")
                            .arg("-gravity")
                            .arg("center")
                            .arg("-extent")
                            .arg(format!("{}x{}", scale_w, scale_h))
                            .arg("ppm:-");

                        magick_cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

                        match magick_cmd.spawn() {
                            Ok(mut magick_child) => {
                                if let Some(mut magick_stdout) = magick_child.stdout.take() {
                                    if let Err(e) = tokio::io::copy(&mut magick_stdout, &mut ffmpeg_stdin).await {
                                        log_error(&format!("Error piping frame {} ({}) to FFmpeg: {}", idx + 1, path, e));
                                        let _ = magick_child.kill().await;
                                        return false;
                                    }
                                }
                                match magick_child.wait().await {
                                    Ok(st) if st.success() => {},
                                    Ok(st) => {
                                        log_error(&format!("ImageMagick frame {} exited with status {:?}", idx + 1, st.code()));
                                        return false;
                                    }
                                    Err(e) => {
                                        log_error(&format!("ImageMagick frame {} wait error: {}", idx + 1, e));
                                        return false;
                                    }
                                }
                            }
                            Err(e) => {
                                log_error(&format!("Failed to spawn ImageMagick for frame {} ({}): {}", idx + 1, path, e));
                                return false;
                            }
                        }
                    }
                    // Drop ffmpeg_stdin to send EOF to FFmpeg stdin stream
                    drop(ffmpeg_stdin);
                    true
                });

                let total_expected_sec = if mode == "SEQUENCE" {
                    (total_count as f64) / (config.fps as f64)
                } else {
                    config.duration_sec * (total_count as f64)
                };

                let stderr_stream = ffmpeg_child.stderr.take();
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

                if let Some(stdout) = ffmpeg_child.stdout.take() {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        if line.starts_with("out_time_ms=") {
                            let ms_str = line.trim_start_matches("out_time_ms=");
                            if let Ok(ms) = ms_str.parse::<f64>() {
                                let current_sec = ms / 1_000_000.0;
                                let pct = ((current_sec / total_expected_sec) * 100.0).clamp(0.0, 100.0);
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
                                            "Streaming & Encoding video ({:.1}s / {:.1}s)...",
                                            current_sec, total_expected_sec
                                        ),
                                    },
                                );
                            }
                        }
                    }
                }

                let ffmpeg_status = ffmpeg_child.wait().await;
                let stream_res = streamer_handle.await.unwrap_or(false);
                let stderr_output = stderr_handle.await.unwrap_or_default();

                if let Ok(f_st) = ffmpeg_status {
                    if f_st.success() && stream_res {
                        log_info(&format!(
                            "Successfully completed Zero-Disk Image-to-Video conversion -> {:?}",
                            resolved_out
                        ));
                        return Ok(());
                    } else {
                        log_error(&format!(
                            "Pipe streaming failed (FFmpeg exit: {:?}, Stream success: {}). Stderr:\n{}",
                            f_st.code(),
                            stream_res,
                            stderr_output
                        ));
                    }
                }
            }
        }
        log_info("Pipe streaming encountered an error; falling back to temporary file pre-normalization routine.");
    }

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
        sorted_inputs.clone()
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
            let temp_png = temp_dir.join(format!("alitken_frame_{}_{}.png", batch_id, idx));
            temp_files_to_cleanup.push(temp_png.clone());

            let file_name = Path::new(raw_path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| stem.clone());

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
            if !success {
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
            if !success && !magick_path.is_empty() && Path::new(magick_path).exists() {
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

    // Stage 2: Manifest Generation for Concat Demuxer
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

    // Stage 3: FFmpeg Execution with Concat Demuxer
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

    // Stage 4: Cleanup Temp Files
    for temp_path in &temp_files_to_cleanup {
        let _ = std::fs::remove_file(temp_path);
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
