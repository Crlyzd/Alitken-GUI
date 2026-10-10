use std::fs;
use super::status::{check_dependencies, invalidate_dependency_cache, DependencyStatus};

const MANAGED_BIN_FILES: &[&str] = &[
    "ffmpeg.exe",
    "ffprobe.exe",
    "magick.exe",
    "ffmpeg_download.zip",
    "magick_download.7z",
];

/// Uninstalls Alitken-managed binaries (ffmpeg, ffprobe, magick) and removes %LOCALAPPDATA%/curlyzed/alitken
pub fn uninstall_appdata() -> Result<DependencyStatus, String> {
    if let Some(local_dir) = dirs::data_local_dir() {
        let curlyzed_root = local_dir.join("curlyzed");
        let app_root = curlyzed_root.join("alitken");
        if app_root.exists() {
            let _ = fs::remove_dir_all(&app_root);
        }

        let bin_root = curlyzed_root.join("bin");
        if bin_root.exists() {
            // Delete only Alitken-managed binary files and download artifacts
            for file_name in MANAGED_BIN_FILES {
                let file_path = bin_root.join(file_name);
                if file_path.exists() {
                    let _ = fs::remove_file(&file_path);
                }
            }

            // If the shared bin directory is now completely empty, prune it
            if let Ok(mut entries) = fs::read_dir(&bin_root) {
                if entries.next().is_none() {
                    let _ = fs::remove_dir(&bin_root);
                }
            }
        }

        let legacy_root = local_dir.join("Alitken");
        if legacy_root.exists() {
            let _ = fs::remove_dir_all(&legacy_root);
        }
    }
    invalidate_dependency_cache();
    Ok(check_dependencies())
}
