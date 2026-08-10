use crate::dependencies::{self, DependencyStatus};
use crate::ffmpeg::{self, ConversionConfig, ImageToVideoConfig, MediaMetadata, TrimConfig, TrimPreset};
use crate::gpu::{self, GpuCapability};
use crate::image::{self, ImageConversionConfig};
use crate::updater::{self, UpdateInfo};
use crate::utils;
use crate::win_integration::{self, IntegrationStatus};
use tauri::AppHandle;

#[tauri::command]
pub fn check_app_dependencies() -> DependencyStatus {
    dependencies::check_dependencies()
}

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


#[tauri::command]
pub async fn detect_gpu_hardware(codec_choice: String, ffmpeg_path: String) -> GpuCapability {
    tokio::task::spawn_blocking(move || {
        let path = if ffmpeg_path.is_empty() {
            dependencies::check_dependencies().ffmpeg_path
        } else {
            ffmpeg_path
        };

        gpu::get_gpu_encoder(&codec_choice, &path)
    })
    .await
    .unwrap_or_else(|_| GpuCapability {
        hardware_name: "CPU (Software)".to_string(),
        encoder: "libx264".to_string(),
        encoder_args: "-preset fast".to_string(),
        extension: "mp4".to_string(),
        details: Some("Async spawn error".to_string()),
    })
}

#[tauri::command]
pub async fn probe_media_file(ffprobe_path: String, file_path: String) -> Result<MediaMetadata, String> {
    let path = if ffprobe_path.is_empty() {
        dependencies::check_dependencies().ffprobe_path
    } else {
        ffprobe_path
    };

    ffmpeg::probe_file(&path, &file_path).await
}

#[tauri::command]
pub fn probe_image_batch(file_paths: Vec<String>) -> Vec<MediaMetadata> {
    file_paths
        .into_iter()
        .map(|file_path| {
            let path = std::path::Path::new(&file_path);
            let file_name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let size = std::fs::metadata(&file_path)
                .map(|m| m.len() as f64)
                .unwrap_or(0.0);
            let (width, height) = utils::get_image_dimensions(&file_path);
            MediaMetadata {
                file_name,
                file_path: file_path.clone(),
                duration_sec: 0.0,
                total_frames: 0.0,
                codec_name: "image".to_string(),
                audio_codec: String::new(),
                width,
                height,
                file_size_mb: size / (1024.0 * 1024.0),
                is_video: false,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn start_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_video_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config, gpu_caps).await
}

#[tauri::command]
pub async fn start_image_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ImageConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.magick_exists {
        return Err("ImageMagick (magick.exe) binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.magick_valid {
        return Err(format!(
            "ImageMagick version ({}) is below the required version 7.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.magick_version
        ));
    }

    image::run_image_pipeline(&app, &deps.magick_path, config).await
}

#[tauri::command]
pub async fn start_image_to_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ImageToVideoConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists {
        return Err("FFmpeg binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");
    let needs_magick = mode != "SEQUENCE"
        && config
            .input_files
            .iter()
            .any(|p| !ffmpeg::is_ffmpeg_native_image_format(p));

    if needs_magick && !deps.magick_exists {
        return Err(
            "ImageMagick (magick.exe) binary not found and is required for non-standard image formats. Please install it in Settings."
                .to_string(),
        );
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_image_to_video_pipeline(
        &app,
        &deps.ffmpeg_path,
        &deps.ffprobe_path,
        &deps.magick_path,
        config,
        gpu_caps,
    )
    .await
}

#[tauri::command]
pub async fn start_trim_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: TrimConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_trim_video_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config, gpu_caps).await
}

#[tauri::command]
pub async fn prepare_video_preview(file_path: String) -> Result<String, String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }

    ffmpeg::prepare_preview_video(&deps.ffmpeg_path, &deps.ffprobe_path, &file_path).await
}

#[tauri::command]
pub async fn cancel_preview_video(file_path: String) -> Result<(), String> {
    ffmpeg::cancel_preview_video(&file_path).await;
    Ok(())
}

