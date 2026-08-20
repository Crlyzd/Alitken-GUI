use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, Instant};
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
    pub has_update: bool,
    pub magick_has_update: bool,
    pub ffmpeg_latest_version: String,
    pub magick_latest_version: String,
    pub appdata_path: String,
    pub ffmpeg_path: String,
    pub ffprobe_path: String,
    pub magick_path: String,
}

#[derive(Debug, Clone)]
struct CachedStatus {
    timestamp: Instant,
    status: DependencyStatus,
}

static CACHED_DEPS: OnceLock<RwLock<Option<CachedStatus>>> = OnceLock::new();

fn get_cache() -> &'static RwLock<Option<CachedStatus>> {
    CACHED_DEPS.get_or_init(|| RwLock::new(None))
}

pub fn invalidate_dependency_cache() {
    if let Ok(mut guard) = get_cache().write() {
        *guard = None;
    }
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

    // Restrict parsing strictly to line 1 to prevent compiler/library output on lower lines from bleeding into version probing
    let first_line = match output.lines().next() {
        Some(l) if !l.trim().is_empty() => l.trim(),
        _ => return (String::new(), 0, 0),
    };

    let first_line_lower = first_line.to_lowercase();

    // Case 1: Standard semver in line 1 (e.g., "ffmpeg version 7.1", "ImageMagick 7.1.2-29", "n7.1.0")
    if let Some(idx) = first_line_lower.find("version") {
        let substring = &first_line[idx..];
        for raw_word in substring.split_whitespace() {
            let trimmed = raw_word
                .trim_start_matches(|c: char| c == 'v' || c == 'V' || c == 'n' || c == 'N');
            let clean = trimmed.trim_matches(|c: char| !c.is_numeric() && c != '.' && c != '-');
            if clean.contains('.') {
                let parts: Vec<&str> = clean.split(|c| c == '.' || c == '-').collect();
                if let (Ok(maj), Ok(min)) = (
                    parts[0].parse::<u32>(),
                    parts.get(1).unwrap_or(&"0").parse::<u32>(),
                ) {
                    return (clean.to_string(), maj, min);
                }
            }
        }
    }

    // Case 2: Handle BtbN / FFmpeg git master build identifiers on line 1 (e.g. "ffmpeg version N-125978-g95c43d7df7-20260806")
    if first_line_lower.contains("ffmpeg") {
        if first_line_lower.contains("n-")
            || first_line_lower.contains("-g")
            || first_line_lower.contains("latest")
        {
            return ("7.1".to_string(), 7, 1);
        }
    }

    // Case 3: ImageMagick fallback parsing on line 1
    if first_line_lower.contains("imagemagick") {
        for raw_word in first_line.split_whitespace() {
            let clean = raw_word.trim_matches(|c: char| !c.is_numeric() && c != '.' && c != '-');
            if clean.contains('.') {
                let parts: Vec<&str> = clean.split(|c| c == '.' || c == '-').collect();
                if let (Ok(maj), Ok(min)) = (
                    parts[0].parse::<u32>(),
                    parts.get(1).unwrap_or(&"0").parse::<u32>(),
                ) {
                    return (clean.to_string(), maj, min);
                }
            }
        }
        return ("7.1.2-29".to_string(), 7, 1);
    }

    (String::new(), 0, 0)
}

/// Resolves paths for ffmpeg, ffprobe, and magick binaries in AppData bin/ (cached for 15s)
pub fn check_dependencies() -> DependencyStatus {
    const TTL: Duration = Duration::from_secs(15);
    if let Ok(guard) = get_cache().read() {
        if let Some(ref cached) = *guard {
            if cached.timestamp.elapsed() < TTL {
                return cached.status.clone();
            }
        }
    }

    let status = compute_dependencies();

    if let Ok(mut guard) = get_cache().write() {
        *guard = Some(CachedStatus {
            timestamp: Instant::now(),
            status: status.clone(),
        });
    }

    status
}

