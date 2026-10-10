use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Emitter;
use super::status::{
    check_dependencies, get_appdata_bin_dir, invalidate_dependency_cache, DependencyStatus,
};

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
        "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-31/ImageMagick-7.1.2-31-portable-Q16-arm64.7z".to_string()
    } else {
        "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-31/ImageMagick-7.1.2-31-portable-Q16-x64.7z".to_string()
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

    let mut extracted = false;
    let target_magick_path = target_dir.join("magick.exe");

    let in_process_res = sevenz_rust::decompress_file_with_extract_fn(
        &archive_path,
        &target_dir,
        |entry, reader, _dest| {
            let entry_name = entry.name().to_lowercase();
            if entry_name.ends_with("magick.exe") {
                let mut out_file = std::fs::File::create(&target_magick_path)
                    .map_err(|e| sevenz_rust::Error::io(e))?;
                std::io::copy(reader, &mut out_file)
                    .map_err(|e| sevenz_rust::Error::io(e))?;
                Ok(true)
            } else {
                let _ = std::io::copy(reader, &mut std::io::sink());
                Ok(true)
            }
        },
    );

    let is_valid_magick = |p: &Path| -> bool {
        p.exists() && p.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false)
    };

    if in_process_res.is_ok() && is_valid_magick(&target_magick_path) {
        log::info!("Successfully extracted magick.exe via in-process 7z decompressor");
        extracted = true;
    } else {
        if let Err(ref e) = in_process_res {
            log::warn!("In-process 7z decompression failed: {:?}. Attempting fallback...", e);
        }

        let system_tar = Path::new(r"C:\Windows\System32\tar.exe");
        let tar_program = if system_tar.exists() {
            system_tar.to_string_lossy().to_string()
        } else {
            "tar".to_string()
        };

        if let Ok(tar_status) = crate::utils::create_hidden_cmd(&tar_program)
            .args(&[
                "-xf",
                archive_path.to_str().unwrap_or_default(),
                "-C",
                target_dir.to_str().unwrap_or_default(),
                "magick.exe",
            ])
            .status()
        {
            if tar_status.success() && is_valid_magick(&target_magick_path) {
                log::info!("Extracted magick.exe via system tar fallback");
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
