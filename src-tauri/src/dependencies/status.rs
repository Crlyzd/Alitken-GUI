use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, Instant};

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

pub fn get_appdata_bin_dir() -> PathBuf {
    let app_bin = crate::utils::get_curlyzed_root_dir().join("bin");
    let _ = fs::create_dir_all(&app_bin);
    app_bin
}

pub fn parse_version_components(version_str: &str) -> Vec<u32> {
    let mut components = Vec::new();
    let mut current_num = String::new();

    for ch in version_str.chars() {
        if ch.is_ascii_digit() {
            current_num.push(ch);
        } else if !current_num.is_empty() {
            if let Ok(num) = current_num.parse::<u32>() {
                components.push(num);
            }
            current_num.clear();
        }
    }
    if !current_num.is_empty() {
        if let Ok(num) = current_num.parse::<u32>() {
            components.push(num);
        }
    }

    components
}

pub fn compare_versions(v1: &str, v2: &str) -> std::cmp::Ordering {
    let c1 = parse_version_components(v1);
    let c2 = parse_version_components(v2);

    let max_len = c1.len().max(c2.len());
    for i in 0..max_len {
        let p1 = c1.get(i).copied().unwrap_or(0);
        let p2 = c2.get(i).copied().unwrap_or(0);
        match p1.cmp(&p2) {
            std::cmp::Ordering::Equal => continue,
            non_eq => return non_eq,
        }
    }

    std::cmp::Ordering::Equal
}

pub fn is_version_outdated(installed: &str, target: &str) -> bool {
    if installed.is_empty() || target.is_empty() {
        return false;
    }
    compare_versions(installed, target) == std::cmp::Ordering::Less
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

    let first_line = match output.lines().next() {
        Some(l) if !l.trim().is_empty() => l.trim(),
        _ => return (String::new(), 0, 0),
    };

    let first_line_lower = first_line.to_lowercase();

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

    if first_line_lower.contains("ffmpeg") {
        if first_line_lower.contains("n-")
            || first_line_lower.contains("-g")
            || first_line_lower.contains("latest")
        {
            return ("7.1".to_string(), 7, 1);
        }
    }

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
        return ("7.1.2-31".to_string(), 7, 1);
    }

    (String::new(), 0, 0)
}

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

    let ffmpeg_valid = ffmpeg_exists
        && ffprobe_exists
        && (ffmpeg_maj >= 5 || ffmpeg_maj == 0 || ffmpeg_maj == 999);
    let magick_valid = magick_exists && (magick_maj >= 7 || magick_maj == 0 || magick_maj == 999);

    let mut ffmpeg_latest_version = "7.1".to_string();
    let mut magick_latest_version = "7.1.2-31".to_string();

    let has_update = ffmpeg_valid
        && ffmpeg_maj > 0
        && is_version_outdated(&ffmpeg_version, &ffmpeg_latest_version);

    let magick_has_update = magick_valid
        && magick_maj > 0
        && is_version_outdated(&magick_version, &magick_latest_version);

    if compare_versions(&ffmpeg_version, &ffmpeg_latest_version) == std::cmp::Ordering::Greater {
        ffmpeg_latest_version = ffmpeg_version.clone();
    }
    if compare_versions(&magick_version, &magick_latest_version) == std::cmp::Ordering::Greater {
        magick_latest_version = magick_version.clone();
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_parsing_and_comparison() {
        assert_eq!(
            compare_versions("7.1.2-31", "7.1.2-29"),
            std::cmp::Ordering::Greater
        );
        assert_eq!(
            compare_versions("7.1.2-29", "7.1.2-31"),
            std::cmp::Ordering::Less
        );
        assert_eq!(
            compare_versions("7.1.2-31", "7.1.2-31"),
            std::cmp::Ordering::Equal
        );
        assert_eq!(compare_versions("7.1", "7.1.0"), std::cmp::Ordering::Equal);
        assert_eq!(
            compare_versions("7.2", "7.1"),
            std::cmp::Ordering::Greater
        );
        assert_eq!(compare_versions("6.1", "7.1"), std::cmp::Ordering::Less);

        assert!(!is_version_outdated("7.1.2-31", "7.1.2-29"));
        assert!(!is_version_outdated("7.1.2-31", "7.1.2-31"));
        assert!(is_version_outdated("7.1.2-29", "7.1.2-31"));
        assert!(!is_version_outdated("7.1", "7.1"));
        assert!(!is_version_outdated("8.0", "7.1"));
        assert!(is_version_outdated("5.1", "7.1"));
    }
}
