use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

static LOG_MUTEX: Mutex<()> = Mutex::new(());

fn chrono_now_string() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    format!("{}", secs)
}

/// Appends a log entry to alitken.log (caps log file at 5MB)
pub fn write_log(level: &str, message: &str) {
    let _guard = LOG_MUTEX.lock();
    let file_path = super::paths::get_log_file_path();

    // Check size limit (5MB = 5 * 1024 * 1024 bytes)
    if let Ok(metadata) = std::fs::metadata(&file_path) {
        if metadata.len() > 5 * 1024 * 1024 {
            // Backup old log and start fresh
            let backup = super::paths::get_log_dir().join("alitken.old.log");
            let _ = std::fs::rename(&file_path, backup);
        }
    }

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
    {
        let timestamp = chrono_now_string();
        let _ = writeln!(file, "[{}] [{}] {}", timestamp, level, message);
    }
}

pub fn log_info(message: &str) {
    write_log("INFO", message);
}

pub fn log_error(message: &str) {
    write_log("ERROR", message);
}
