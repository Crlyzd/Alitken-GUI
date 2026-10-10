use crate::updater::{self, UpdateInfo};
use crate::win_integration::{self, IntegrationStatus};

/// Reads command line arguments passed on app startup (e.g. from Windows "Send to" menu)
#[tauri::command]
pub fn get_initial_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            let p = std::path::Path::new(arg);
            p.exists() && p.is_file()
        })
        .collect()
}

#[tauri::command]
pub async fn get_system_integration_status() -> IntegrationStatus {
    tokio::task::spawn_blocking(win_integration::get_integration_status)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn set_sendto_status(enable: bool) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || win_integration::set_sendto_shortcut(enable))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn check_app_update() -> Result<UpdateInfo, String> {
    updater::check_for_updates().await
}

#[tauri::command]
pub async fn install_app_update(window: tauri::Window, download_url: String) -> Result<(), String> {
    updater::download_and_install_update(window, download_url).await
}
