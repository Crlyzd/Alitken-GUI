use crate::ffmpeg::TrimPreset;
use crate::utils;
use serde::{Deserialize, Serialize};

#[tauri::command]
pub fn save_trim_preset(
    file_path: String,
    start_sec: f64,
    end_sec: f64,
    fast_copy: bool,
    aspect_ratio: Option<String>,
    crop_offset_x: Option<f64>,
    crop_offset_y: Option<f64>,
    crop_scale: Option<f64>,
    crop_w: Option<u32>,
    crop_h: Option<u32>,
    crop_x: Option<u32>,
    crop_y: Option<u32>,
    crop_filter: Option<String>,
) -> Result<(), String> {
    let canonical_key = file_path.replace('\\', "/").to_lowercase();
    let presets_file = utils::get_trim_presets_path();

    let mut map: std::collections::HashMap<String, TrimPreset> = if presets_file.exists() {
        std::fs::read_to_string(&presets_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    map.insert(
        canonical_key,
        TrimPreset {
            start_sec,
            end_sec,
            fast_copy,
            updated_at: now,
            aspect_ratio,
            crop_offset_x,
            crop_offset_y,
            crop_scale,
            crop_w,
            crop_h,
            crop_x,
            crop_y,
            crop_filter,
        },
    );

    let json_str = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(&presets_file, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_trim_preset(file_path: String) -> Result<Option<TrimPreset>, String> {
    let canonical_key = file_path.replace('\\', "/").to_lowercase();
    let presets_file = utils::get_trim_presets_path();

    if !presets_file.exists() {
        return Ok(None);
    }

    let map: std::collections::HashMap<String, TrimPreset> = std::fs::read_to_string(&presets_file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    Ok(map.get(&canonical_key).cloned())
}

#[tauri::command]
pub async fn check_missing_files(file_paths: Vec<String>) -> Vec<String> {
    tokio::task::spawn_blocking(move || {
        file_paths
            .into_iter()
            .filter(|file_path| !std::path::Path::new(file_path).exists())
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub fn get_temp_cache_info() -> utils::CacheInfo {
    utils::get_cache_info()
}

#[tauri::command]
pub fn clear_temp_cache() -> utils::CacheInfo {
    utils::cleanup_temp_dir();
    utils::get_cache_info()
}

#[tauri::command]
pub fn set_custom_temp_dir(path: Option<String>) -> Result<utils::CacheInfo, String> {
    let mut settings = utils::load_app_settings();
    settings.custom_temp_dir = path;
    utils::save_app_settings(&settings)?;
    Ok(utils::get_cache_info())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageValidationResult {
    pub status: String,
    pub free_space_bytes: u64,
    pub required_space_bytes: u64,
}

#[tauri::command]
pub fn validate_trimmer_storage(file_path: String, file_size_bytes: u64) -> StorageValidationResult {
    let mut actual_size = file_size_bytes;
    if actual_size == 0 {
        actual_size = std::fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0);
    }

    let temp_dir = utils::get_temp_dir();
    let free_space = utils::get_disk_free_space(&temp_dir).unwrap_or(u64::MAX);

    let required_space = (actual_size as f64 * 1.2) as u64;
    let five_gb: u64 = 5 * 1024 * 1024 * 1024;
    let ten_gb: u64 = 10 * 1024 * 1024 * 1024;

    let status = if free_space < required_space {
        "HardFailure".to_string()
    } else if free_space < ten_gb {
        "LowStorageWarning".to_string()
    } else if actual_size >= five_gb {
        "LargeFileWarning".to_string()
    } else {
        "CleanPass".to_string()
    };

    StorageValidationResult {
        status,
        free_space_bytes: free_space,
        required_space_bytes: required_space,
    }
}

#[tauri::command]
pub fn validate_extraction_storage(
    output_dir: Option<String>,
    estimated_frame_count: u64,
    bytes_per_frame: u64,
) -> StorageValidationResult {
    let target_dir = output_dir
        .as_deref()
        .map(std::path::PathBuf::from)
        .unwrap_or_else(utils::get_temp_dir);
    let free_space = utils::get_disk_free_space(&target_dir).unwrap_or(u64::MAX);
    let required_space = estimated_frame_count * bytes_per_frame;
    let ten_gb: u64 = 10 * 1024 * 1024 * 1024;

    let status = if free_space < required_space {
        "HardFailure".to_string()
    } else if free_space < ten_gb {
        "LowStorageWarning".to_string()
    } else {
        "CleanPass".to_string()
    };

    StorageValidationResult {
        status,
        free_space_bytes: free_space,
        required_space_bytes: required_space,
    }
}
