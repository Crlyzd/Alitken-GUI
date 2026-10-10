use crate::utils;

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
pub fn show_in_folder(file_path: String) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("File path is empty".to_string());
    }
    let normalized = file_path.replace('/', "\\");
    let path = std::path::Path::new(&normalized);
    if path.exists() {
        let _ = utils::create_hidden_cmd("explorer").arg("/select,").arg(&normalized).spawn();
    } else if let Some(parent) = path.parent() {
        let _ = utils::create_hidden_cmd("explorer").arg(parent).spawn();
    } else {
        return Err("File path or folder does not exist".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn open_file(file_path: String) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("File path is empty".to_string());
    }
    let normalized = file_path.replace('/', "\\");
    if std::path::Path::new(&normalized).exists() {
        let _ = utils::create_hidden_cmd("cmd").args(&["/C", "start", "", &normalized]).spawn();
        Ok(())
    } else {
        Err("File not found on disk".to_string())
    }
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    let res = window.minimize().map_err(|e| e.to_string());
    utils::trim_working_set();
    res
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

/// Expands the fixed startup window (500×500) into the full working state
/// (1060×720, resizable, min 1040×700). Called from the frontend exactly once
/// when the first file batch is loaded via handleAddFiles.
#[tauri::command]
pub fn expand_to_working_window(window: tauri::Window) -> Result<(), String> {
    use tauri::LogicalSize;
    crate::window::set_startup_resize_locked(&window, false);
    window
        .set_max_size(None::<LogicalSize<u32>>)
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(LogicalSize::new(1040u32, 700u32)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(LogicalSize::new(1060u32, 720u32))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Collapses the working window back to the fixed 1:1 startup state (500×500).
/// Called from the frontend when the file queue is cleared (via "Clear All" or last-file removal).
#[tauri::command]
pub fn collapse_to_startup_window(window: tauri::Window) -> Result<(), String> {
    use tauri::LogicalSize;
    window
        .set_min_size(None::<LogicalSize<u32>>)
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(None::<LogicalSize<u32>>)
        .map_err(|e| e.to_string())?;
    window
        .set_size(LogicalSize::new(500u32, 500u32))
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(LogicalSize::new(500u32, 500u32)))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(LogicalSize::new(500u32, 500u32)))
        .map_err(|e| e.to_string())?;
    crate::window::set_startup_resize_locked(&window, true);
    utils::trim_working_set();
    Ok(())
}

#[tauri::command]
pub async fn abort_processing() -> Result<(), String> {
    utils::CANCEL_REQUESTED.store(true, std::sync::atomic::Ordering::SeqCst);
    utils::log_info("Abort processing requested by user");

    let _ = utils::create_hidden_cmd("taskkill")
        .args(&["/F", "/IM", "ffmpeg.exe", "/IM", "magick.exe", "/IM", "ffprobe.exe"])
        .status();

    Ok(())
}

#[tauri::command]
pub fn trim_memory() {
    utils::trim_working_set();
}
