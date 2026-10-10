use super::types::{validate_image_safety, ImageConversionConfig, ImageProgressPayload};
use crate::utils::{self, resolve_conflict_path};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;

pub async fn run_pdf_merge<R: tauri::Runtime>(
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

    let pdf_out = resolve_conflict_path(out_dir.join("Merged_Images.pdf"));

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

    // Pass 1: Sequential Per-Frame Conversion
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

        if let Err(e) = validate_image_safety(input_path) {
            let _ = app.emit(
                "image-progress",
                ImageProgressPayload {
                    current_file: file_name,
                    file_index: idx + 1,
                    total_files,
                    percent: (((idx + 1) as f64) / (total_files as f64)) * 85.0,
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
                total_files,
                percent: ((idx as f64) / (total_files as f64)) * 85.0,
                phase: "Combining Pages".to_string(),
                status: format!("Combining image {} of {}: {}", idx + 1, total_files, file_name),
            },
        );

        let temp_jpg = temp_dir.join(format!("frame_{:05}.jpg", idx));

        let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
        cmd.args(["-limit", "memory", "1GiB", "-limit", "map", "2GiB"]);
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

    // Pass 2: Final PDF Compilation
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
    merge_cmd.args(["-limit", "memory", "1GiB", "-limit", "map", "2GiB"]);

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
