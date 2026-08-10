mod commands;
mod dependencies;
mod ffmpeg;
mod gpu;
mod image;
mod updater;
mod utils;
mod win_integration;
mod wmf;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    utils::log_info(&format!("ALITKEN v{} application initialized", env!("CARGO_PKG_VERSION")));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Clean up lingering ALITKEN.exe.old from previous 1-click update
            updater::cleanup_old_version();
            // Clean up temporary preview files from previous sessions
            utils::cleanup_temp_dir();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_app_dependencies,
            get_initial_files,
            install_dependencies,
            install_magick_dependencies,
            install_all_dependencies,
            update_engine,
            detect_gpu_hardware,
            probe_media_file,
            probe_image_batch,
            start_video_pipeline,
            start_trim_video_pipeline,
            prepare_video_preview,
            cancel_preview_video,
            get_video_frame_preview,
            save_trim_preset,
            load_trim_preset,
            start_image_pipeline,
            start_image_to_video_pipeline,
            open_log_folder,
            open_folder,
            minimize_window,
            toggle_maximize_window,
            close_window,
            set_always_on_top,
            expand_to_working_window,
            collapse_to_startup_window,
            get_system_integration_status,
            set_sendto_status,
            abort_processing,
            check_app_update,
            install_app_update,
            check_missing_files,
            install_to_appdata,
            uninstall_appdata,
            get_temp_cache_info,
            clear_temp_cache,
            set_custom_temp_dir,
            check_wmf_support,
            get_wmf_frame_preview,
            get_wmf_filmstrip,
            validate_trimmer_storage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
