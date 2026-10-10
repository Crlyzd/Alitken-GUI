use crate::ffmpeg::types::{FfmpegProgressPayload, ImageToVideoConfig};
use crate::gpu::GpuCapability;
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::Path;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

pub async fn run_pipe_stream<R: tauri::Runtime, F>(
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
    get_img_info: F,
) -> Result<bool, String>
where
    F: Fn(f64) -> (usize, String),
{
    let total_count = sorted_inputs.len();

    let initial_file_name = sorted_inputs
        .first()
        .and_then(|p| Path::new(p).file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "slideshow".to_string());

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

    let mut ffmpeg_child = match ffmpeg_cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            log_error(&format!("Failed to spawn FFmpeg for image pipe: {}", e));
            return Ok(false);
        }
    };

    let mut ffmpeg_stdin = match ffmpeg_child.stdin.take() {
        Some(stdin) => stdin,
        None => return Ok(false),
    };

    let sorted_inputs_vec = sorted_inputs.to_vec();
    let magick_path_clone = magick_path.to_string();

    let streamer_handle = tokio::spawn(async move {
        for (idx, path) in sorted_inputs_vec.iter().enumerate() {
            if crate::utils::check_cancel_flag() {
                return false;
            }

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
                        Ok(st) if st.success() => {}
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
            if crate::utils::check_cancel_flag() {
                let _ = ffmpeg_child.kill().await;
                return Err("Processing aborted by user.".to_string());
            }

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

    if crate::utils::check_cancel_flag() {
        return Err("Processing aborted by user.".to_string());
    }

    if let Ok(f_st) = ffmpeg_status {
        if f_st.success() && stream_res {
            log_info(&format!(
                "Successfully completed Zero-Disk Image-to-Video conversion -> {:?}",
                resolved_out
            ));
            return Ok(true);
        } else {
            log_error(&format!(
                "Pipe streaming failed (FFmpeg exit: {:?}, Stream success: {}). Stderr:\n{}",
                f_st.code(),
                stream_res,
                stderr_output
            ));
        }
    }

    Ok(false)
}
