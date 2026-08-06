# Plan: Workspace Audit & Cleanup (Option B Approved)

Clean up the **Alitken Media Converter** workspace by removing unnecessary loose files (`magick.exe`), obsolete IDE folders (`.vscode/`), and Rust build caches (`src-tauri/target/`), while retaining `dist/` per user selection alongside all core application source code, assets, and project configurations.

---

## Approved Execution Actions

1. **Delete Loose Stray Binary (`magick.exe`)**:
   - `d:\ALitken\Alitken-GUI-s\magick.exe` (31.1 MB).
   - *Reasoning*: Binaries are dynamically managed in `%LOCALAPPDATA%\Alitken\bin\` or local `bin/`. Loose executable in root is unnecessary workspace clutter.

2. **Delete Obsolete VS Code Directory (`.vscode/`)**:
   - Contains `c_cpp_properties.json` from legacy C++ shell extension work (superseded by Rust `shell_ext_crate`).

3. **Clean Rust Build Cache (`src-tauri/target/`)**:
   - Execute `cargo clean` in `src-tauri/` to clean multi-gigabyte build artifacts.

4. **Preserved Folders & Files (Per Option B)**:
   - `dist/` (Kept per user selection).
   - `src/` (All React TypeScript components, styles, fonts, hooks, utilities).
   - `src-tauri/` (All Rust backend modules and Tauri configs).
   - `.agents/`, `public/`, `scripts/`, `package.json`, `vite.config.ts`, `tsconfig.json`, `build.ps1`, `LICENSE`, `README.md`, `.gitignore`.

---

## Proposed Changes

### Project Root Directory

#### [DELETE] [magick.exe](file:///d:/ALitken/Alitken-GUI-s/magick.exe)
- Delete stray ImageMagick binary from root.

#### [DELETE] [.vscode](file:///d:/ALitken/Alitken-GUI-s/.vscode)
- Delete stale VS Code C++ properties configuration directory.

#### [DELETE] [src-tauri/target](file:///d:/ALitken/Alitken-GUI-s/src-tauri/target)
- Run `cargo clean` inside `src-tauri/` directory.

#### [MODIFY] [implementation_plan.md](file:///d:/ALitken/Alitken-GUI-s/implementation_plan.md)
- Updated with Option B approved strategy.

---

## Step-by-Step Execution Plan

1. Remove `magick.exe` from `d:\ALitken\Alitken-GUI-s\magick.exe`.
2. Remove `.vscode` directory recursively from `d:\ALitken\Alitken-GUI-s\.vscode`.
3. Run `cargo clean` in `d:\ALitken\Alitken-GUI-s\src-tauri`.
4. Run `npx tsc --noEmit` to verify frontend TypeScript compilation.

---

## Verification Plan

- Verify file deletion in workspace root.
- Run `npx tsc --noEmit` to confirm zero TypeScript compile errors.
