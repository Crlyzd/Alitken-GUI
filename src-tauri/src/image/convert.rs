use super::pdf::run_pdf_merge;
use super::types::{build_output_filepath, validate_image_safety, ImageConversionConfig, ImageProgressPayload};
use crate::utils;
use std::path::Path;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

pub async fn run_image_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    magick_path: &str,
    config: ImageConversionConfig,
) -> Result<(), String> {
    if magick_path.is_empty() || !Path::new(magick_path).exists() {
        let err_msg = format!("ImageMagick executable (magick.exe) not found at: '{}'. Please download dependencies.", magick_path);
        utils::log_error(&err_msg);
        return Err(err_msg);
    }

    if config.input_files.is_empty() {
        return Err("No input image files provided.".to_string());
    }

    utils::log_info(&format!(
        "Starting image pipeline. Files: {}, Format: {}",
        config.input_files.len(),
        config.output_format
    ));

    utils::reset_cancel_flag();

    for input_path_str in &config.input_files {
        if !Path::new(input_path_str).exists() {
            let err_msg = format!(
                "Input image file not found: '{}'. Please ensure the file was not deleted or moved.",
                input_path_str
            );
            utils::log_error(&err_msg);
            return Err(err_msg);
        }
        if let Ok(m) = std::fs::metadata(input_path_str) {
            if m.len() == 0 {
                let fname = Path::new(input_path_str).file_name().unwrap_or_default().to_string_lossy();
                let err_msg = format!("Input image file '{}' is empty (0 Bytes) and cannot be converted.", fname);
                utils::log_error(&err_msg);
                return Err(err_msg);
            }
        }
    }

    if config.output_format == "PDF" && config.merge_pdf && config.input_files.len() > 1 {
        return run_pdf_merge(app, magick_path, &config).await;
    }

    let total = config.input_files.len();
    for (idx, input_path_str) in config.input_files.iter().enumerate() {
        if utils::check_cancel_flag() {
            return Err("Processing aborted by user.".to_string());
        }

        let input_path = Path::new(input_path_str);

        let file_name = input_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if let Err(e) = validate_image_safety(input_path) {
            let _ = app.emit(
                "image-progress",
                ImageProgressPayload {
                    current_file: file_name,
                    file_index: idx + 1,
                    total_files: total,
                    percent: (((idx + 1) as f64) / (total as f64)) * 100.0,
                    phase: "Skipped".to_string(),
                    status: e,
                },
            );
            continue;
        }

        let _ = app.emit(
            "image-progress",
            ImageProgressPayload {
                current_file: file_name.clone(),
                file_index: idx + 1,
                total_files: total,
                percent: ((idx as f64) / (total as f64)) * 100.0,
                phase: "Converting".to_string(),
                status: format!("Converting to {}...", config.output_format),
            },
        );

        let out_file = build_output_filepath(input_path, &config)?;

        let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
        cmd.args(["-limit", "memory", "1GiB", "-limit", "map", "2GiB"]);
        
        let ext = input_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let input_arg = if ext == "psd" || ext == "psb" {
            format!("{}[0]", input_path_str)
        } else {
            input_path_str.to_string()
        };
        cmd.arg(&input_arg);

        match config.output_format.as_str() {
            "JPG" => {
                if let Some(q) = config.jpg_quality {
                    cmd.arg("-quality").arg(q.to_string());
                }
                if let Some(scale) = config.jpg_scale_percent {
                    cmd.arg("-resize").arg(format!("{}%", scale));
                } else if let Some(h) = config.jpg_height {
                    cmd.arg("-resize").arg(format!("x{}", h));
                }
            }
            "WEBP" => {
                if let Some(q) = config.web_quality {
                    cmd.arg("-quality").arg(q.to_string());
                }
                if let Some(scale) = config.web_scale_percent {
                    cmd.arg("-resize").arg(format!("{}%", scale));
                } else if let Some(h) = config.web_height {
                    cmd.arg("-resize").arg(format!("x{}", h));
                }
            }
            "PDF" => {
                if let Some(q) = config.pdf_quality {
                    cmd.arg("-quality").arg(q.to_string());
                }
                if let Some(scale) = config.pdf_scale_percent {
                    cmd.arg("-resize").arg(format!("{}%", scale));
                } else if let Some(h) = config.pdf_height {
                    cmd.arg("-resize").arg(format!("x{}", h));
                }
            }
            "PNG" => {
                if let Some(scale) = config.png_scale_percent {
                    cmd.arg("-resize").arg(format!("{}%", scale));
                } else if let Some(h) = config.png_height {
                    cmd.arg("-resize").arg(format!("x{}", h));
                }
            }
            _ => {}
        }

        cmd.arg(&out_file);
        cmd.stdout(Stdio::null()).stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ImageMagick process: {}", e))?;

        if let Some(stderr) = child.stderr.take() {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                utils::log_info(&format!("[Magick] {}", line));
            }
        }

        let status = child.wait().await.map_err(|e| e.to_string())?;
        if !status.success() {
            if utils::check_cancel_flag() {
                return Err("Processing aborted by user.".to_string());
            }
            return Err(format!("ImageMagick conversion failed for file: {}", file_name));
        }

        let _ = app.emit(
            "image-progress",
            ImageProgressPayload {
                current_file: file_name,
                file_index: idx + 1,
                total_files: total,
                percent: (((idx + 1) as f64) / (total as f64)) * 100.0,
                phase: "Completed".to_string(),
                status: format!("Completed {} of {}", idx + 1, total),
            },
        );
    }

    Ok(())
}
