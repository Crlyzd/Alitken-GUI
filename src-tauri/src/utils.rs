use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
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

/// Resolves the dedicated presets directory in %LOCALAPPDATA%\Alitken\presets
pub fn get_presets_dir() -> PathBuf {
    if let Some(local_dir) = dirs::data_local_dir() {
        let presets_dir = local_dir.join("Alitken").join("presets");
        let _ = fs::create_dir_all(&presets_dir);
        return presets_dir;
    }
    let fallback = PathBuf::from("presets");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

pub fn get_trim_presets_path() -> PathBuf {
    get_presets_dir().join("trim_presets.json")
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub custom_temp_dir: Option<String>,
}

#[cfg(target_os = "windows")]
use std::os::windows::fs::OpenOptionsExt;

use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInfo {
    pub path: String,
    pub size_bytes: u64,
    pub is_custom: bool,
    pub preserved_active_files: usize,
}

pub struct ActivePreviewLock {
    pub temp_path: PathBuf,
    pub _file_handle: Option<fs::File>,
}

fn get_active_previews() -> &'static Mutex<HashMap<String, ActivePreviewLock>> {
    static ACTIVE_PREVIEWS: OnceLock<Mutex<HashMap<String, ActivePreviewLock>>> = OnceLock::new();
    ACTIVE_PREVIEWS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register_active_preview(source_path: &str, temp_path: PathBuf) {
    if let Ok(mut map) = get_active_previews().lock() {
        #[cfg(target_os = "windows")]
        let file_handle = OpenOptions::new()
            .read(true)
            .share_mode(1) // FILE_SHARE_READ (1) - excludes FILE_SHARE_DELETE so Explorer cannot manually delete active file
            .open(&temp_path)
            .ok();

        #[cfg(not(target_os = "windows"))]
        let file_handle = None;

        map.insert(
            source_path.to_string(),
            ActivePreviewLock {
                temp_path,
                _file_handle: file_handle,
            },
        );
    }
}

pub fn unregister_active_preview(source_path: &str) {
    if let Ok(mut map) = get_active_previews().lock() {
        if let Some(removed) = map.remove(source_path) {
            log_info(&format!("Released OS file lock for active preview: {:?}", removed.temp_path));
        }
    }
}

pub fn is_temp_file_protected(path: &Path) -> bool {
    if let Ok(map) = get_active_previews().lock() {
        for lock in map.values() {
            if lock.temp_path == path {
                return true;
            }
        }
    }
    false
}

pub fn get_active_preview_count() -> usize {
    if let Ok(map) = get_active_previews().lock() {
        map.len()
    } else {
        0
    }
}

pub fn get_settings_file_path() -> PathBuf {
    get_presets_dir().join("settings.json")
}

pub fn load_app_settings() -> AppSettings {
    let path = get_settings_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn save_app_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(())
}

pub fn calculate_dir_size(dir: &Path) -> u64 {
    let mut total_size = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(meta) = fs::metadata(&path) {
                    total_size += meta.len();
                }
            } else if path.is_dir() {
                total_size += calculate_dir_size(&path);
            }
        }
    }
    total_size
}

pub fn get_cache_info() -> CacheInfo {
    let settings = load_app_settings();
    let temp_dir = get_temp_dir();
    let is_custom = settings.custom_temp_dir.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
    let size_bytes = calculate_dir_size(&temp_dir);
    CacheInfo {
        path: temp_dir.to_string_lossy().to_string(),
        size_bytes,
        is_custom,
        preserved_active_files: get_active_preview_count(),
    }
}

