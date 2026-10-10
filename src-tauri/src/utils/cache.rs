use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "windows")]
use std::os::windows::fs::OpenOptionsExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInfo {
    pub path: String,
    pub size_bytes: u64,
    pub is_custom: bool,
    pub preserved_active_files: usize,
}

pub struct ActivePreviewLock {
    pub temp_path: PathBuf,
    pub _file_handle: Option<fs::File>,
}

fn get_active_previews() -> &'static Mutex<HashMap<String, ActivePreviewLock>> {
    static ACTIVE_PREVIEWS: OnceLock<Mutex<HashMap<String, ActivePreviewLock>>> = OnceLock::new();
    ACTIVE_PREVIEWS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register_active_preview(source_path: &str, temp_path: PathBuf) {
    if let Ok(mut map) = get_active_previews().lock() {
        #[cfg(target_os = "windows")]
        let file_handle = OpenOptions::new()
            .read(true)
            .share_mode(1) // FILE_SHARE_READ (1)
            .open(&temp_path)
            .ok();

        #[cfg(not(target_os = "windows"))]
        let file_handle = None;

        map.insert(
            source_path.to_string(),
            ActivePreviewLock {
                temp_path,
                _file_handle: file_handle,
            },
        );
    }
}

pub fn unregister_active_preview(source_path: &str) {
    if let Ok(mut map) = get_active_previews().lock() {
        if let Some(removed) = map.remove(source_path) {
            super::logger::log_info(&format!("Released OS file lock for active preview: {:?}", removed.temp_path));
        }
    }
}

pub fn is_temp_file_protected(path: &Path) -> bool {
    if let Ok(map) = get_active_previews().lock() {
        for lock in map.values() {
            if lock.temp_path == path {
                return true;
            }
        }
    }
    false
}

pub fn get_active_preview_count() -> usize {
    if let Ok(map) = get_active_previews().lock() {
        map.len()
    } else {
        0
    }
}

pub fn calculate_dir_size(dir: &Path) -> u64 {
    let mut total_size = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(meta) = fs::metadata(&path) {
                    total_size += meta.len();
                }
            } else if path.is_dir() {
                total_size += calculate_dir_size(&path);
            }
        }
    }
    total_size
}

pub fn get_temp_dir() -> PathBuf {
    let settings = super::paths::load_app_settings();
    if let Some(custom_dir) = settings.custom_temp_dir {
        if !custom_dir.trim().is_empty() {
            let custom_path = PathBuf::from(custom_dir);
            if fs::create_dir_all(&custom_path).is_ok() {
                return custom_path;
            }
        }
    }

    let temp_dir = super::paths::get_app_data_root_dir().join("temp");
    let _ = fs::create_dir_all(&temp_dir);
    temp_dir
}

pub fn get_cache_info() -> CacheInfo {
    let settings = super::paths::load_app_settings();
    let temp_dir = get_temp_dir();
    let is_custom = settings.custom_temp_dir.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
    let size_bytes = calculate_dir_size(&temp_dir);
    CacheInfo {
        path: temp_dir.to_string_lossy().to_string(),
        size_bytes,
        is_custom,
        preserved_active_files: get_active_preview_count(),
    }
}

pub fn cleanup_temp_dir() -> usize {
    let temp_dir = get_temp_dir();
    let mut preserved_count = 0;
    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if is_temp_file_protected(&path) {
                    preserved_count += 1;
                    super::logger::log_info(&format!("Preserving active temp file: {:?}", path));
                    continue;
                }
                if let Err(e) = fs::remove_file(&path) {
                    preserved_count += 1;
                    super::logger::log_info(&format!("Failed to remove locked temp file {:?}: {}", path, e));
                }
            }
        }
    }
    preserved_count
}
