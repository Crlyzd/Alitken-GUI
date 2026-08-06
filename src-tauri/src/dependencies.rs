use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ffmpeg_exists: bool,
    pub ffprobe_exists: bool,
    pub magick_exists: bool,
    pub ffmpeg_valid: bool,
    pub magick_valid: bool,
    pub ffmpeg_version: String,
    pub ffprobe_version: String,
    pub magick_version: String,
    pub path_ffmpeg_version: String,
    pub path_magick_version: String,
    pub has_newer_path_ffmpeg: bool,
    pub has_update: bool,
    pub active_location: String,
    pub appdata_path: String,
    pub ffmpeg_path: String,
    pub ffprobe_path: String,
    pub magick_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub status: String,
    pub percent: f64,
    pub speed_mbps: f64,
    pub downloaded_mb: f64,
    pub total_mb: f64,
    pub current_step: usize,
    pub total_steps: usize,
}

pub fn get_appdata_bin_dir() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        let app_bin = data_dir.join("Alitken").join("bin");
        let _ = fs::create_dir_all(&app_bin);
        return app_bin;
    }
    PathBuf::from("bin")
}

pub fn get_portable_bin_dir() -> PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let bin = parent.join("bin");
            if let Ok(_) = fs::create_dir_all(&bin) {
                return bin;
            }
        }
    }
    get_appdata_bin_dir()
}

pub fn get_local_bin_dir() -> PathBuf {
    let appdata = get_appdata_bin_dir();
    let appdata_ffmpeg = appdata.join("ffmpeg.exe");
    if appdata_ffmpeg.exists() {
        let (_, maj, _) = probe_binary_version(&appdata_ffmpeg.to_string_lossy());
        if maj >= 5 || maj == 999 {
            // AppData has valid binary -> AppData priority wins!
            return appdata;
        }
    }

    let portable = get_portable_bin_dir();
    if portable.join("ffmpeg.exe").exists() || portable.join("magick.exe").exists() {
        return portable;
    }

    if appdata.join("ffmpeg.exe").exists() || appdata.join("magick.exe").exists() {
        return appdata;
    }

    // Default target for new installs is AppData (safest)
    appdata
}

pub fn probe_binary_version(binary_path: &str) -> (String, u32, u32) {
    if binary_path.is_empty() || !Path::new(binary_path).exists() {
        return (String::new(), 0, 0);
    }

    let output = match crate::utils::create_hidden_cmd(binary_path)
        .arg("-version")
        .output()
    {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => return (String::new(), 0, 0),
    };

    let lower = output.to_lowercase();
    if let Some(idx) = lower.find("version") {
        let substring = &output[idx..];
        for word in substring.split_whitespace() {
            let clean = word.trim_matches(|c: char| !c.is_numeric() && c != '.');
            if clean.contains('.') {
                let parts: Vec<&str> = clean.split('.').collect();
                if let (Ok(maj), Ok(min)) = (
                    parts[0].parse::<u32>(),
                    parts.get(1).unwrap_or(&"0").parse::<u32>(),
                ) {
                    return (clean.to_string(), maj, min);
                }
            }
        }
    }

    if lower.contains("ffmpeg") || lower.contains("imagemagick") {
        return ("Latest".to_string(), 999, 0);
    }

    (String::new(), 0, 0)
}

