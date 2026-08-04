use crate::utils;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageConversionConfig {
    pub input_files: Vec<String>,
    pub output_format: String, // "JPG", "PDF", "PNG", "WEBP"
    pub jpg_quality: Option<u32>,
    pub jpg_scale_percent: Option<u32>,
    pub jpg_height: Option<u32>,
    pub web_quality: Option<u32>,
    pub web_scale_percent: Option<u32>,
    pub web_height: Option<u32>,
    pub pdf_quality: Option<u32>,
    pub pdf_scale_percent: Option<u32>,
    pub pdf_height: Option<u32>,
    pub png_scale_percent: Option<u32>,
    pub png_height: Option<u32>,
    pub merge_pdf: bool,
    pub custom_output_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageProgressPayload {
    pub current_file: String,
    pub file_index: usize,
    pub total_files: usize,
    pub percent: f64,
    pub phase: String,
    pub status: String,
}

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

    // Handle PDF merge vs individual file conversion
    if config.output_format == "PDF" && config.merge_pdf && config.input_files.len() > 1 {
        return run_pdf_merge(app, magick_path, &config).await;
    }

    let total = config.input_files.len();
    for (idx, input_path_str) in config.input_files.iter().enumerate() {
        if utils::check_cancel_flag() {
            return Err("Processing aborted by user.".to_string());
        }

        let input_path = Path::new(input_path_str);
        if !input_path.exists() {
            continue;
        }

        let file_name = input_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

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
        cmd.args(["-limit", "memory", "64MiB", "-limit", "map", "128MiB"]);
        cmd.arg(input_path_str);

        // Quality and scaling flags
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

async fn run_pdf_merge<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    magick_path: &str,
    config: &ImageConversionConfig,
) -> Result<(), String> {
    let total_files = config.input_files.len();
    if total_files == 0 {
        return Err("No input files for PDF merge.".to_string());
    }

    let first_file = Path::new(&config.input_files[0]);
    let out_dir = if let Some(ref d) = config.custom_output_dir {
        PathBuf::from(d)
    } else {
        first_file.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let pdf_out = out_dir.join("Merged_Images.pdf");

    // Create unique temporary directory for sequential frame normalization
    let batch_id = format!(
        "{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let temp_dir = std::env::temp_dir().join(format!("alitken_pdf_{}", batch_id));
    if let Err(e) = tokio::fs::create_dir_all(&temp_dir).await {
        let err = format!("Failed to create temp directory for PDF merge: {}", e);
        utils::log_error(&err);
        return Err(err);
    }

    utils::log_info(&format!(
        "Starting sequential two-pass PDF merge for {} images into {:?}",
        total_files, pdf_out
    ));

    let mut temp_frames: Vec<PathBuf> = Vec::new();

    // Pass 1: Sequential Per-Frame Conversion (One image at a time -> Capped RAM)
    for (idx, input_str) in config.input_files.iter().enumerate() {
        if utils::check_cancel_flag() {
            let _ = tokio::fs::remove_dir_all(&temp_dir).await;
            return Err("Processing aborted by user.".to_string());
        }

        let input_path = Path::new(input_str);
        let file_name = input_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let _ = app.emit(
            "image-progress",
            ImageProgressPayload {
                current_file: file_name.clone(),
                file_index: idx + 1,
                total_files,
                percent: ((idx as f64) / (total_files as f64)) * 85.0,
                phase: "Combining Pages".to_string(),
                status: format!("Combining image {} of {}: {}", idx + 1, total_files, file_name),
            },
        );

        let temp_jpg = temp_dir.join(format!("frame_{:05}.jpg", idx));

        let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
        cmd.args(["-limit", "memory", "64MiB", "-limit", "map", "128MiB"]);
        cmd.arg(input_str);

        if let Some(q) = config.pdf_quality {
            cmd.arg("-quality").arg(q.to_string());
        } else {
            cmd.arg("-quality").arg("85");
        }

        if let Some(scale) = config.pdf_scale_percent {
            cmd.arg("-resize").arg(format!("{}%", scale));
        } else if let Some(h) = config.pdf_height {
            cmd.arg("-resize").arg(format!("x{}", h));
        }

        cmd.arg(&temp_jpg);
        cmd.stdout(Stdio::null()).stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let status = child.wait().await.map_err(|e| e.to_string())?;
                if !status.success() {
                    let _ = tokio::fs::remove_dir_all(&temp_dir).await;
                    if utils::check_cancel_flag() {
                        return Err("Processing aborted by user.".to_string());
                    }
                    let err = format!("ImageMagick frame preparation failed for: {}", file_name);
                    utils::log_error(&err);
                    return Err(err);
                }
            }
            Err(e) => {
                let _ = tokio::fs::remove_dir_all(&temp_dir).await;
                if utils::check_cancel_flag() {
                    return Err("Processing aborted by user.".to_string());
                }
                let err = format!("Failed to spawn ImageMagick for {}: {}", file_name, e);
                utils::log_error(&err);
                return Err(err);
            }
        }

        temp_frames.push(temp_jpg);
    }

    // Pass 2: Final PDF Compilation from lightweight temp JPEGs
    if utils::check_cancel_flag() {
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
        return Err("Processing aborted by user.".to_string());
    }

    let _ = app.emit(
        "image-progress",
        ImageProgressPayload {
            current_file: "Merged_Images.pdf".to_string(),
            file_index: total_files,
            total_files,
            percent: 90.0,
            phase: "Combining PDF".to_string(),
            status: format!("Combining {} pages into Merged_Images.pdf...", total_files),
        },
    );

    let mut merge_cmd = utils::create_tokio_hidden_cmd(magick_path);
    merge_cmd.args(["-limit", "memory", "64MiB", "-limit", "map", "128MiB"]);

    for frame in &temp_frames {
        merge_cmd.arg(frame);
    }

    merge_cmd.arg(&pdf_out);
    merge_cmd.stdout(Stdio::null()).stderr(Stdio::piped());

    let res = match merge_cmd.spawn() {
        Ok(mut child) => {
            let status = child.wait().await.map_err(|e| e.to_string())?;
            if status.success() {
                Ok(())
            } else if utils::check_cancel_flag() {
                Err("Processing aborted by user.".to_string())
            } else {
                Err("ImageMagick PDF compilation failed.".to_string())
            }
        }
        Err(e) => {
            if utils::check_cancel_flag() {
                Err("Processing aborted by user.".to_string())
            } else {
                Err(format!("Failed to spawn ImageMagick PDF compilation: {}", e))
            }
        }
    };

    // Clean up temporary directory
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    if let Err(ref e) = res {
        utils::log_error(e);
        return res;
    }

    let _ = app.emit(
        "image-progress",
        ImageProgressPayload {
            current_file: "Merged_Images.pdf".to_string(),
            file_index: total_files,
            total_files,
            percent: 100.0,
            phase: "Completed".to_string(),
            status: "PDF combination completed successfully.".to_string(),
        },
    );

    utils::log_info(&format!("Successfully created merged PDF: {:?}", pdf_out));
    Ok(())
}

fn build_output_filepath(
    input_path: &Path,
    config: &ImageConversionConfig,
) -> Result<PathBuf, String> {
    let parent = if let Some(ref d) = config.custom_output_dir {
        PathBuf::from(d)
    } else {
        input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let stem = input_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy();

    let ext = match config.output_format.to_uppercase().as_str() {
        "JPG" => "jpg",
        "PDF" => "pdf",
        "PNG" => "png",
        "WEBP" => "webp",
        _ => "jpg",
    };

    let out_file = parent.join(format!("{}.{}", stem, ext));

    // Handle identical path collision
    if out_file == input_path {
        return Ok(parent.join(format!("{}_converted.{}", stem, ext)));
    }

    Ok(out_file)
}
