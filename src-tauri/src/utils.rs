use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub const CREATE_NO_WINDOW: u32 = 0x08000000;

use std::sync::atomic::{AtomicBool, Ordering};

pub static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn reset_cancel_flag() {
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
}

pub fn check_cancel_flag() -> bool {
    CANCEL_REQUESTED.load(Ordering::SeqCst)
}

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

/// Probes image width and height directly from image file header bytes without external tools.
pub fn get_image_dimensions<P: AsRef<std::path::Path>>(path: P) -> (u32, u32) {
    use std::io::{Read, Seek, SeekFrom};
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = std::io::BufReader::new(file);
    let mut header = [0u8; 32];
    if reader.read_exact(&mut header).is_err() {
        return (0, 0);
    }

    // PNG
    if header.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        let width = u32::from_be_bytes([header[16], header[17], header[18], header[19]]);
        let height = u32::from_be_bytes([header[20], header[21], header[22], header[23]]);
        return (width, height);
    }

    // GIF
    if header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a") {
        let width = u16::from_le_bytes([header[6], header[7]]) as u32;
        let height = u16::from_le_bytes([header[8], header[9]]) as u32;
        return (width, height);
    }

    // BMP
    if header.starts_with(b"BM") {
        let width = u32::from_le_bytes([header[18], header[19], header[20], header[21]]);
        let height = u32::from_le_bytes([header[22], header[23], header[24], header[25]]);
        return (width, height);
    }

    // WEBP (RIFF .... WEBP)
    if header.starts_with(b"RIFF") && &header[8..12] == b"WEBP" {
        if &header[12..16] == b"VP8 " && header.len() >= 30 {
            let width = (u16::from_le_bytes([header[26], header[27]]) & 0x3FFF) as u32;
            let height = (u16::from_le_bytes([header[28], header[29]]) & 0x3FFF) as u32;
            return (width, height);
        } else if &header[12..16] == b"VP8L" && header.len() >= 25 {
            let b0 = header[21] as u32;
            let b1 = header[22] as u32;
            let b2 = header[23] as u32;
            let b3 = header[24] as u32;
            let width = 1 + (((b1 & 0x3F) << 8) | b0);
            let height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
            return (width, height);
        } else if &header[12..16] == b"VP8X" && header.len() >= 30 {
            let width = 1 + (header[24] as u32 | ((header[25] as u32) << 8) | ((header[26] as u32) << 16));
            let height = 1 + (header[27] as u32 | ((header[28] as u32) << 8) | ((header[29] as u32) << 16));
            return (width, height);
        }
    }

    // JPEG
    if header.starts_with(&[0xFF, 0xD8]) {
        let _ = reader.seek(SeekFrom::Start(2));
        let mut buf = [0u8; 4];
        while reader.read_exact(&mut buf[..2]).is_ok() {
            if buf[0] != 0xFF {
                break;
            }
            let marker = buf[1];
            if marker == 0xD9 || marker == 0xDA {
                break;
            }
            if reader.read_exact(&mut buf[2..4]).is_ok() {
                let len = u16::from_be_bytes([buf[2], buf[3]]) as usize;
                if (0xC0..=0xCF).contains(&marker) && marker != 0xC4 && marker != 0xC8 && marker != 0xCC {
                    let mut sof = vec![0u8; len - 2];
                    if reader.read_exact(&mut sof).is_ok() && sof.len() >= 5 {
                        let height = u16::from_be_bytes([sof[1], sof[2]]) as u32;
                        let width = u16::from_be_bytes([sof[3], sof[4]]) as u32;
                        return (width, height);
                    }
                    break;
                } else if len >= 2 {
                    let _ = reader.seek(SeekFrom::Current((len - 2) as i64));
                }
            } else {
                break;
            }
        }
    }

    (0, 0)
}