/// Resolves paths for ffmpeg, ffprobe, and magick binaries in local bin/ or system PATH
pub fn check_dependencies() -> DependencyStatus {
    let local_bin = get_local_bin_dir();

    let ffmpeg_path = resolve_binary(&local_bin, "ffmpeg.exe", "ffmpeg");
    let ffprobe_path = resolve_binary(&local_bin, "ffprobe.exe", "ffprobe");
    let magick_path = resolve_binary(&local_bin, "magick.exe", "magick");

    let (ffmpeg_version, ffmpeg_maj, ffmpeg_min) = probe_binary_version(&ffmpeg_path);
    let (ffprobe_version, _, _) = probe_binary_version(&ffprobe_path);
    let (magick_version, magick_maj, _) = probe_binary_version(&magick_path);

    let ffmpeg_exists = !ffmpeg_path.is_empty();
    let ffprobe_exists = !ffprobe_path.is_empty();
    let magick_exists = !magick_path.is_empty();

    let ffmpeg_valid = ffmpeg_exists && (ffmpeg_maj >= 5 || ffmpeg_maj == 0 || ffmpeg_maj == 999);
    let magick_valid = magick_exists && (magick_maj >= 7 || magick_maj == 0 || magick_maj == 999);

    let portable_bin = get_portable_bin_dir();
    let appdata_bin = get_appdata_bin_dir();
    let appdata_path = appdata_bin.to_string_lossy().to_string();

    let active_location = if ffmpeg_path.starts_with(&appdata_bin.to_string_lossy().to_string()) {
        "AppData".to_string()
    } else if ffmpeg_path.starts_with(&portable_bin.to_string_lossy().to_string()) {
        "".to_string() // App Folder: No extra location tag in UI!
    } else if ffmpeg_exists {
        "System PATH".to_string()
    } else {
        "Missing".to_string()
    };

    let mut path_ffmpeg_version = String::new();
    let mut path_magick_version = String::new();
    let mut has_newer_path_ffmpeg = false;

    if active_location != "System PATH" {
        if let Ok(sys_path) = which::which("ffmpeg") {
            let sys_path_str = sys_path.to_string_lossy().to_string();
            let (sys_ver, sys_maj, sys_min) = probe_binary_version(&sys_path_str);
            path_ffmpeg_version = sys_ver;
            if (sys_maj, sys_min) > (ffmpeg_maj, ffmpeg_min) && ffmpeg_maj != 999 {
                has_newer_path_ffmpeg = true;
            }
        }
        if let Ok(sys_path) = which::which("magick") {
            let sys_path_str = sys_path.to_string_lossy().to_string();
            let (sys_ver, _, _) = probe_binary_version(&sys_path_str);
            path_magick_version = sys_ver;
        }
    }

    let has_update = has_newer_path_ffmpeg || (ffmpeg_maj > 0 && ffmpeg_maj < 7);

    DependencyStatus {
        ffmpeg_exists,
        ffprobe_exists,
        magick_exists,
        ffmpeg_valid,
        magick_valid,
        ffmpeg_version,
        ffprobe_version,
        magick_version,
        path_ffmpeg_version,
        path_magick_version,
        has_newer_path_ffmpeg,
        has_update,
        active_location,
        appdata_path,
        ffmpeg_path,
        ffprobe_path,
        magick_path,
    }
}

fn resolve_binary(local_bin: &Path, exe_name: &str, cmd_name: &str) -> String {
    let local_file = local_bin.join(exe_name);
    if local_file.exists() {
        return local_file.to_string_lossy().to_string();
    }

    // Search PATH
    if let Ok(path) = which::which(cmd_name) {
        return path.to_string_lossy().to_string();
    }

    String::new()
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    #[serde(default)]
    name: String,
    #[serde(default)]
    browser_download_url: String,
}

/// Dynamically resolves the latest FFmpeg portable release zip URL from BtbN GitHub API
async fn fetch_latest_ffmpeg_url(client: &reqwest::Client) -> String {
    let fallback_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip".to_string();
    let api_url = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";

    let res = match client.get(api_url).send().await {
        Ok(res) if res.status().is_success() => res,
        _ => return fallback_url,
    };

    let release: GitHubRelease = match res.json().await {
        Ok(rel) => rel,
        Err(_) => return fallback_url,
    };

    // Filter for win64-gpl zip asset (prefer latest release build)
    for asset in &release.assets {
        let name_lower = asset.name.to_lowercase();
        if name_lower.ends_with(".zip")
            && name_lower.contains("win64-gpl")
            && !name_lower.contains("shared")
        {
            return asset.browser_download_url.clone();
        }
    }

    fallback_url
}

/// Dynamically resolves the latest ImageMagick portable release 7z URL from ImageMagick GitHub API
async fn fetch_latest_magick_url(client: &reqwest::Client) -> String {
    let fallback_url = "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-29/ImageMagick-7.1.2-29-portable-Q16-x64.7z".to_string();
    let api_url = "https://api.github.com/repos/ImageMagick/ImageMagick/releases/latest";

    let res = match client.get(api_url).send().await {
        Ok(res) if res.status().is_success() => res,
        _ => return fallback_url,
    };

    let release: GitHubRelease = match res.json().await {
        Ok(rel) => rel,
        Err(_) => return fallback_url,
    };

    for asset in &release.assets {
        let name_lower = asset.name.to_lowercase();
        if name_lower.ends_with(".7z")
            && name_lower.contains("portable")
            && name_lower.contains("x64")
        {
            return asset.browser_download_url.clone();
        }
    }

    fallback_url
}

fn resolve_target_dir(target_choice: Option<&str>) -> PathBuf {
    match target_choice {
        Some("Portable") => get_portable_bin_dir(),
        Some("AppData") => get_appdata_bin_dir(),
        _ => get_local_bin_dir(),
    }
}

