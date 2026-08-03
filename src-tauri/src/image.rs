use crate::utils;
use regex::Regex;
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

    // Handle PDF merge vs individual file conversion
    if config.output_format == "PDF" && config.merge_pdf && config.input_files.len() > 1 {
        return run_pdf_merge(app, magick_path, &config).await;
    }

    let total = config.input_files.len();
    for (idx, input_path_str) in config.input_files.iter().enumerate() {
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
                status: format!("Processing file {} of {}: {}", idx + 1, total, file_name),
            },
        );

        let out_file = build_output_filepath(input_path, &config)?;

        let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
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
    let first_file = Path::new(&config.input_files[0]);
    let out_dir = if let Some(ref d) = config.custom_output_dir {
        PathBuf::from(d)
    } else {
        first_file.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let pdf_out = out_dir.join("Merged_Images.pdf");

    let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
    cmd.arg("-monitor");

    for input in &config.input_files {
        cmd.arg(input);
    }

    if let Some(q) = config.pdf_quality {
        cmd.arg("-quality").arg(q.to_string());
    }
    if let Some(scale) = config.pdf_scale_percent {
        cmd.arg("-resize").arg(format!("{}%", scale));
    } else if let Some(h) = config.pdf_height {
        cmd.arg("-resize").arg(format!("x{}", h));
    }

    cmd.arg(&pdf_out);
    cmd.stdout(Stdio::null()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ImageMagick PDF merge: {}", e))?;

    let regex_monitor = Regex::new(r"^([^\[]+)\[([^\]]+)\]:\s*(?:(\d+)\s+of\s+(\d+),\s*)?(\d+)%\s+complete").unwrap();
    let total_files = config.input_files.len();

    if let Some(stderr) = child.stderr.take() {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(caps) = regex_monitor.captures(&line) {
                let phase_raw = caps.get(1).map_or("", |m| m.as_str()).trim();
                let pct: f64 = caps.get(5).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
                let current_step: usize = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(1);

                let _ = app.emit(
                    "image-progress",
                    ImageProgressPayload {
                        current_file: "Merged_Images.pdf".to_string(),
                        file_index: current_step.min(total_files),
                        total_files,
                        percent: pct.min(100.0),
                        phase: phase_raw.to_string(),
                        status: format!("Merging to PDF (Step {}/{}): {}%", current_step, total_files, pct as u32),
                    },
                );
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("ImageMagick PDF merge process failed.".to_string());
    }

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