/// Performs heavy binary version probing process executions exclusively from AppData
fn compute_dependencies() -> DependencyStatus {
    let appdata_bin = get_appdata_bin_dir();
    let appdata_path = appdata_bin.to_string_lossy().to_string();

    let ffmpeg_exe = appdata_bin.join("ffmpeg.exe");
    let ffprobe_exe = appdata_bin.join("ffprobe.exe");
    let magick_exe = appdata_bin.join("magick.exe");

    let ffmpeg_path = if ffmpeg_exe.exists() {
        ffmpeg_exe.to_string_lossy().to_string()
    } else {
        String::new()
    };
    let ffprobe_path = if ffprobe_exe.exists() {
        ffprobe_exe.to_string_lossy().to_string()
    } else {
        String::new()
    };
    let magick_path = if magick_exe.exists() {
        magick_exe.to_string_lossy().to_string()
    } else {
        String::new()
    };

    let (ffmpeg_version, ffmpeg_maj, _) = probe_binary_version(&ffmpeg_path);
    let (ffprobe_version, _, _) = probe_binary_version(&ffprobe_path);
    let (magick_version, magick_maj, _) = probe_binary_version(&magick_path);

    let ffmpeg_exists = !ffmpeg_path.is_empty();
    let ffprobe_exists = !ffprobe_path.is_empty();
    let magick_exists = !magick_path.is_empty();

    let ffmpeg_valid = ffmpeg_exists && (ffmpeg_maj >= 5 || ffmpeg_maj == 0 || ffmpeg_maj == 999);
    let magick_valid = magick_exists && (magick_maj >= 7 || magick_maj == 0 || magick_maj == 999);

    let ffmpeg_latest_version = "7.1".to_string();
    let magick_latest_version = "7.1.2-29".to_string();

    let has_update = ffmpeg_valid
        && ffmpeg_maj > 0
        && (ffmpeg_maj < 7 || (!ffmpeg_version.is_empty() && !ffmpeg_version.starts_with(&ffmpeg_latest_version)));

    let magick_has_update = magick_valid
        && magick_maj > 0
        && (magick_maj < 7 || (!magick_version.is_empty() && magick_version != magick_latest_version));

    DependencyStatus {
        ffmpeg_exists,
        ffprobe_exists,
        magick_exists,
        ffmpeg_valid,
        magick_valid,
        ffmpeg_version,
        ffprobe_version,
        magick_version,
        has_update,
        magick_has_update,
        ffmpeg_latest_version,
        magick_latest_version,
        appdata_path,
        ffmpeg_path,
        ffprobe_path,
        magick_path,
    }
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
    let is_arm64 = cfg!(target_arch = "aarch64");
    let fallback_url = if is_arm64 {
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-winarm64-gpl-7.1.zip".to_string()
    } else {
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip".to_string()
    };
    let api_url = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";

    let res = match client.get(api_url).send().await {
        Ok(res) if res.status().is_success() => res,
        _ => return fallback_url,
    };

    let release: GitHubRelease = match res.json().await {
        Ok(rel) => rel,
        Err(_) => return fallback_url,
    };

    let arch_keyword = if is_arm64 { "winarm64" } else { "win64-gpl" };

    // Filter for win64-gpl or winarm64 zip asset (prefer latest release build)
    for asset in &release.assets {
        let name_lower = asset.name.to_lowercase();
        if name_lower.ends_with(".zip")
            && name_lower.contains(arch_keyword)
            && !name_lower.contains("shared")
        {
            return asset.browser_download_url.clone();
        }
    }

    fallback_url
}

/// Dynamically resolves the latest ImageMagick portable release 7z URL from ImageMagick GitHub API
async fn fetch_latest_magick_url(client: &reqwest::Client) -> String {
    let is_arm64 = cfg!(target_arch = "aarch64");
    let fallback_url = if is_arm64 {
        "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-29/ImageMagick-7.1.2-29-portable-Q16-arm64.7z".to_string()
    } else {
        "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-29/ImageMagick-7.1.2-29-portable-Q16-x64.7z".to_string()
    };
    let api_url = "https://api.github.com/repos/ImageMagick/ImageMagick/releases/latest";

    let res = match client.get(api_url).send().await {
        Ok(res) if res.status().is_success() => res,
        _ => return fallback_url,
    };

    let release: GitHubRelease = match res.json().await {
        Ok(rel) => rel,
        Err(_) => return fallback_url,
    };

    let arch_keyword = if is_arm64 { "arm64" } else { "x64" };

    for asset in &release.assets {
        let name_lower = asset.name.to_lowercase();
        if name_lower.ends_with(".7z")
            && name_lower.contains("portable")
            && name_lower.contains(arch_keyword)
        {
            return asset.browser_download_url.clone();
        }
    }

    // Fallback search for x64 if arm64 not available (Windows 11 ARM64 runs x64 binary via emulation)
    if is_arm64 {
        for asset in &release.assets {
            let name_lower = asset.name.to_lowercase();
            if name_lower.ends_with(".7z")
                && name_lower.contains("portable")
                && name_lower.contains("x64")
            {
                return asset.browser_download_url.clone();
            }
        }
    }

    fallback_url
}

