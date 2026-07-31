mod commands;
mod dependencies;
mod ffmpeg;
mod gpu;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_app_dependencies,
            install_dependencies,
            detect_gpu_hardware,
            probe_media_file,
            start_video_pipeline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