/// Asynchronously downloads portable FFmpeg release zip directly from BtbN GitHub releases
pub async fn download_ffmpeg_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    current_step: usize,
    total_steps: usize,
    target_choice: Option<&str>,
) -> Result<DependencyStatus, String> {
    crate::utils::reset_cancel_flag();

    let client = reqwest::Client::builder()
        .user_agent("AlitkenMediaConverter/2.0")
        .build()
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Fetching latest FFmpeg release info from BtbN GitHub...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
            current_step,
            total_steps,
        },
    );

    let download_url = fetch_latest_ffmpeg_url(&client).await;
    let target_dir = resolve_target_dir(target_choice);
    let zip_path = target_dir.join("ffmpeg_download.zip");

    // Clean up any stale partial zip from previous attempts
    if zip_path.exists() {
        let _ = fs::remove_file(&zip_path);
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Connecting to GitHub releases...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
            current_step,
            total_steps,
        },
    );

    let res = match client.get(&download_url).send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = fs::remove_file(&zip_path);
            return Err(format!("Failed to initiate download: {}", e));
        }
    };

    let total_size = res.content_length().unwrap_or(0);
    let mut file = match tokio::fs::File::create(&zip_path).await {
        Ok(f) => f,
        Err(e) => {
            let _ = fs::remove_file(&zip_path);
            return Err(format!("Failed to create zip file: {}", e));
        }
    };

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk_result) = stream.next().await {
        if crate::utils::check_cancel_flag() {
            drop(file);
            let _ = fs::remove_file(&zip_path);
            return Err("Download aborted by user.".to_string());
        }
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                drop(file);
                let _ = fs::remove_file(&zip_path);
                return Err(format!("Download stream error: {}", e));
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            drop(file);
            let _ = fs::remove_file(&zip_path);
            return Err(format!("Write error: {}", e));
        }

        downloaded += chunk.len() as u64;

        let elapsed = start_time.elapsed().as_secs_f64();
        let speed_mbps = if elapsed > 0.0 {
            (downloaded as f64 / (1024.0 * 1024.0)) / elapsed
        } else {
            0.0
        };

        let percent = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                status: "Downloading FFmpeg portable binaries...".to_string(),
                percent,
                speed_mbps,
                downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
                total_mb: total_size as f64 / (1024.0 * 1024.0),
                current_step,
                total_steps,
            },
        );
    }

    if let Err(e) = file.flush().await {
        drop(file);
        let _ = fs::remove_file(&zip_path);
        return Err(format!("Flush error: {}", e));
    }
    drop(file);

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Extracting portable binaries to local bin/ folder...".to_string(),
            percent: 100.0,
            speed_mbps: 0.0,
            downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
            total_mb: total_size as f64 / (1024.0 * 1024.0),
            current_step,
            total_steps,
        },
    );

    // Extract zip
    let zip_file = match fs::File::open(&zip_path) {
        Ok(f) => f,
        Err(e) => {
            let _ = fs::remove_file(&zip_path);
            return Err(format!("Open zip failed: {}", e));
        }
    };

    let mut archive = match zip::ZipArchive::new(zip_file) {
        Ok(a) => a,
        Err(e) => {
            let _ = fs::remove_file(&zip_path);
            return Err(format!("Archive read error: {}", e));
        }
    };

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                let _ = fs::remove_file(&zip_path);
                return Err(format!("Zip file index error: {}", e));
            }
        };

        let filename = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        if filename.file_name() == Some(std::ffi::OsStr::new("ffmpeg.exe"))
            || filename.file_name() == Some(std::ffi::OsStr::new("ffprobe.exe"))
        {
            if let Some(target_file_name) = filename.file_name() {
                let outpath = target_dir.join(target_file_name);
                let mut outfile = match fs::File::create(&outpath) {
                    Ok(f) => f,
                    Err(e) => {
                        let _ = fs::remove_file(&zip_path);
                        return Err(format!("Extract write error: {}", e));
                    }
                };
                if let Err(e) = std::io::copy(&mut file, &mut outfile) {
                    let _ = fs::remove_file(&zip_path);
                    return Err(format!("Copy failed: {}", e));
                }
            }
        }
    }

    let _ = fs::remove_file(&zip_path);

    Ok(check_dependencies())
}

