use crate::dependencies::{self, DependencyStatus};
use crate::ffmpeg::{self, ConversionConfig, MediaMetadata};
use crate::gpu::{self, GpuCapability};
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
pub fn open_log_folder() -> Result<(), String> {
    let log_dir = utils::get_log_dir();
    let _ = utils::create_hidden_cmd("explorer").arg(log_dir).spawn();
    Ok(())
}