/// Asynchronously downloads portable FFmpeg release zip directly into AppData bin/
pub async fn download_ffmpeg_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    current_step: usize,
    total_steps: usize,
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
    let target_dir = get_appdata_bin_dir();
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
            status: "Extracting portable binaries to AppData...".to_string(),
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

    invalidate_dependency_cache();
    Ok(check_dependencies())
}

pub async fn download_magick_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    current_step: usize,
    total_steps: usize,
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
    let target_dir = get_appdata_bin_dir();
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
            status: "Extracting magick.exe to AppData...".to_string(),
            percent: 100.0,
            speed_mbps: 0.0,
            downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
            total_mb: total_size as f64 / (1024.0 * 1024.0),
            current_step,
            total_steps,
        },
    );

    // Extract magick.exe: Tier 1: In-process pure-Rust 7z extraction
    let mut extracted = false;
    let in_process_res = sevenz_rust::decompress_file_with_extract_fn(
        &archive_path,
        &target_dir,
        |entry, reader, dest| {
            let entry_name = entry.name().to_lowercase();
            if entry_name.ends_with("magick.exe") {
                let out_file_path = dest.join("magick.exe");
                let mut out_file = std::fs::File::create(&out_file_path)
                    .map_err(|e| sevenz_rust::Error::io(e))?;
                std::io::copy(reader, &mut out_file)
                    .map_err(|e| sevenz_rust::Error::io(e))?;
                Ok(true)
            } else {
                Ok(true)
            }
        },
    );

    if in_process_res.is_ok() && target_dir.join("magick.exe").exists() {
        extracted = true;
    } else {
        // Tier 2 Fallback: Windows native tar command
        if let Ok(tar_status) = crate::utils::create_hidden_cmd("tar")
            .args(&[
                "-xf",
                archive_path.to_str().unwrap_or_default(),
                "-C",
                target_dir.to_str().unwrap_or_default(),
                "magick.exe",
            ])
            .status()
        {
            if tar_status.success() && target_dir.join("magick.exe").exists() {
                extracted = true;
            }
        }
    }

    let _ = fs::remove_file(&archive_path);

    if !extracted {
        return Err("Failed to extract magick.exe from archive. Please ensure disk write permissions or manually extract ImageMagick portable to bin/.".to_string());
    }

    invalidate_dependency_cache();
    Ok(check_dependencies())
}

pub async fn download_all_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<DependencyStatus, String> {
    crate::utils::reset_cancel_flag();

    let current = check_dependencies();
    let mut need_ffmpeg = !current.ffmpeg_exists
        || !current.ffprobe_exists
        || !current.ffmpeg_valid
        || current.has_update;
    let mut need_magick =
        !current.magick_exists || !current.magick_valid || current.magick_has_update;

    // If neither specifically requires updating, re-download both (e.g. forced reinstall)
    if !need_ffmpeg && !need_magick {
        need_ffmpeg = true;
        need_magick = true;
    }

    let mut total_steps = 0;
    if need_ffmpeg {
        total_steps += 1;
    }
    if need_magick {
        total_steps += 1;
    }

    let mut current_step = 0;
    if need_ffmpeg {
        current_step += 1;
        download_ffmpeg_dependencies(app, current_step, total_steps).await?;
    }
    if need_magick {
        current_step += 1;
        download_magick_dependencies(app, current_step, total_steps).await?;
    }
    Ok(check_dependencies())
}

/// Uninstalls all binaries, logs, and completely removes %LOCALAPPDATA%/Alitken folder itself
pub fn uninstall_appdata() -> Result<DependencyStatus, String> {
    if let Some(local_dir) = dirs::data_local_dir() {
        let app_root = local_dir.join("Alitken");
        if app_root.exists() {
            let _ = fs::remove_dir_all(&app_root);
        }
    }
    invalidate_dependency_cache();
    Ok(check_dependencies())
}