pub async fn download_magick_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    current_step: usize,
    total_steps: usize,
    target_choice: Option<&str>,
) -> Result<DependencyStatus, String> {
    crate::utils::reset_cancel_flag();

    let client = reqwest::Client::builder()
        .user_agent("AlitkenMediaConverter/2.0")
        .build()
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Fetching latest ImageMagick release info from GitHub...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
            current_step,
            total_steps,
        },
    );

    let download_url = fetch_latest_magick_url(&client).await;
    let target_dir = resolve_target_dir(target_choice);
    let archive_path = target_dir.join("magick_download.7z");

    // Clean up any stale partial archive from previous attempts
    if archive_path.exists() {
        let _ = fs::remove_file(&archive_path);
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Connecting to ImageMagick GitHub releases...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
            current_step,
            total_steps,
        },
    );

    let res = match client.get(download_url).send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = fs::remove_file(&archive_path);
            return Err(format!("Download request error: {}", e));
        }
    };

    if !res.status().is_success() {
        let _ = fs::remove_file(&archive_path);
        return Err(format!("Server returned HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let mut file = match tokio::fs::File::create(&archive_path).await {
        Ok(f) => f,
        Err(e) => {
            let _ = fs::remove_file(&archive_path);
            return Err(format!("File creation error: {}", e));
        }
    };

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk_result) = stream.next().await {
        if crate::utils::check_cancel_flag() {
            drop(file);
            let _ = fs::remove_file(&archive_path);
            return Err("Download aborted by user.".to_string());
        }
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                drop(file);
                let _ = fs::remove_file(&archive_path);
                return Err(format!("Stream error: {}", e));
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            drop(file);
            let _ = fs::remove_file(&archive_path);
            return Err(format!("Write error: {}", e));
        }

        downloaded += chunk.len() as u64;
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed_mbps = if elapsed > 0.0 {
            (downloaded as f64 / (1024.0 * 1024.0)) / elapsed
        } else {
            0.0
        };

        let percent = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                status: "Downloading ImageMagick portable binaries...".to_string(),
                percent,
                speed_mbps,
                downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
                total_mb: total_size as f64 / (1024.0 * 1024.0),
                current_step,
                total_steps,
            },
        );
    }

    if let Err(e) = file.flush().await {
        drop(file);
        let _ = fs::remove_file(&archive_path);
        return Err(format!("Flush error: {}", e));
    }
    drop(file);

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Extracting magick.exe to local bin/ folder...".to_string(),
            percent: 100.0,
            speed_mbps: 0.0,
            downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
            total_mb: total_size as f64 / (1024.0 * 1024.0),
            current_step,
            total_steps,
        },
    );

    // Extract magick.exe using Windows native tar command
    let extract_status = crate::utils::create_hidden_cmd("tar")
        .args(&[
            "-xf",
            archive_path.to_str().unwrap_or_default(),
            "-C",
            target_dir.to_str().unwrap_or_default(),
            "magick.exe",
        ])
        .status();

    if let Err(e) = extract_status {
        let _ = fs::remove_file(&archive_path);
        return Err(format!("Failed to execute extraction process: {}", e));
    }

    let _ = fs::remove_file(&archive_path);

    let status = check_dependencies();
    if !status.magick_exists {
        return Err("magick.exe extraction failed or binary missing.".to_string());
    }

    Ok(status)
}

pub async fn download_all_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    target_choice: Option<String>,
) -> Result<DependencyStatus, String> {
    crate::utils::reset_cancel_flag();

    let target_ref = target_choice.as_deref();
    let current = check_dependencies();
    let mut total_steps = 0;
    if !current.ffmpeg_exists || !current.ffprobe_exists {
        total_steps += 1;
    }
    if !current.magick_exists {
        total_steps += 1;
    }
    if total_steps == 0 {
        total_steps = 1;
    }

    let mut current_step = 0;
    if !current.ffmpeg_exists || !current.ffprobe_exists {
        current_step += 1;
        download_ffmpeg_dependencies(app, current_step, total_steps, target_ref).await?;
    }
    if !current.magick_exists {
        current_step += 1;
        download_magick_dependencies(app, current_step, total_steps, target_ref).await?;
    }
    Ok(check_dependencies())
}

pub async fn install_to_appdata<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<DependencyStatus, String> {
    let portable_dir = get_portable_bin_dir();
    let appdata_dir = get_appdata_bin_dir();

    let portable_ffmpeg = portable_dir.join("ffmpeg.exe");
    let portable_ffprobe = portable_dir.join("ffprobe.exe");
    let portable_magick = portable_dir.join("magick.exe");

    // If binaries exist in portable dir, copy them into AppData
    if portable_ffmpeg.exists() && portable_ffprobe.exists() && portable_magick.exists() {
        let _ = fs::copy(&portable_ffmpeg, appdata_dir.join("ffmpeg.exe"));
        let _ = fs::copy(&portable_ffprobe, appdata_dir.join("ffprobe.exe"));
        let _ = fs::copy(&portable_magick, appdata_dir.join("magick.exe"));
        return Ok(check_dependencies());
    }

    // Otherwise download fresh builds into AppData
    download_all_dependencies(app, Some("AppData".to_string())).await
}

pub fn uninstall_appdata() -> Result<DependencyStatus, String> {
    let appdata_dir = get_appdata_bin_dir();
    let _ = fs::remove_file(appdata_dir.join("ffmpeg.exe"));
    let _ = fs::remove_file(appdata_dir.join("ffprobe.exe"));
    let _ = fs::remove_file(appdata_dir.join("magick.exe"));
    Ok(check_dependencies())
}


