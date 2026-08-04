use super::types::FfmpegProgressPayload;
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::{Path, PathBuf};
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
    let mut reader = BufReader::new(stdout).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if crate::utils::check_cancel_flag() {
            let _ = child.kill().await;
            return Err("Processing aborted by user.".to_string());
        }

        if line.starts_with("out_time_ms=") {
            let ms_str = line.trim_start_matches("out_time_ms=");
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

                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: file_name.to_string(),
                            file_index,
                            total_files,
                            percent: pct,
                            current_part: cur_part,
                            total_parts,
                            status: if total_parts > 1 {
                                format!("Splitting segment {} of {}...", cur_part, total_parts)
                            } else {
                                "Transcoding video stream...".to_string()
                            },
                        },
                    );
                }
            }
        }
    }

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
        log_error(&format!("FFmpeg failed with exit code: {:?}", status.code()));
        Err("FFmpeg processing failed".to_string())
    }
}

pub(crate) fn fs_err_file_size(file_path: &str) -> f64 {
    std::fs::metadata(file_path)
        .map(|m| m.len() as f64)
        .unwrap_or(0.0)
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

pub(crate) fn resolve_conflict_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }

    let parent = path.parent().unwrap_or(Path::new("."));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().unwrap_or_default().to_string_lossy();

    let mut counter = 1;
    loop {
        let new_name = format!("{}_{}.{}", stem, counter, ext);
        let candidate = parent.join(new_name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}
