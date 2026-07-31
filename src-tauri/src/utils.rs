use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub const CREATE_NO_WINDOW: u32 = 0x08000000;

static LOG_MUTEX: Mutex<()> = Mutex::new(());

/// Creates a std::process::Command with CREATE_NO_WINDOW flag on Windows
pub fn create_hidden_cmd(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Creates a tokio::process::Command with CREATE_NO_WINDOW flag on Windows
pub fn create_tokio_hidden_cmd(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Resolves the dedicated log directory in %LOCALAPPDATA%\Alitken\logs
pub fn get_log_dir() -> PathBuf {
    if let Some(local_dir) = dirs::data_local_dir() {
        let log_dir = local_dir.join("Alitken").join("logs");
        let _ = fs::create_dir_all(&log_dir);
        return log_dir;
    }
    let fallback = PathBuf::from("logs");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

pub fn get_log_file_path() -> PathBuf {
    get_log_dir().join("alitken.log")
}

/// Appends a log entry to alitken.log (caps log file at 5MB)
pub fn write_log(level: &str, message: &str) {
    let _guard = LOG_MUTEX.lock();
    let file_path = get_log_file_path();

    // Check size limit (5MB = 5 * 1024 * 1024 bytes)
    if let Ok(metadata) = fs::metadata(&file_path) {
        if metadata.len() > 5 * 1024 * 1024 {
            // Backup old log and start fresh
            let backup = get_log_dir().join("alitken.old.log");
            let _ = fs::rename(&file_path, backup);
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

fn chrono_now_string() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    format!("{}", secs)
}
