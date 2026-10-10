use crate::utils::{self, resolve_conflict_path};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

pub fn validate_image_safety(path: &Path) -> Result<(), String> {
    let (w, h) = utils::get_image_dimensions(path);
    if w > 0 && h > 0 {
        let uncompressed_bytes = (w as u64) * (h as u64) * 4;
        // 1 GiB limit = 1,073,741,824 bytes (~268 Megapixels)
        if uncompressed_bytes > 1_073_741_824 {
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let err = format!(
                "Image '{}' exceeds maximum supported resolution limit ({}x{}, ~{:.1} MP, ~{:.2} GB uncompressed RAM). Skipped for safety.",
                file_name,
                w,
                h,
                (w as f64 * h as f64) / 1_000_000.0,
                uncompressed_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
            );
            utils::log_error(&err);
            return Err(err);
        }
    }
    Ok(())
}

pub fn build_output_filepath(
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

    // Handle identical path collision (same name, same ext — e.g. PNG→PNG)
    if out_file == input_path {
        return Ok(resolve_conflict_path(
            parent.join(format!("{}_converted.{}", stem, ext)),
        ));
    }

    // Deconflict against any previously converted output with the same name
    Ok(resolve_conflict_path(out_file))
}

pub async fn probe_image_dimensions_magick(
    magick_path: &str,
    file_path: &str,
) -> Result<(u32, u32), String> {
    if magick_path.is_empty() || !Path::new(magick_path).exists() {
        return Err("ImageMagick executable not found".to_string());
    }

    let mut cmd = utils::create_tokio_hidden_cmd(magick_path);
    cmd.args(["identify", "-ping", "-format", "%w %h\n", file_path]);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to spawn ImageMagick identify: {}", e))?;

    if !output.status.success() {
        return Err("ImageMagick failed to identify image".to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.len() >= 2 {
        let w = parts[0].parse::<u32>().unwrap_or(0);
        let h = parts[1].parse::<u32>().unwrap_or(0);
        if w > 0 && h > 0 {
            return Ok((w, h));
        }
    }

    Err("Could not parse image dimensions from ImageMagick output".to_string())
}