#[tauri::command]
pub async fn get_video_frame_preview(file_path: String, timestamp_sec: f64) -> Result<String, String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists {
        return Err("FFmpeg binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }

    ffmpeg::extract_frame_base64_hwaccel(&deps.ffmpeg_path, &file_path, timestamp_sec).await
}

#[tauri::command]
pub fn save_trim_preset(
    file_path: String,
    start_sec: f64,
    end_sec: f64,
    fast_copy: bool,
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
pub fn open_log_folder() -> Result<(), String> {
    let log_dir = utils::get_log_dir();
    let _ = utils::create_hidden_cmd("explorer").arg(log_dir).spawn();
    Ok(())
}

#[tauri::command]
pub fn open_folder(folder_path: String) -> Result<(), String> {
    if folder_path.is_empty() {
        return Err("Folder path is empty".to_string());
    }
    let normalized_path = folder_path.replace('/', "\\");
    let path = std::path::Path::new(&normalized_path);
    if !path.exists() {
        let _ = std::fs::create_dir_all(path);
    }
    let _ = utils::create_hidden_cmd("explorer").arg(&normalized_path).spawn();
    Ok(())
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_always_on_top(window: tauri::Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}


/// Expands the fixed startup window (560×440, non-resizable) into the full
/// working state (980×700, resizable, min 840×580). Called from the frontend
/// exactly once — when the first file batch is loaded via handleAddFiles.
/// Window expands in-place; position is NOT changed so the user's placement
/// is respected.
#[tauri::command]
pub fn expand_to_working_window(window: tauri::Window) -> Result<(), String> {
    use tauri::LogicalSize;
    // 1. Re-enable resize FIRST so min_size and set_size take effect.
    window.set_resizable(true).map_err(|e| e.to_string())?;
    // 2. Apply working-state minimum constraints to prevent control wrapping.
    window
        .set_min_size(Some(LogicalSize::new(1040u32, 700u32)))
        .map_err(|e| e.to_string())?;
    // 3. Expand to the full working dimensions in-place.
    window
        .set_size(LogicalSize::new(1060u32, 720u32))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Collapses the working window (980×700, resizable, min 840×580) back to the
/// fixed startup state (560×440, non-resizable). Called from the frontend when
/// the file queue is cleared (via "Clear All" or last-file removal).
/// Ordering is critical: disable resize → clear min-size → apply startup size,
/// otherwise Tauri clamps the new size to the existing 840×580 floor.
#[tauri::command]
pub fn collapse_to_startup_window(window: tauri::Window) -> Result<(), String> {
    use tauri::LogicalSize;
    // 1. Lock resize FIRST so the window can shrink below the working min-size.
    window.set_resizable(false).map_err(|e| e.to_string())?;
    // 2. Clear the working-state minimum constraints.
    window
        .set_min_size(None::<LogicalSize<u32>>)
        .map_err(|e| e.to_string())?;
    // 3. Restore fixed startup dimensions.
    window
        .set_size(LogicalSize::new(560u32, 440u32))
        .map_err(|e| e.to_string())?;
    Ok(())
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
pub async fn abort_processing() -> Result<(), String> {
    utils::CANCEL_REQUESTED.store(true, std::sync::atomic::Ordering::SeqCst);
    utils::log_info("Abort processing requested by user");

    // Immediately kill active child processes
    let _ = utils::create_hidden_cmd("taskkill")
        .args(&["/F", "/IM", "ffmpeg.exe", "/IM", "magick.exe", "/IM", "ffprobe.exe"])
        .status();

    Ok(())
}

#[tauri::command]
pub async fn check_app_update() -> Result<UpdateInfo, String> {
    updater::check_for_updates().await
}

#[tauri::command]
pub async fn install_app_update(window: tauri::Window, download_url: String) -> Result<(), String> {
    updater::download_and_install_update(window, download_url).await
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

#[tauri::command]
pub fn check_wmf_support(file_path: String) -> bool {
    crate::wmf::check_support(&file_path)
}

#[tauri::command]
pub async fn get_wmf_frame_preview(
    file_path: String,
    timestamp_sec: f64,
    max_width: Option<u32>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        crate::wmf::extract_frame(&file_path, timestamp_sec, max_width)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_wmf_filmstrip(
    file_path: String,
    count: Option<usize>,
) -> Result<Vec<String>, String> {
    let count_val = count.unwrap_or(8);
    let fp = file_path.clone();
    let wmf_res = tokio::task::spawn_blocking(move || {
        crate::wmf::extract_filmstrip(&fp, count_val)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Ok(ref strip) = wmf_res {
        if !strip.is_empty() {
            return wmf_res;
        }
    }

    // Fallback to FFmpeg CLI filmstrip extraction for non-WMF formats (.mkv, .webm)
    let deps = dependencies::check_dependencies();
    if deps.ffmpeg_exists && deps.ffprobe_exists {
        return ffmpeg::extract_ffmpeg_filmstrip(&deps.ffmpeg_path, &deps.ffprobe_path, &file_path, count_val).await;
    }

    Ok(Vec::new())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
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

