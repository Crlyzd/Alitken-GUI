use crate::dependencies::{self, DependencyStatus};
use crate::ffmpeg::{self, ConversionConfig, ImageToVideoConfig, MediaMetadata};
use crate::gpu::{self, GpuCapability};
use crate::image::{self, ImageConversionConfig};
use crate::utils;
use tauri::AppHandle;

#[tauri::command]
pub fn check_app_dependencies() -> DependencyStatus {
    dependencies::check_dependencies()
}

#[tauri::command]
pub async fn install_dependencies<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_ffmpeg_dependencies(&app).await
}

#[tauri::command]
pub async fn install_magick_dependencies<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<DependencyStatus, String> {
    dependencies::download_magick_dependencies(&app).await
}

#[tauri::command]
pub fn detect_gpu_hardware(codec_choice: String, ffmpeg_path: String) -> GpuCapability {
    let path = if ffmpeg_path.is_empty() {
        dependencies::check_dependencies().ffmpeg_path
    } else {
        ffmpeg_path
    };

    gpu::get_gpu_encoder(&codec_choice, &path)
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
pub async fn start_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please install them first.".to_string());
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
        return Err("ImageMagick (magick.exe) binary not found. Please install it first.".to_string());
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
        return Err("FFmpeg binary not found. Please install it first.".to_string());
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");
    let needs_magick = mode != "SEQUENCE"
        && config
            .input_files
            .iter()
            .any(|p| !ffmpeg::is_ffmpeg_native_image_format(p));

    if needs_magick && !deps.magick_exists {
        return Err(
            "ImageMagick (magick.exe) binary not found and is required for non-standard image formats. Please install it first."
                .to_string(),
        );
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_image_to_video_pipeline(&app, &deps.ffmpeg_path, &deps.magick_path, config, gpu_caps).await
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
    let path = std::path::Path::new(&folder_path);
    if !path.exists() {
        let _ = std::fs::create_dir_all(path);
    }
    let _ = utils::create_hidden_cmd("explorer").arg(&folder_path).spawn();
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
    // 2. Apply working-state minimum constraints.
    window
        .set_min_size(Some(LogicalSize::new(840u32, 580u32)))
        .map_err(|e| e.to_string())?;
    // 3. Expand to the full working dimensions in-place.
    window
        .set_size(LogicalSize::new(980u32, 700u32))
        .map_err(|e| e.to_string())?;
    Ok(())
}
