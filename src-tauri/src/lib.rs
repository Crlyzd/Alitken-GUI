mod commands;
mod dependencies;
mod ffmpeg;
mod gpu;
mod image;
mod utils;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    utils::log_info("ALITKEN v0.4 application initialized");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_app_dependencies,
            get_initial_files,
            install_dependencies,
            install_magick_dependencies,
            detect_gpu_hardware,
            probe_media_file,
            probe_image_batch,
            start_video_pipeline,
            start_image_pipeline,
            start_image_to_video_pipeline,
            open_log_folder,
            open_folder,
            minimize_window,
            toggle_maximize_window,
            close_window,
            expand_to_working_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
