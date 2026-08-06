use crate::utils;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct IntegrationStatus {
    pub sendto_active: bool,
    pub executable_path: String,
}

/// Resolves the Windows SendTo folder: %APPDATA%\Microsoft\Windows\SendTo
pub fn get_sendto_folder() -> Option<PathBuf> {
    if let Some(appdata) = dirs::config_dir() {
        let sendto = appdata.join("Microsoft").join("Windows").join("SendTo");
        if sendto.exists() || fs::create_dir_all(&sendto).is_ok() {
            return Some(sendto);
        }
    }
    None
}

/// Resolves the target shortcut path for SendTo
pub fn get_sendto_shortcut_path() -> Option<PathBuf> {
    get_sendto_folder().map(|dir| dir.join("Alitken Media Converter.lnk"))
}

/// Checks if the SendTo shortcut exists
pub fn is_sendto_active() -> bool {
    if let Some(path) = get_sendto_shortcut_path() {
        path.exists()
    } else {
        false
    }
}

/// Creates or deletes the SendTo shortcut
pub fn set_sendto_shortcut(enable: bool) -> Result<bool, String> {
    let shortcut_path = get_sendto_shortcut_path()
        .ok_or_else(|| "Could not locate Windows SendTo directory".to_string())?;

    if enable {
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to resolve current executable path: {}", e))?;

        let target_str = current_exe.to_string_lossy();
        let shortcut_str = shortcut_path.to_string_lossy();

        // Create shortcut using PowerShell WScript.Shell
        let ps_script = format!(
            "$w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut('{}'); $s.TargetPath = '{}'; $s.Description = 'Alitken Media Converter & Video Splitter'; $s.Save()",
            shortcut_str.replace("'", "''"),
            target_str.replace("'", "''")
        );

        let output = utils::create_hidden_cmd("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            let err_msg = format!("Failed to create SendTo shortcut: {}", err);
            utils::log_error(&err_msg);
            return Err(err_msg);
        }

        utils::log_info(&format!("Created SendTo shortcut at {:?}", shortcut_path));
        Ok(true)
    } else {
        if shortcut_path.exists() {
            fs::remove_file(&shortcut_path)
                .map_err(|e| format!("Failed to remove SendTo shortcut: {}", e))?;
        }
        utils::log_info("Removed SendTo shortcut");
        Ok(false)
    }
}/// Returns full integration status
pub fn get_integration_status() -> IntegrationStatus {
    let current_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    IntegrationStatus {
        sendto_active: is_sendto_active(),
        executable_path: current_exe,
    }
}
