use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::time::Instant;
use tauri::{Emitter, Window};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgressPayload {
    pub status: String,
    pub percent: f64,
    pub downloaded_mb: f64,
    pub total_mb: f64,
    pub speed_mbps: f64,
}

/// Asynchronously removes ALITKEN.exe.old if left over from a previous update
pub fn cleanup_old_version() {
    std::thread::spawn(move || {
        if let Ok(exe_path) = env::current_exe() {
            let old_exe = exe_path.with_extension("exe.old");
            if old_exe.exists() {
                std::thread::sleep(std::time::Duration::from_millis(800));
                let _ = fs::remove_file(&old_exe);
                crate::utils::log_info(&format!(
                    "Cleaned up legacy executable: {}",
                    old_exe.to_string_lossy()
                ));
            }
        }
    });
}

/// Stream-downloads update executable, performs in-place rename self-replacement, launches new EXE, and exits
pub async fn download_and_install_update(
    window: Window,
    download_url: String,
) -> Result<(), String> {
    crate::utils::reset_cancel_flag();

    let current_exe = env::current_exe().map_err(|e| format!("Failed to resolve current exe: {}", e))?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;

    let tmp_exe = exe_dir.join("ALITKEN.exe.tmp");
    let old_exe = exe_dir.join("ALITKEN.exe.old");

    if tmp_exe.exists() {
        let _ = fs::remove_file(&tmp_exe);
    }

    crate::utils::log_info(&format!("Downloading update from URL: {}", download_url));

    let client = reqwest::Client::builder()
        .user_agent("Alitken-Media-Converter-Updater")
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&tmp_exe)
        .await
        .map_err(|e| format!("Failed to create temporary update file {:?}: {}", tmp_exe, e))?;

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let start_time = Instant::now();
    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk_res) = stream.next().await {
        if crate::utils::check_cancel_flag() {
            drop(file);
            let _ = fs::remove_file(&tmp_exe);
            return Err("Update download canceled by user.".to_string());
        }

        let chunk = match chunk_res {
            Ok(c) => c,
            Err(e) => {
                drop(file);
                let _ = fs::remove_file(&tmp_exe);
                return Err(format!("Error downloading chunk: {}", e));
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            drop(file);
            let _ = fs::remove_file(&tmp_exe);
            return Err(format!("Failed to write update chunk: {}", e));
        }

        downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() > 100 || downloaded == total_size {
            last_emit = Instant::now();
            let elapsed_sec = start_time.elapsed().as_secs_f64();
            let speed_mbps = if elapsed_sec > 0.0 {
                (downloaded as f64 / 1_048_576.0) / elapsed_sec
            } else {
                0.0
            };

            let percent = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                50.0
            };

            let _ = window.emit(
                "update-progress",
                UpdateProgressPayload {
                    status: format!("Downloading update... {:.1}%", percent),
                    percent,
                    downloaded_mb: downloaded as f64 / 1_048_576.0,
                    total_mb: total_size as f64 / 1_048_576.0,
                    speed_mbps,
                },
            );

            let _ = window.emit(
                "download-progress",
                crate::dependencies::DownloadProgressPayload {
                    status: "Downloading ALITKEN App Update...".to_string(),
                    percent,
                    speed_mbps,
                    downloaded_mb: downloaded as f64 / 1_048_576.0,
                    total_mb: total_size as f64 / 1_048_576.0,
                    current_step: 1,
                    total_steps: 1,
                },
            );
        }
    }

    if let Err(e) = file.flush().await {
        drop(file);
        let _ = fs::remove_file(&tmp_exe);
        return Err(format!("Failed to flush binary file: {}", e));
    }
    drop(file);

    if crate::utils::check_cancel_flag() {
        let _ = fs::remove_file(&tmp_exe);
        return Err("Update download canceled by user.".to_string());
    }

    if total_size > 0 && downloaded < total_size {
        let _ = fs::remove_file(&tmp_exe);
        return Err(format!(
            "Download incomplete: received {} of {} bytes.",
            downloaded, total_size
        ));
    }

    let _ = window.emit(
        "update-progress",
        UpdateProgressPayload {
            status: "Applying update & restarting...".to_string(),
            percent: 100.0,
            downloaded_mb: downloaded as f64 / 1_048_576.0,
            total_mb: downloaded as f64 / 1_048_576.0,
            speed_mbps: 0.0,
        },
    );

    crate::utils::log_info("Update downloaded successfully. Executing Windows self-replacement...");

    if old_exe.exists() {
        let _ = fs::remove_file(&old_exe);
    }

    fs::rename(&current_exe, &old_exe).map_err(|e| {
        let _ = fs::remove_file(&tmp_exe);
        format!(
            "Failed to rename current executable (Permission Denied?): {}",
            e
        )
    })?;

    if let Err(e) = fs::rename(&tmp_exe, &current_exe) {
        let _ = fs::rename(&old_exe, &current_exe);
        let _ = fs::remove_file(&tmp_exe);
        return Err(format!("Failed to place updated executable: {}", e));
    }

    std::process::Command::new(&current_exe)
        .spawn()
        .map_err(|e| format!("Failed to spawn updated application: {}", e))?;

    crate::utils::log_info("Newly updated application spawned. Exiting current process.");
    std::process::exit(0);
}
