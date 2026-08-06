# Implementation Plan - Scrap Windows 11 Main Right-Click Menu (Sparse Package) Feature

Completely remove all code, commands, types, helper logic, UI components, and sub-crates related to the **Windows 11 Main Right-Click Menu** (Sparse Package / COM DLL Shell Extension) integration feature, leaving the portable Windows "Send To" menu integration intact.

## User Review Required

> [!IMPORTANT]
> This plan permanently removes the Windows 11 Primary Context Menu / Sparse Package shell extension integration (`alitken_shell_ext.dll`, `AppxManifest.xml` generation, registry context menu hooks, and the frontend toggle card in Settings). The classic portable **Windows "Send To" Menu** integration will remain fully active and supported.

## Proposed Changes

### Frontend Components & Types

#### [MODIFY] [SettingsModal.tsx](file:///d:/ALitken/Alitken-GUI-s/src/components/SettingsModal.tsx)
- Remove `loadingWin11` state variable.
- Remove `handleToggleWin11Menu` handler function.
- Clean up `handleToggleSendTo` failure fallback object (remove `win11_menu_active`).
- Remove **Toggle 2: Windows 11 Main Right-Click Menu (Sparse Package)** card from the render JSX (lines 906-1017).

#### [MODIFY] [media.ts](file:///d:/ALitken/Alitken-GUI-s/src/types/media.ts)
- Remove `win11_menu_active: boolean;` field from the `IntegrationStatus` interface.

---

### Backend Rust Modules (Tauri App)

#### [MODIFY] [win_integration.rs](file:///d:/ALitken/Alitken-GUI-s/src-tauri/src/win_integration.rs)
- Remove `win11_menu_active` field from `IntegrationStatus` struct.
- Remove Windows 11 context menu helper functions:
  - `is_win11_menu_active()`
  - `set_win11_context_menu()`
  - `register_com_dll()`
  - `notify_shell_refresh()`
  - `set_registry_context_menu()`
  - `ensure_manifest_assets()`
  - `generate_manifest()`
- Update `get_integration_status()` to construct `IntegrationStatus` with only `sendto_active` and `executable_path`.

#### [MODIFY] [commands.rs](file:///d:/ALitken/Alitken-GUI-s/src-tauri/src/commands.rs)
- Remove `set_win11_context_menu_status` Tauri command function.

#### [MODIFY] [lib.rs](file:///d:/ALitken/Alitken-GUI-s/src-tauri/src/lib.rs)
- Remove `set_win11_context_menu_status` from `tauri::generate_handler![...]`.

---

### Build Scripts & Auxiliary Files

#### [DELETE] [shell_ext_crate](file:///d:/ALitken/Alitken-GUI-s/src-tauri/shell_ext_crate)
- Remove the `src-tauri/shell_ext_crate` folder (COM DLL crate for shell extension).

#### [MODIFY] [sync-version.cjs](file:///d:/ALitken/Alitken-GUI-s/scripts/sync-version.cjs)
- Remove Step 3 (`shellCargoTomlPath` sync step) which updated `src-tauri/shell_ext_crate/Cargo.toml`.

---

## Verification Plan

### Automated Verification
- Run `npm run build` or `npx tsc --noEmit` to verify TypeScript type checking completes without errors.
- Run `cargo check --manifest-path src-tauri/Cargo.toml` to verify Rust compilation succeeds cleanly.

### Manual Verification
- Launch application settings (`Preferences & Integrations` modal).
- Confirm only **Appearance Mode**, **Media Engines**, and **Windows "Send To" Menu** are displayed.
- Confirm toggling "Send To" menu works as expected.
