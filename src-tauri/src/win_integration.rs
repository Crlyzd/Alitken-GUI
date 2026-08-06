use crate::utils;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct IntegrationStatus {
    pub sendto_active: bool,
    pub win11_menu_active: bool,
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
}

/// Checks if Windows Context Menu is registered (via fast HKCU registry key check)
pub fn is_win11_menu_active() -> bool {
    let output = utils::create_hidden_cmd("reg")
        .args(["query", r"HKCU\Software\Classes\*\shell\AlitkenMediaConverter"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output();

    // Registry key presence is the authoritative status indicator.
    // The slow Get-AppxPackage PowerShell fallback is intentionally omitted here
    // to keep modal open fast — AppxPackage cleanup happens during unregister only.
    matches!(output, Ok(out) if out.status.success())
}

/// Prepares resources and registers or unregisters the Windows Context Menu
pub fn set_win11_context_menu(enable: bool) -> Result<bool, String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let app_dir = current_exe
        .parent()
        .ok_or_else(|| "Failed to get executable directory".to_string())?;

    let manifest_path = app_dir.join("AppxManifest.xml");
    let dll_path = app_dir.join("alitken_shell_ext.dll");
    let crate_dll = app_dir.join("shell_ext_crate").join("target").join("debug").join("alitken_shell_ext.dll");

    // Copy compiled COM DLL if present in build tree
    if !dll_path.exists() && crate_dll.exists() {
        let _ = fs::copy(&crate_dll, &dll_path);
    }

    // 1. Instant HKCU Registry Shell Key Integration via reg.exe (Works 100% on Win 7, 10, 11)
    set_registry_context_menu(&current_exe, enable);

    if enable {
        // 2. Ensure required PNG icon assets exist
        ensure_manifest_assets(app_dir);

        // 3. Write/Update AppxManifest.xml in app_dir
        let manifest_content = generate_manifest(&current_exe);
        let _ = fs::write(&manifest_path, manifest_content);

        // 4. Register User-Scope COM DLL CLSID (must happen before AppxPackage registers)
        if dll_path.exists() {
            register_com_dll(&dll_path, true);
        }

        // 5. Sparse Package via Add-AppxPackage — SYNCHRONOUS so Tier 1 is active on return
        let manifest_str = manifest_path.to_string_lossy().to_string();
        let ps_register = format!(
            "Add-AppxPackage -Register -ForceApplicationShutdown '{}'",
            manifest_str.replace("'", "''")
        );
        let _ = utils::create_hidden_cmd("powershell")
            .args(["-NoProfile", "-Command", &ps_register])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        // 6. Flush Windows shell extension cache so Tier 1 appears without Explorer restart
        notify_shell_refresh();

        utils::log_info(&format!(
            "Registered Windows Context Menu for {:?}",
            current_exe
        ));
        Ok(true)
    } else {
        // Unregister User-Scope COM DLL
        register_com_dll(&dll_path, false);

        // Unregister Sparse Package — SYNCHRONOUS
        let _ = utils::create_hidden_cmd("powershell")
            .args(["-NoProfile", "-Command",
                "Get-AppxPackage -Name 'AlitkenMediaConverter' | Remove-AppxPackage"
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        // Flush shell cache
        notify_shell_refresh();

        utils::log_info("Unregistered Windows Context Menu");
        Ok(false)
    }
}

/// Helper to register user-scoped COM CLSID for alitken_shell_ext.dll
fn register_com_dll(dll_path: &Path, enable: bool) {
    let clsid_key = r"HKCU\Software\Classes\CLSID\{a117ce00-0000-0000-0000-000000000001}";
    let inproc_key = format!(r"{}\InprocServer32", clsid_key);
    let dll_str = dll_path.to_string_lossy();

    if enable {
        let _ = utils::create_hidden_cmd("reg")
            .args(["add", clsid_key, "/ve", "/d", "Alitken Context Menu Command", "/f"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .status();
        let _ = utils::create_hidden_cmd("reg")
            .args(["add", &inproc_key, "/ve", "/d", &dll_str, "/f"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .status();
        let _ = utils::create_hidden_cmd("reg")
            .args(["add", &inproc_key, "/v", "ThreadingModel", "/d", "Apartment", "/f"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .status();
    } else {
        let _ = utils::create_hidden_cmd("reg")
            .args(["delete", clsid_key, "/f"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

/// Notifies Windows shell to refresh its extension/context menu cache (no Explorer restart needed)
fn notify_shell_refresh() {
    let _ = utils::create_hidden_cmd("ie4uinit.exe")
        .arg("-show")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Helper to manage HKCU Registry Shell keys for Windows File & Directory Context Menu via fast reg.exe
fn set_registry_context_menu(exe_path: &Path, enable: bool) {
    let exe_str = exe_path.to_string_lossy();
    let cmd_str = format!("\"{}\" \"%1\"", exe_str);

    let keys = [
        r"HKCU\Software\Classes\*\shell\AlitkenMediaConverter",
        r"HKCU\Software\Classes\SystemFileAssociations\*\shell\AlitkenMediaConverter",
        r"HKCU\Software\Classes\Directory\shell\AlitkenMediaConverter",
    ];

    if enable {
        for key in &keys {
            let cmd_key = format!(r"{}\command", key);
            let _ = utils::create_hidden_cmd("reg")
                .args(["add", key, "/ve", "/d", "Convert with Alitken", "/f"])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .status();
            let _ = utils::create_hidden_cmd("reg")
                .args(["add", key, "/v", "Icon", "/d", &exe_str, "/f"])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .status();
            let _ = utils::create_hidden_cmd("reg")
                .args(["add", &cmd_key, "/ve", "/d", &cmd_str, "/f"])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .status();
        }
    } else {
        for key in &keys {
            let _ = utils::create_hidden_cmd("reg")
                .args(["delete", key, "/f"])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .status();
        }
    }
}

/// Generates fallback PNG icon assets required by AppX package schema
fn ensure_manifest_assets(app_dir: &Path) {
    let assets_dir = app_dir.join("assets");
    let _ = fs::create_dir_all(&assets_dir);

    // Minimal valid 44x44 RGBA PNG binary icon
    let png_bytes: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x2C, 0x08, 0x06, 0x00, 0x00, 0x00, 0xA9, 0xF7, 0x4E,
        0x85, 0x00, 0x00, 0x00, 0x1A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x18, 0x05, 0xA3,
        0x60, 0x14, 0x8C, 0x82, 0x51, 0x30, 0x0A, 0x46, 0x06, 0x00, 0x00, 0x54, 0x00, 0x01, 0x9E, 0xEB,
        0xA3, 0xB7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    let store_logo = assets_dir.join("StoreLogo.png");
    let square_150 = assets_dir.join("Square150x150Logo.png");
    let square_44 = assets_dir.join("Square44x44Logo.png");

    if !store_logo.exists() {
        let _ = fs::write(&store_logo, png_bytes);
    }
    if !square_150.exists() {
        let _ = fs::write(&square_150, png_bytes);
    }
    if !square_44.exists() {
        let _ = fs::write(&square_44, png_bytes);
    }
}

/// Generates dynamic AppxManifest.xml content for sparse package registration
fn generate_manifest(exe_path: &Path) -> String {
    let exe_name = exe_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let pkg_ver = format!("{}.0", env!("CARGO_PKG_VERSION"));
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  xmlns:desktop4="http://schemas.microsoft.com/appx/manifest/desktop/windows10/4"
  IgnorableNamespaces="uap uap10 desktop4 rescap">

  <Identity Name="AlitkenMediaConverter" Publisher="CN=Alitken" Version="{pkg_ver}" />

  <Properties>
    <DisplayName>Alitken Media Converter</DisplayName>
    <PublisherDisplayName>Alitken</PublisherDisplayName>
    <Logo>assets\StoreLogo.png</Logo>
  </Properties>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Applications>
    <Application Id="App" Executable="{}" EntryPoint="Windows.FullTrustApplication" uap10:TrustLevel="mediumIL">
      <uap:VisualElements
        DisplayName="Alitken Media Converter"
        Description="Media Converter &amp; Video Splitter"
        Square150x150Logo="assets\Square150x150Logo.png"
        Square44x44Logo="assets\Square44x44Logo.png"
        BackgroundColor="transparent" />
      <Extensions>
        <desktop4:Extension Category="windows.fileExplorerContextMenus">
          <desktop4:FileExplorerContextMenus>
            <desktop4:ItemType Type="*">
              <desktop4:Verb Id="ConvertWithAlitken" Clsid="a117ce00-0000-0000-0000-000000000001" />
            </desktop4:ItemType>
          </desktop4:FileExplorerContextMenus>
        </desktop4:Extension>
      </Extensions>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>"#,
        exe_name
    )
}

/// Returns full integration status
pub fn get_integration_status() -> IntegrationStatus {
    let current_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    IntegrationStatus {
        sendto_active: is_sendto_active(),
        win11_menu_active: is_win11_menu_active(),
        executable_path: current_exe,
    }
}
