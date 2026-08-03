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

/// Asynchronously downloads portable FFmpeg release zip directly from BtbN GitHub releases
pub async fn download_ffmpeg_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<DependencyStatus, String> {
    let client = reqwest::Client::builder()
        .user_agent("AlitkenMediaConverter/2.0")
        .build()
        .map_err(|e| e.to_string())?;

    let download_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip";
    let target_dir = get_local_bin_dir();
    let zip_path = target_dir.join("ffmpeg_download.zip");

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Connecting to GitHub releases...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
        },
    );

    let res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate download: {}", e))?;

    let total_size = res.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&zip_path)
        .await
        .map_err(|e| format!("Failed to create zip file: {}", e))?;

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

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
                status: format!("Downloading FFmpeg portable binaries ({:.1} MB/s)...", speed_mbps),
                percent,
                speed_mbps,
                downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
                total_mb: total_size as f64 / (1024.0 * 1024.0),
            },
        );
    }

    file.flush().await.map_err(|e| format!("Flush error: {}", e))?;

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Extracting portable binaries to local bin/ folder...".to_string(),
            percent: 100.0,
            speed_mbps: 0.0,
            downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
            total_mb: total_size as f64 / (1024.0 * 1024.0),
        },
    );

    // Extract zip
    let zip_file = fs::File::open(&zip_path).map_err(|e| format!("Open zip failed: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| format!("Archive read error: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Zip file index error: {}", e))?;
        let filename = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        if filename.file_name() == Some(std::ffi::OsStr::new("ffmpeg.exe"))
            || filename.file_name() == Some(std::ffi::OsStr::new("ffprobe.exe"))
        {
            if let Some(target_file_name) = filename.file_name() {
                let outpath = target_dir.join(target_file_name);
                let mut outfile = fs::File::create(&outpath).map_err(|e| format!("Extract write error: {}", e))?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Copy failed: {}", e))?;
            }
        }
    }

    let _ = fs::remove_file(zip_path);

    Ok(check_dependencies())
}

pub async fn download_magick_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<DependencyStatus, String> {
    let client = reqwest::Client::builder()
        .user_agent("AlitkenMediaConverter/2.0")
        .build()
        .map_err(|e| e.to_string())?;

    // Primary release asset for ImageMagick 7.x portable x64
    let download_url = "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-29/ImageMagick-7.1.2-29-portable-Q16-x64.7z";
    let target_dir = get_local_bin_dir();
    let archive_path = target_dir.join("magick_download.7z");

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Connecting to ImageMagick GitHub releases...".to_string(),
            percent: 0.0,
            speed_mbps: 0.0,
            downloaded_mb: 0.0,
            total_mb: 0.0,
        },
    );

    let res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Download request error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Server returned HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&archive_path)
        .await
        .map_err(|e| format!("File creation error: {}", e))?;

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

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
                status: format!("Downloading ImageMagick portable binaries ({:.1} MB/s)...", speed_mbps),
                percent,
                speed_mbps,
                downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
                total_mb: total_size as f64 / (1024.0 * 1024.0),
            },
        );
    }

    file.flush().await.map_err(|e| format!("Flush error: {}", e))?;

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            status: "Extracting magick.exe to local bin/ folder...".to_string(),
            percent: 100.0,
            speed_mbps: 0.0,
            downloaded_mb: downloaded as f64 / (1024.0 * 1024.0),
            total_mb: total_size as f64 / (1024.0 * 1024.0),
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

    let _ = fs::remove_file(archive_path);

    let status = check_dependencies();
    if !status.magick_exists {
        return Err("magick.exe extraction failed or binary missing.".to_string());
    }

    Ok(status)
}

pub async fn download_all_dependencies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<DependencyStatus, String> {
    let current = check_dependencies();
    if !current.ffmpeg_exists || !current.ffprobe_exists {
        download_ffmpeg_dependencies(app).await?;
    }
    if !current.magick_exists {
        download_magick_dependencies(app).await?;
    }
    Ok(check_dependencies())
}


