use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Resolves the root directory for shared curlyzed tools in %LOCALAPPDATA%\curlyzed
pub fn get_curlyzed_root_dir() -> PathBuf {
    if let Some(local_dir) = dirs::data_local_dir() {
        let root = local_dir.join("curlyzed");
        let _ = fs::create_dir_all(&root);
        return root;
    }
    let fallback = PathBuf::from("curlyzed");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

/// Resolves the dedicated, isolated directory for Alitken app data in %LOCALAPPDATA%\curlyzed\alitken
pub fn get_app_data_root_dir() -> PathBuf {
    let app_root = get_curlyzed_root_dir().join("alitken");
    let _ = fs::create_dir_all(&app_root);
    app_root
}

/// Migrates legacy %LOCALAPPDATA%\Alitken directory to %LOCALAPPDATA%\curlyzed structure
pub fn migrate_legacy_alitken_folder() {
    if let Some(local_dir) = dirs::data_local_dir() {
        let legacy_root = local_dir.join("Alitken");
        if !legacy_root.exists() {
            return;
        }

        let new_root = get_curlyzed_root_dir();
        let new_bin_dir = new_root.join("bin");
        let new_app_root = get_app_data_root_dir();

        let _ = fs::create_dir_all(&new_bin_dir);
        let _ = fs::create_dir_all(&new_app_root);

        // 1. Migrate binaries (Alitken\bin\* -> curlyzed\bin\*)
        let legacy_bin = legacy_root.join("bin");
        if legacy_bin.exists() {
            if let Ok(entries) = fs::read_dir(&legacy_bin) {
                for entry in entries.flatten() {
                    let src = entry.path();
                    if let Some(file_name) = src.file_name() {
                        let dest = new_bin_dir.join(file_name);
                        if !dest.exists() {
                            let _ = fs::rename(&src, &dest).or_else(|_| fs::copy(&src, &dest).map(|_| ()));
                        }
                    }
                }
            }
            let _ = fs::remove_dir_all(&legacy_bin);
        }

        // 2. Migrate logs (Alitken\logs\* -> curlyzed\alitken\logs\*)
        let legacy_logs = legacy_root.join("logs");
        if legacy_logs.exists() {
            let new_logs = new_app_root.join("logs");
            let _ = fs::create_dir_all(&new_logs);
            if let Ok(entries) = fs::read_dir(&legacy_logs) {
                for entry in entries.flatten() {
                    let src = entry.path();
                    if let Some(file_name) = src.file_name() {
                        let dest = new_logs.join(file_name);
                        if !dest.exists() {
                            let _ = fs::rename(&src, &dest).or_else(|_| fs::copy(&src, &dest).map(|_| ()));
                        }
                    }
                }
            }
            let _ = fs::remove_dir_all(&legacy_logs);
        }

        // 3. Migrate presets & settings (Alitken\presets\* -> curlyzed\alitken\presets\*)
        let legacy_presets = legacy_root.join("presets");
        if legacy_presets.exists() {
            let new_presets = new_app_root.join("presets");
            let _ = fs::create_dir_all(&new_presets);
            if let Ok(entries) = fs::read_dir(&legacy_presets) {
                for entry in entries.flatten() {
                    let src = entry.path();
                    if let Some(file_name) = src.file_name() {
                        let dest = new_presets.join(file_name);
                        if !dest.exists() {
                            let _ = fs::rename(&src, &dest).or_else(|_| fs::copy(&src, &dest).map(|_| ()));
                        }
                    }
                }
            }
            let _ = fs::remove_dir_all(&legacy_presets);
        }

        // 4. Remove any stale legacy temp
        let legacy_temp = legacy_root.join("temp");
        if legacy_temp.exists() {
            let _ = fs::remove_dir_all(&legacy_temp);
        }

        // 5. Try removing legacy root if empty
        let _ = fs::remove_dir(&legacy_root);
        super::logger::log_info("Migrated legacy %LOCALAPPDATA%\\Alitken to %LOCALAPPDATA%\\curlyzed");
    }
}

/// Resolves the dedicated log directory in %LOCALAPPDATA%\curlyzed\alitken\logs
pub fn get_log_dir() -> PathBuf {
    let log_dir = get_app_data_root_dir().join("logs");
    let _ = fs::create_dir_all(&log_dir);
    log_dir
}

pub fn get_log_file_path() -> PathBuf {
    get_log_dir().join("alitken.log")
}

/// Resolves the dedicated presets directory in %LOCALAPPDATA%\curlyzed\alitken\presets
pub fn get_presets_dir() -> PathBuf {
    let presets_dir = get_app_data_root_dir().join("presets");
    let _ = fs::create_dir_all(&presets_dir);
    presets_dir
}

pub fn get_trim_presets_path() -> PathBuf {
    get_presets_dir().join("trim_presets.json")
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub custom_temp_dir: Option<String>,
}

pub fn get_settings_file_path() -> PathBuf {
    get_presets_dir().join("settings.json")
}

pub fn load_app_settings() -> AppSettings {
    let path = get_settings_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn save_app_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(())
}

/// Given a desired output path, returns it unchanged if it doesn't exist.
/// If it does exist, appends a numeric suffix (_1, _2, ...) until a free
/// slot is found. E.g. `photo.jpg` → `photo_1.jpg` → `photo_2.jpg`.
pub fn resolve_conflict_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let parent = path.parent().unwrap_or(Path::new("."));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().unwrap_or_default().to_string_lossy();
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_{}.{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

pub fn resolve_unique_split_dir(parent: &Path, stem: &str) -> PathBuf {
    let first = parent.join(format!("{}_parts", stem));
    if !first.exists() {
        return first;
    }
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_parts_{}", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

pub fn resolve_unique_frames_dir(parent: &Path, stem: &str) -> PathBuf {
    let first = parent.join(format!("{}_frames", stem));
    if !first.exists() {
        return first;
    }
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_frames_{}", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

pub fn resolve_unique_split_stem(dir: &Path, stem: &str, ext: &str) -> String {
    let probe = dir.join(format!("{}_part001.{}", stem, ext));
    if !probe.exists() {
        return stem.to_string();
    }
    let mut counter = 2u32;
    loop {
        let candidate_stem = format!("{}_{}", stem, counter);
        let probe = dir.join(format!("{}_part001.{}", candidate_stem, ext));
        if !probe.exists() {
            return candidate_stem;
        }
        counter += 1;
    }
}
