use crate::dependencies::{self, DependencyStatus};
use crate::updater;
use tauri::AppHandle;

#[tauri::command]
pub fn check_app_dependencies() -> DependencyStatus {
    dependencies::check_dependencies()
}

#[tauri::command]
pub async fn install_dependencies<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_ffmpeg_dependencies(&app, 1, 1).await
}

#[tauri::command]
pub async fn install_magick_dependencies<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_magick_dependencies(&app, 1, 1).await
}

#[tauri::command]
pub async fn install_all_dependencies<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_all_dependencies(&app).await
}

#[tauri::command]
pub async fn update_engine<R: tauri::Runtime>(
    app: AppHandle<R>,
    window: tauri::Window,
    target: String,
    download_url: Option<String>,
) -> Result<DependencyStatus, String> {
    match target.to_lowercase().as_str() {
        "ffmpeg" => dependencies::download_ffmpeg_dependencies(&app, 1, 1).await,
        "magick" => dependencies::download_magick_dependencies(&app, 1, 1).await,
        "all" | "appdata" => dependencies::download_all_dependencies(&app).await,
        "app" => {
            let url = match download_url {
                Some(u) if !u.is_empty() => u,
                _ => {
                    let info = updater::check_for_updates().await?;
                    info.download_url
                }
            };
            if url.is_empty() {
                return Err("No download URL found for app update.".to_string());
            }
            updater::download_and_install_update(window, url).await?;
            Ok(dependencies::check_dependencies())
        }
        _ => Err(format!("Unknown update target engine: {}", target)),
    }
}

#[tauri::command]
pub async fn install_to_appdata<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_all_dependencies(&app).await
}

#[tauri::command]
pub fn uninstall_appdata() -> Result<DependencyStatus, String> {
    dependencies::uninstall_appdata()
}
