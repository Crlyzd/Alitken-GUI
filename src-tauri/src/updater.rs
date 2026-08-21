use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::time::Instant;
use tauri::{Emitter, Window};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub is_store_build: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes_url: String,
    pub release_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgressPayload {
    pub status: String,
    pub percent: f64,
    pub downloaded_mb: f64,
    pub total_mb: f64,
    pub speed_mbps: f64,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

/// Asynchronously removes ALITKEN.exe.old if left over from a previous update
pub fn cleanup_old_version() {
    std::thread::spawn(move || {
        if let Ok(exe_path) = env::current_exe() {
            let old_exe = exe_path.with_extension("exe.old");
            if old_exe.exists() {
                // Give previous process time to fully terminate before removing
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

/// Compares two semver version strings (e.g. "0.4.0" vs "0.5.0")
fn is_version_newer(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split(&['.', '-'][..])
            .filter_map(|s| s.parse::<u64>().ok())
            .collect()
    };

    let cur_parts = parse(current);
    let lat_parts = parse(latest);

    let max_len = cur_parts.len().max(lat_parts.len());
    for i in 0..max_len {
        let cur_num = cur_parts.get(i).copied().unwrap_or(0);
        let lat_num = lat_parts.get(i).copied().unwrap_or(0);

        if lat_num > cur_num {
            return true;
        } else if lat_num < cur_num {
            return false;
        }
    }

    false
}

/// Helper to determine the target architecture string
pub fn get_target_arch() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    }
}

/// Resolves the most appropriate GitHub release asset URL for the running system architecture.
/// Ensures that:
/// 1. Portable standalone executables (.exe) are strictly selected for in-place self-replacement.
/// 2. Installer packages (-Setup.exe / NSIS) are NEVER selected by the in-place self-updater.
/// 3. Microsoft Store release assets (-MSStore_*.exe) are NEVER selected.
/// 4. Matches host CPU architecture (64 / x64 vs ARM64).
pub fn resolve_target_asset(assets: &[GitHubAsset], target_arch: &str) -> Option<String> {
    let arch_needle = target_arch.to_lowercase();
    let is_arm64 = arch_needle.contains("arm64") || arch_needle.contains("aarch64");

    let is_arch_match = |name: &str| -> bool {
        if is_arm64 {
            name.contains("arm64") || name.contains("aarch64")
        } else {
            !name.contains("arm64")
                && !name.contains("aarch64")
                && (name.contains("x64")
                    || name.contains("_64")
                    || name.contains("-64")
                    || name.contains(".64")
                    || name.contains("64"))
        }
    };

    // 1st Priority: Exact architecture + portable executable, excluding store & setup
    for asset in assets {
        let name = asset.name.to_lowercase();
        if name.ends_with(".exe")
            && !name.contains("msstore")
            && !name.contains("setup")
            && is_arch_match(&name)
            && name.contains("portable")
        {
            return Some(asset.browser_download_url.clone());
        }
    }

    // 2nd Priority: Exact architecture match, excluding store & setup
    for asset in assets {
        let name = asset.name.to_lowercase();
        if name.ends_with(".exe")
            && !name.contains("msstore")
            && !name.contains("setup")
            && is_arch_match(&name)
        {
            return Some(asset.browser_download_url.clone());
        }
    }

    // 3rd Priority: Generic portable executable (legacy fallback), excluding store, setup, and opposite arch
    for asset in assets {
        let name = asset.name.to_lowercase();
        let opposite_detected = if is_arm64 {
            !name.contains("arm64") && (name.contains("x64") || name.contains("_64"))
        } else {
            name.contains("arm64") || name.contains("aarch64")
        };

        if name.ends_with(".exe")
            && !name.contains("msstore")
            && !name.contains("setup")
            && !opposite_detected
            && name.contains("portable")
        {
            return Some(asset.browser_download_url.clone());
        }
    }

    None
}

/// Queries GitHub releases API to check for newer Alitken release
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    let is_store_build = cfg!(feature = "store-build");

    if is_store_build {
        return Ok(UpdateInfo {
            available: false,
            is_store_build: true,
            current_version: current_version.clone(),
            latest_version: current_version,
            download_url: String::new(),
            release_notes_url: String::new(),
            release_name: String::new(),
        });
    }

    // GitHub API URL for latest release
    let repo_url = "https://api.github.com/repos/kaleksanan/Alitken-GUI/releases/latest";
    let fallback_repo_url = "https://api.github.com/repos/Crlyzd/Alitken-GUI/releases/latest";

    let client = reqwest::Client::builder()
        .user_agent("Alitken-Media-Converter-Updater")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let res = match client.get(repo_url).send().await {
        Ok(r) if r.status().is_success() => Some(r),
        _ => match client.get(fallback_repo_url).send().await {
            Ok(r) if r.status().is_success() => Some(r),
            _ => None,
        },
    };

    let response = match res {
        Some(r) => r,
        None => {
            return Ok(UpdateInfo {
                available: false,
                is_store_build,
                current_version: current_version.clone(),
                latest_version: current_version,
                download_url: String::new(),
                release_notes_url: String::new(),
                release_name: String::new(),
            });
        }
    };

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub release JSON: {}", e))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let available = is_version_newer(&current_version, &latest_version);

    // Resolve matching architecture-specific portable binary
    let target_arch = get_target_arch();
    let mut download_url = resolve_target_asset(&release.assets, target_arch).unwrap_or_default();

    // Fallback if no matching asset found
    if download_url.is_empty() {
        download_url = release.html_url.clone();
    }

    let release_name = release.name.unwrap_or_else(|| release.tag_name.clone());

    Ok(UpdateInfo {
        available,
        is_store_build,
        current_version,
        latest_version,
        download_url,
        release_notes_url: release.html_url,
        release_name,
    })
}

/// Stream-downloads update executable, performs in-place rename self-replacement, launches new EXE, and exits
pub async fn download_and_install_update(
    window: Window,
    download_url: String,
) -> Result<(), String> {
    let current_exe = env::current_exe().map_err(|e| format!("Failed to resolve current exe: {}", e))?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;

    let tmp_exe = exe_dir.join("ALITKEN.exe.tmp");
    let old_exe = exe_dir.join("ALITKEN.exe.old");

    crate::utils::log_info(&format!("Downloading update from URL: {}", download_url));

    let client = reqwest::Client::builder()
        .user_agent("Alitken-Media-Converter-Updater")
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
        let chunk = chunk_res.map_err(|e| format!("Error downloading chunk: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write update chunk: {}", e))?;

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

    file.flush().await.map_err(|e| format!("Failed to flush binary file: {}", e))?;
    drop(file);

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

    // Remove legacy .old if left over
    if old_exe.exists() {
        let _ = fs::remove_file(&old_exe);
    }

    // Windows in-place process self-replacement
    // Step 1: Rename active running executable to ALITKEN.exe.old
    fs::rename(&current_exe, &old_exe).map_err(|e| {
        let _ = fs::remove_file(&tmp_exe);
        format!(
            "Failed to rename current executable (Permission Denied?): {}",
            e
        )
    })?;

    // Step 2: Move downloaded ALITKEN.exe.tmp into place as ALITKEN.exe
    if let Err(e) = fs::rename(&tmp_exe, &current_exe) {
        // Rollback rename if move failed
        let _ = fs::rename(&old_exe, &current_exe);
        let _ = fs::remove_file(&tmp_exe);
        return Err(format!("Failed to place updated executable: {}", e));
    }

    // Step 3: Launch newly updated ALITKEN.exe
    std::process::Command::new(&current_exe)
        .spawn()
        .map_err(|e| format!("Failed to spawn updated application: {}", e))?;

    crate::utils::log_info("Newly updated application spawned. Exiting current process.");

    // Step 4: Exit old process
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_mock_assets() -> Vec<GitHubAsset> {
        vec![
            GitHubAsset {
                name: "Alitken_v0.7.1_GitHub_ARM64-Portable.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_ARM64-Portable.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_GitHub_ARM64-Setup.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_ARM64-Setup.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_GitHub_64-Portable.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_64-Portable.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_GitHub_64-Setup.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_64-Setup.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_MSStore_ARM64-Portable.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_MSStore_ARM64-Portable.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_MSStore_ARM64-Setup.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_MSStore_ARM64-Setup.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_MSStore_64-Portable.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_MSStore_64-Portable.exe".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_MSStore_64-Setup.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_MSStore_64-Setup.exe".to_string(),
            },
        ]
    }

    #[test]
    fn test_x64_selects_github_64_portable() {
        let assets = create_mock_assets();
        let selected = resolve_target_asset(&assets, "x64");
        assert_eq!(
            selected,
            Some("https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_64-Portable.exe".to_string())
        );
    }

    #[test]
    fn test_legacy_x64_name_compatibility() {
        let assets = vec![
            GitHubAsset {
                name: "Alitken_v0.7.0_GitHub_x64-Portable.exe".to_string(),
                browser_download_url: "https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.0/Alitken_v0.7.0_GitHub_x64-Portable.exe".to_string(),
            },
        ];
        let selected = resolve_target_asset(&assets, "x64");
        assert_eq!(
            selected,
            Some("https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.0/Alitken_v0.7.0_GitHub_x64-Portable.exe".to_string())
        );
    }

    #[test]
    fn test_arm64_selects_github_arm64_portable() {
        let assets = create_mock_assets();
        let selected = resolve_target_asset(&assets, "arm64");
        assert_eq!(
            selected,
            Some("https://github.com/kaleksanan/Alitken-GUI/releases/download/v0.7.1/Alitken_v0.7.1_GitHub_ARM64-Portable.exe".to_string())
        );
    }

    #[test]
    fn test_excludes_msstore_and_setup_installers() {
        let assets = vec![
            GitHubAsset {
                name: "Alitken_v0.7.1_MSStore_64-Portable.exe".to_string(),
                browser_download_url: "url_msstore_portable".to_string(),
            },
            GitHubAsset {
                name: "Alitken_v0.7.1_GitHub_64-Setup.exe".to_string(),
                browser_download_url: "url_github_setup".to_string(),
            },
        ];
        let selected = resolve_target_asset(&assets, "x64");
        assert_eq!(selected, None);
    }

    #[test]
    fn test_version_newer_logic() {
        assert!(is_version_newer("0.6.0", "0.7.0"));
        assert!(is_version_newer("0.6.9", "0.7.0"));
        assert!(is_version_newer("0.7.0", "1.0.0"));
        assert!(!is_version_newer("0.7.0", "0.7.0"));
        assert!(!is_version_newer("0.7.1", "0.7.0"));
        assert!(!is_version_newer("1.0.0", "0.7.0"));
    }
}

