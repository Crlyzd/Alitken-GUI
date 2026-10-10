use serde::{Deserialize, Serialize};

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

/// Compares two semver version strings (e.g. "0.4.0" vs "0.5.0")
pub fn is_version_newer(current: &str, latest: &str) -> bool {
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

pub fn get_target_arch() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    }
}

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

    let target_arch = get_target_arch();
    let mut download_url = resolve_target_asset(&release.assets, target_arch).unwrap_or_default();

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