/// Resolves the dedicated temporary cache directory in %LOCALAPPDATA%\Alitken\temp or custom folder
pub fn get_temp_dir() -> PathBuf {
    let settings = load_app_settings();
    if let Some(custom_dir) = settings.custom_temp_dir {
        if !custom_dir.trim().is_empty() {
            let custom_path = PathBuf::from(custom_dir);
            if fs::create_dir_all(&custom_path).is_ok() {
                return custom_path;
            }
        }
    }

    if let Some(local_dir) = dirs::data_local_dir() {
        let temp_dir = local_dir.join("Alitken").join("temp");
        let _ = fs::create_dir_all(&temp_dir);
        return temp_dir;
    }
    let fallback = PathBuf::from("temp");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

/// Purges all temporary preview files in the temp directory, skipping protected/active files
pub fn cleanup_temp_dir() -> usize {
    let temp_dir = get_temp_dir();
    let mut preserved_count = 0;
    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if is_temp_file_protected(&path) {
                    preserved_count += 1;
                    log_info(&format!("Preserving active temp file: {:?}", path));
                    continue;
                }
                if let Err(e) = fs::remove_file(&path) {
                    preserved_count += 1;
                    log_info(&format!("Failed to remove locked temp file {:?}: {}", path, e));
                }
            }
        }
    }
    preserved_count
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

// ---------------------------------------------------------------------------
// Output file conflict resolution — single source of truth for all pipelines
// ---------------------------------------------------------------------------

/// Given a desired output path, returns it unchanged if it doesn't exist.
/// If it does exist, appends a numeric suffix (_1, _2, ...) until a free
/// slot is found. E.g. `photo.jpg` → `photo_1.jpg` → `photo_2.jpg`.
pub fn resolve_conflict_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let parent = path.parent().unwrap_or(Path::new("."));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().unwrap_or_default().to_string_lossy();
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_{}.{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// For video split with **no custom output dir** (segments go next to source file).
/// Returns a unique sub-folder path for the split batch so segments are grouped
/// and the source directory stays clean.
/// E.g. first run: `parent/MyStem_parts/`, second run: `parent/MyStem_parts_1/`.
pub fn resolve_unique_split_dir(parent: &Path, stem: &str) -> PathBuf {
    let first = parent.join(format!("{}_parts", stem));
    if !first.exists() {
        return first;
    }
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_parts_{}", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// For bulk frame extraction: returns a unique `<video_stem>_frames/` sub-folder path.
/// E.g. `parent/MyVideo_frames/`, `parent/MyVideo_frames_1/`, etc.
pub fn resolve_unique_frames_dir(parent: &Path, stem: &str) -> PathBuf {
    let first = parent.join(format!("{}_frames", stem));
    if !first.exists() {
        return first;
    }
    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{}_frames_{}", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// For video split with a **custom output dir chosen by the user**.
/// Files must stay flat inside that folder (no nested sub-dirs).
/// Returns a deconflicted stem prefix to plug into FFmpeg's `%03d` pattern.
/// E.g. if `MyStem_part001.mp4` exists → returns `"MyStem_2"`,
/// so the pattern becomes `MyStem_2_part%03d.mp4`.
pub fn resolve_unique_split_stem(dir: &Path, stem: &str, ext: &str) -> String {
    let probe = dir.join(format!("{}_part001.{}", stem, ext));
    if !probe.exists() {
        return stem.to_string();
    }
    let mut counter = 2u32;
    loop {
        let candidate_stem = format!("{}_{}", stem, counter);
        let probe = dir.join(format!("{}_part001.{}", candidate_stem, ext));
        if !probe.exists() {
            return candidate_stem;
        }
        counter += 1;
    }
}

/// Queries available free bytes on the disk partition containing the given path.
#[cfg(target_os = "windows")]
pub fn get_disk_free_space(path: &Path) -> Result<u64, String> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let mut path_buf = path.to_path_buf();
    if path_buf.is_file() {
        if let Some(parent) = path_buf.parent() {
            path_buf = parent.to_path_buf();
        }
    }

    let wpath: Vec<u16> = path_buf
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    let ret = unsafe {
        GetDiskFreeSpaceExW(
            wpath.as_ptr(),
            &mut free_bytes_available,
            &mut total_bytes,
            &mut total_free_bytes,
        )
    };

    if ret != 0 {
        Ok(free_bytes_available)
    } else {
        Err("Failed to query disk free space".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_disk_free_space(_path: &Path) -> Result<u64, String> {
    Ok(u64::MAX)
}

