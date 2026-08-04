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

/// Resolves paths for ffmpeg, ffprobe, and magick binaries in local bin/ or system PATH
pub fn check_dependencies() -> DependencyStatus {
    let local_bin = get_local_bin_dir();

    let ffmpeg_path = resolve_binary(&local_bin, "ffmpeg.exe", "ffmpeg");
    let ffprobe_path = resolve_binary(&local_bin, "ffprobe.exe", "ffprobe");
    let magick_path = resolve_binary(&local_bin, "magick.exe", "magick");

    DependencyStatus {
        ffmpeg_exists: !ffmpeg_path.is_empty(),
        ffprobe_exists: !ffprobe_path.is_empty(),
        magick_exists: !magick_path.is_empty(),
        ffmpeg_path,
        ffprobe_path,
        magick_path,
    }
}

pub fn get_local_bin_dir() -> PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let bin = parent.join("bin");
            if let Ok(_) = fs::create_dir_all(&bin) {
                return bin;
            }
        }
    }

    // Fallback to LocalAppData
    if let Some(data_dir) = dirs::data_local_dir() {
        let app_bin = data_dir.join("Alitken").join("bin");
        let _ = fs::create_dir_all(&app_bin);
        return app_bin;
    }

    PathBuf::from("bin")
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

/// Asynchronously downloads portable FFmpeg release zip directly from BtbN GitHub releases
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
    let target_dir = get_local_bin_dir();
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
    let target_dir = get_local_bin_dir();
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
) -> Result<DependencyStatus, String> {
    crate::utils::reset_cancel_flag();

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
        download_ffmpeg_dependencies(app, current_step, total_steps).await?;
    }
    if !current.magick_exists {
        current_step += 1;
        download_magick_dependencies(app, current_step, total_steps).await?;
    }
    Ok(check_dependencies())
}


