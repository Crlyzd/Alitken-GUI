# Standalone One-Click Version Bumping Script (`bump-version.ps1`)

Architectural plan for implementing a dedicated, standalone PowerShell script (`bump-version.ps1`) in the root directory to handle version bumping independently from `build.ps1`.

## User Review Required

> [!IMPORTANT]
> `bump-version.ps1` will be completely **separate and decoupled** from `build.ps1`. `build.ps1` remains untouched for building/packaging, while `bump-version.ps1` is dedicated solely to version management and synchronization.

## Open Questions

None.

## Proposed Changes

### Root Folder

#### [NEW] [bump-version.ps1](file:///d:/ALitken/Alitken-GUI-s/bump-version.ps1)
Create a standalone interactive PowerShell script:
- Completely separate from `build.ps1`.
- Reads current version from [package.json](file:///d:/ALitken/Alitken-GUI-s/package.json).
- Displays interactive options when double-clicked:
  - `[1] Patch bump` (e.g., `0.4.1` -> `0.4.2`) [Default]
  - `[2] Minor bump` (e.g., `0.4.1` -> `0.5.0`)
  - `[3] Major bump` (e.g., `0.4.1` -> `1.0.0`)
  - `[4] Custom Version`
- Executes `npm version <choice>`, which triggers `scripts/sync-version.cjs` to update:
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
- Displays colorful summary of updated files.
- Pauses at the end so the console window remains open when launched from File Explorer.

#### [MODIFY] [package.json](file:///d:/ALitken/Alitken-GUI-s/package.json)
Add a convenience npm script `"bump": "powershell -ExecutionPolicy Bypass -File ./bump-version.ps1"`.

---

## File Structure

```
Alitken-GUI-s/
├── bump-version.ps1       [NEW] Dedicated version bumping script (Separate from build.ps1)
├── build.ps1              [UNTOUCHED] Build script
├── package.json           [MODIFY] Add "bump" command to scripts
└── scripts/
    └── sync-version.cjs   [UNTOUCHED] Version sync engine
```

---

## Step-by-Step Plan

1. **Create `bump-version.ps1`**:
   - Write isolated PowerShell script with CLI parameters (`-Type`, `-Version`).
   - Implement `package.json` reading and version detection.
   - Present clean interactive prompt for version choice.
   - Run `npm version` and handle output/errors gracefully.
   - Output colorful success summary.
   - Keep window open with `ReadKey` pause for 1-click Explorer convenience.

2. **Update `package.json`**:
   - Add `"bump"` script entry pointing to `./bump-version.ps1`.

---

## Verification Plan

### Manual Verification
1. Test running `.\bump-version.ps1` from PowerShell terminal.
2. Test double-clicking `bump-version.ps1` in Windows Explorer.
3. Verify `build.ps1` functions completely independently as before.
