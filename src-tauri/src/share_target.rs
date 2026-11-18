use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static STARTUP_SHARED_FILES: OnceLock<Vec<String>> = OnceLock::new();

fn handoff_file_path() -> PathBuf {
    crate::utils::get_app_data_root_dir().join("pending_share_files.json")
}

/// Filters raw paths to existing regular files while preserving order and deduplicating.
pub fn filter_and_dedupe_files<I>(paths: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = Path::new(trimmed);
        if path.exists() && path.is_file() {
            let key = trimmed.to_lowercase();
            if seen.insert(key) {
                result.push(trimmed.to_string());
            }
        }
    }
    result
}

#[cfg(target_os = "windows")]
fn extract_winrt_share_target_files() -> Vec<String> {
    use windows::core::Interface;
    use windows::ApplicationModel::Activation::{ActivationKind, ShareTargetActivatedEventArgs};
    use windows::ApplicationModel::AppInstance;
    use windows::ApplicationModel::DataTransfer::StandardDataFormats;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

    // Run on a temporary MTA thread so we never alter the main thread's STA state for WebView2.
    std::thread::spawn(|| {
        let com_ok = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        let extracted = (|| -> windows::core::Result<Vec<String>> {
            let args = AppInstance::GetActivatedEventArgs()?;
            if args.Kind()? != ActivationKind::ShareTarget {
                return Ok(Vec::new());
            }

            let share_args: ShareTargetActivatedEventArgs = args.cast()?;
            let share_op = share_args.ShareOperation()?;
            let data = share_op.Data()?;

            let mut paths = Vec::new();
            let storage_format = StandardDataFormats::StorageItems()?;
            if data.Contains(&storage_format)? {
                let items = data.GetStorageItemsAsync()?.get()?;
                let count = items.Size()?;
                for idx in 0..count {
                    if let Ok(item) = items.GetAt(idx) {
                        if let Ok(path_hstr) = item.Path() {
                            paths.push(path_hstr.to_string_lossy());
                        }
                    }
                }
            }

            let _ = share_op.ReportCompleted();
            Ok(filter_and_dedupe_files(paths))
        })();

        if com_ok {
            unsafe { CoUninitialize() };
        }

        extracted.unwrap_or_default()
    })
    .join()
    .unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
fn extract_winrt_share_target_files() -> Vec<String> {
    Vec::new()
}

/// Captures any WinRT Share Target files at process startup before single-instance
/// handoff or Tauri window initialization.
pub fn capture_startup_shared_files() {
    let files = extract_winrt_share_target_files();
    if !files.is_empty() {
        crate::utils::log_info(&format!("Captured {} Share Target file(s) at launch", files.len()));
        if let Ok(json) = serde_json::to_string(&files) {
            let _ = fs::write(handoff_file_path(), json);
        }
    }
    let _ = STARTUP_SHARED_FILES.set(files);
}

/// Consumes Share Target files captured during cold-start of the primary instance.
pub fn take_startup_shared_files() -> Vec<String> {
    let handoff = handoff_file_path();
    if handoff.exists() {
        let _ = fs::remove_file(&handoff);
    }
    STARTUP_SHARED_FILES.get().cloned().unwrap_or_default()
}

/// Consumes any Share Target handoff files written by a secondary instance before it exited.
pub fn take_handoff_shared_files() -> Vec<String> {
    let handoff = handoff_file_path();
    if !handoff.exists() {
        return Vec::new();
    }
    let content = fs::read_to_string(&handoff).ok();
    let _ = fs::remove_file(&handoff);
    content
        .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
        .map(filter_and_dedupe_files)
        .unwrap_or_default()
}
