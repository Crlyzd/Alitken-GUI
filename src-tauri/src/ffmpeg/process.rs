use super::types::FfmpegProgressPayload;
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::Path;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

pub async fn execute_ffmpeg_process<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    args: Vec<String>,
    file_name: &str,
    file_index: usize,
    total_files: usize,
    duration_sec: f64,
    total_parts: usize,
    custom_status: Option<&str>,
) -> Result<(), String> {
    log_info(&format!("Spawning FFmpeg: {} {}", ffmpeg_path, args.join(" ")));

    let mut child = create_tokio_hidden_cmd(ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Failed to spawn FFmpeg process: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let mut reader = BufReader::new(stdout).lines();

    let stderr_lines = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
    let stderr_lines_clone = stderr_lines.clone();

    let stderr_handle = tokio::spawn(async move {
        let mut err_reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = err_reader.next_line().await {
            let mut lines = stderr_lines_clone.lock().await;
            if lines.len() >= 50 {
                lines.remove(0);
            }
            lines.push(line);
        }
    });

    let mut cur_frame: u64 = 0;
    let mut cur_fps: f64 = 0.0;

    while let Ok(Some(line)) = reader.next_line().await {
        if crate::utils::check_cancel_flag() {
            let _ = child.kill().await;
            let _ = stderr_handle.await;
            return Err("Processing aborted by user.".to_string());
        }

        let trimmed = line.trim();
        if trimmed.starts_with("frame=") {
            if let Ok(f) = trimmed.trim_start_matches("frame=").trim().parse::<u64>() {
                cur_frame = f;
            }
        } else if trimmed.starts_with("fps=") {
            if let Ok(fps) = trimmed.trim_start_matches("fps=").trim().parse::<f64>() {
                cur_fps = fps;
            }
        } else if trimmed.starts_with("out_time_ms=") {
            let ms_str = trimmed.trim_start_matches("out_time_ms=");
            if let Ok(cur_ms) = ms_str.parse::<f64>() {
                if duration_sec > 0.0 {
                    let total_ms = duration_sec * 1_000_000.0;
                    let mut pct = (cur_ms / total_ms) * 100.0;
                    if pct > 100.0 {
                        pct = 100.0;
                    }

                    let cur_part = if total_parts > 1 {
                        let p = ((pct / 100.0) * (total_parts as f64)).floor() as usize + 1;
                        if p > total_parts {
                            total_parts
                        } else {
                            p
                        }
                    } else {
                        1
                    };

                    let status_msg = if let Some(cs) = custom_status {
                        if cur_frame > 0 {
                            if cur_fps > 0.0 {
                                format!("{}: Frame {} ({:.0} FPS)...", cs, cur_frame, cur_fps)
                            } else {
                                format!("{}: Frame {}...", cs, cur_frame)
                            }
                        } else {
                            format!("{}...", cs)
                        }
                    } else if total_parts > 1 {
                        format!("Splitting segment {} of {}...", cur_part, total_parts)
                    } else {
                        "Transcoding video stream...".to_string()
                    };

                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: file_name.to_string(),
                            file_index,
                            total_files,
                            percent: pct,
                            current_part: cur_part,
                            total_parts,
                            status: status_msg,
                        },
                    );
                }
            }
        }
    }

    let _ = stderr_handle.await;

    let status = child
        .wait()
        .await
        .map_err(|e| {
            let err_msg = format!("FFmpeg wait failed: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    if status.success() {
        log_info(&format!("Successfully processed {}", file_name));
        Ok(())
    } else {
        let captured_err = {
            let lines = stderr_lines.lock().await;
            lines.join("\n")
        };
        let err_summary = if captured_err.trim().is_empty() {
            format!("FFmpeg exited with code {:?}", status.code())
        } else {
            captured_err
                .lines()
                .filter(|l| !l.trim().is_empty())
                .rev()
                .take(6)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("\n")
        };

        log_error(&format!(
            "FFmpeg failed for {}: {}\nFull Stderr: {}",
            file_name, err_summary, captured_err
        ));
        Err(format!("FFmpeg processing failed: {}", err_summary))
    }
}

pub(crate) fn fs_err_file_size(file_path: &str) -> f64 {
    std::fs::metadata(file_path)
        .map(|m| m.len() as f64)
        .unwrap_or(0.0)
}

pub async fn execute_ffmpeg_combine_process<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    args: Vec<String>,
    output_name: &str,
    clip_boundaries: Vec<(String, f64)>,
    total_duration_sec: f64,
) -> Result<(), String> {
    log_info(&format!("Spawning FFmpeg combine: {} {}", ffmpeg_path, args.join(" ")));

    let mut child = create_tokio_hidden_cmd(ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Failed to spawn FFmpeg process: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let mut reader = BufReader::new(stdout).lines();

    let stderr_lines = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
    let stderr_lines_clone = stderr_lines.clone();

    let stderr_handle = tokio::spawn(async move {
        let mut err_reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = err_reader.next_line().await {
            let mut lines = stderr_lines_clone.lock().await;
            if lines.len() >= 50 {
                lines.remove(0);
            }
            lines.push(line);
        }
    });

    let total_clips = clip_boundaries.len();

    while let Ok(Some(line)) = reader.next_line().await {
        if crate::utils::check_cancel_flag() {
            let _ = child.kill().await;
            let _ = stderr_handle.await;
            return Err("Processing aborted by user.".to_string());
        }

        let trimmed = line.trim();
        if trimmed.starts_with("out_time_ms=") {
            let ms_str = trimmed.trim_start_matches("out_time_ms=");
            if let Ok(cur_ms) = ms_str.parse::<f64>() {
                if total_duration_sec > 0.0 {
                    let cur_sec = cur_ms / 1_000_000.0;
                    let total_ms = total_duration_sec * 1_000_000.0;
                    let mut pct = (cur_ms / total_ms) * 100.0;
                    if pct > 100.0 {
                        pct = 100.0;
                    }

                    let mut active_idx = 1;
                    let mut active_file = clip_boundaries
                        .first()
                        .map(|c| c.0.as_str())
                        .unwrap_or(output_name);

                    for (idx, (name, end_sec)) in clip_boundaries.iter().enumerate() {
                        if cur_sec <= *end_sec || idx == total_clips - 1 {
                            active_idx = idx + 1;
                            active_file = name;
                            break;
                        }
                    }

                    let status_msg = if pct >= 99.9 {
                        "Finalizing MP4 container metadata (+faststart)...".to_string()
                    } else {
                        format!(
                            "Combining File {} of {}: {}...",
                            active_idx, total_clips, active_file
                        )
                    };

                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: active_file.to_string(),
                            file_index: active_idx,
                            total_files: total_clips,
                            percent: pct,
                            current_part: 1,
                            total_parts: 1,
                            status: status_msg,
                        },
                    );
                }
            }
        }
    }

    let _ = stderr_handle.await;

    let status = child
        .wait()
        .await
        .map_err(|e| {
            let err_msg = format!("FFmpeg wait failed: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    if status.success() {
        log_info(&format!("Successfully combined {}", output_name));
        Ok(())
    } else {
        let captured_err = {
            let lines = stderr_lines.lock().await;
            lines.join("\n")
        };
        let err_summary = if captured_err.trim().is_empty() {
            format!("FFmpeg exited with code {:?}", status.code())
        } else {
            captured_err
                .lines()
                .filter(|l| !l.trim().is_empty())
                .rev()
                .take(6)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("\n")
        };

        log_error(&format!(
            "FFmpeg combine failed for {}: {}\nFull Stderr: {}",
            output_name, err_summary, captured_err
        ));
        Err(format!("FFmpeg processing failed: {}", err_summary))
    }
}

pub fn is_ffmpeg_native_image_format(path_str: &str) -> bool {
    let path = Path::new(path_str);
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" | "png" | "webp" | "bmp" | "tiff" | "tif" | "gif" | "tga" | "pnm"
            | "ppm" | "pgm" | "pbm" | "dpx" | "exr" | "svg" | "xpm" => true,
            _ => false,
        }
    } else {
        false
    }
}
