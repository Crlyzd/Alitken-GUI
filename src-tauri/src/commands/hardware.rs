use crate::dependencies;
use crate::gpu::{self, GpuCapability};

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
