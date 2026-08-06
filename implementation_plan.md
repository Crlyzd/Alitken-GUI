# Plan: Concise Hardware Detector & Always-on-Top Titlebar Toggle

Streamline the hardware acceleration status badge in `Titlebar.tsx` to eliminate redundant text, preventing truncation (`NVIDIA NVE...`) and freeing up horizontal space to introduce an **Always on Top** window pin toggle button.

---

## User Review Required

> [!IMPORTANT]
> **Titlebar Layout & Pin Button Placement:**
> The new **Always on Top Pin button** will be positioned directly before the Settings gear icon in the titlebar action group:
> `[App Logo ALITKEN v0.4]` $\rightarrow$ `(Drag Region)` $\rightarrow$ `[⚡ NVIDIA NVENC]` `[📌 Pin]` `[⚙️ Settings]` `[ⓘ Info]` `|` `[—]` `[🔲]` `[✕]`

> [!IMPORTANT]
> **Concise Hardware Badge Format:**
> Currently, the hardware badge renders `NVIDIA NVENC (h264_nvenc)`, taking up ~200px and resulting in truncation (`NVIDIA NVE...`).
> We will refine the badge display to:
> - **Primary concise label**: `NVIDIA NVENC` (or `NVENC` / `AMD AMF` / `Intel QSV` / `CPU (Software)`).
> - **Tooltip on hover**: Shows full details: e.g., `NVIDIA NVENC (h264_nvenc) - Hardware acceleration active`.

> [!TIP]
> **Always on Top Pin Button Behavior:**
> - **State**: Persisted in `localStorage` (`alitken_always_on_top`).
> - **Visual Feedback**: Glowing active badge style (`rgba(99, 102, 241, 0.2)`) when pinned (`ON`), muted subtle style when unpinned (`OFF`).

---

## Proposed Changes

### Rust Backend (`src-tauri`)

#### [MODIFY] [commands.rs](file:///d:/ALitken/Alitken-GUI-s/src-tauri/src/commands.rs)
- Add `set_always_on_top(window: tauri::Window, always_on_top: bool) -> Result<(), String>` IPC command.

#### [MODIFY] [lib.rs](file:///d:/ALitken/Alitken-GUI-s/src-tauri/src/lib.rs)
- Register `set_always_on_top` in `tauri::generate_handler![]`.

---

### React Frontend (`src`)

#### [MODIFY] [Titlebar.tsx](file:///d:/ALitken/Alitken-GUI-s/src/components/Titlebar.tsx)
- Import `Pin` icon from `lucide-react`.
- Format `displayHardwareName` cleanly (e.g. `NVIDIA NVENC`, `AMD AMF`, `Intel QSV`, `CPU`) without duplicating `(h264_nvenc)` inside the visible badge text.
- Add `isAlwaysOnTop` state initialized from `localStorage` (`alitken_always_on_top`).
- Add `handleToggleAlwaysOnTop` function invoking Tauri IPC / `@tauri-apps/api/window`.
- Render the Always on Top `<button>` right before the Settings button.

---

## Verification Plan

### Manual Verification
1. Launch Alitken dev app (`npm run tauri dev`).
2. Verify Titlebar Layout:
   - Confirm order: `[Badge]` `[Pin]` `[Settings]` `[Info]` `|` `[-]` `[Square]` `[Close]`.
   - Confirm Hardware Badge text displays cleanly (e.g., `⚡ NVIDIA NVENC`) without ellipsis truncation.
   - Hover over badge to confirm full technical info (`NVIDIA NVENC (h264_nvenc)`) is displayed in tooltip.
3. Verify Always on Top functionality:
   - Click the Pin button: icon turns active (glowing indigo/emerald), window stays pinned above all other desktop windows.
   - Click again to unpin: window reverts to normal stacking.
   - Restart app: confirm state persists based on stored preference.
