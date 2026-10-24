# Alitken Project History & Agent Knowledge Base (`history.md`)

This document is the official, persistent project history, architecture log, and agent mistake register for **Alitken** (`Alitken-GUI`).

---

## ⚠️ Mandatory Agent Rules for Using This Document

All AI agents working on this repository MUST strictly follow these rules:

1. **Pre-Planning Inspection (Mandatory)**:
   - Before designing any architecture, creating an implementation plan (`/architect`, `/proceed`, `/plan`), or writing code, agents **MUST ALWAYS read this document first**.
   - Check the **Mistake & Anti-Pattern Register** below to ensure the proposed approach does not repeat any previously recorded errors or violated user expectations.

2. **Code Change Gist Logging**:
   - Every time an agent modifies, refactors, or adds code in the codebase, the agent **MUST record a concise gist of the change** in the **Code Evolution & Change Gist Log** section under the relevant release/version milestone.
   - Keep entries focused on what changed, why, and which modules were touched (no verbose filler).

3. **Mistake & Negative Feedback Registration**:
   - Whenever the user expresses negative feedback or corrects the agent (e.g., using phrases such as *"don't do this"*, *"this isn't what I expected"*, *"I never told you to do this"*, *"why did you do that"*, etc.), the agent **MUST immediately log the incident** in the **Mistake & Anti-Pattern Register** section.
   - Tag the entry as `[MISTAKE]` or `[CORRECTION]`.
   - Specify:
     - **Context & What Occurred**: What action the agent took that prompted the correction.
     - **User Feedback**: The user's exact or core objection.
     - **Root Cause & Anti-Pattern**: Why the approach was flawed.
     - **Strict Actionable Invariant**: The permanent rule that must be obeyed to prevent future repetition.

---

## 🏛️ Project Architecture & Evolution Overview

- **Project Core**: Modern, ultra-fast Windows 11 desktop media converter, video trimmer, segment splitter, concatenator, and frame burst extractor built on Tauri v2 (Rust) and React 18 / TypeScript 5.7.
- **Hardware Acceleration**: Automatic probing and hardware encode dispatch for NVIDIA NVENC (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`), AMD AMF (`h264_amf`, `hevc_amf`, `av1_amf`), and Intel QuickSync (`h264_qsv`, `hevc_qsv`, `av1_qsv`), with VideoLAN `libdav1d` AV1 decoding (700+ FPS) and CPU fallbacks (`libx264`, `libx265`, `libaom-av1`).
- **Windows Media Foundation (WMF)**: Direct D3D11/MF hardware frame extraction, filmstrip generation, and RGB32 preview seeking via `wmf/mod.rs`.
- **Dynamic 2-Phase Window Geometry**:
  - *Startup Mode*: Fixed 1:1 square window (`500×500 px`, non-resizable across all edges, zero DWM border stroke, centered).
  - *Working Mode*: Expands smoothly to `1060×720 px` (minimum bound `1040×700 px`, resizable) upon loading media files.
  - *Collapse*: Reverts to `500×500 px` on clearing queue, triggering immediate working set memory compaction (`utils::trim_working_set()`).
- **Branding Standard**: Titlebar header branding strictly follows `ALITKEN v<version>` or `Alitken v<version>`.

---

## 📜 Version Milestones & Key Highlights

### v0.9.2 (Current Version)
- **Unified Master Build Engine**: Consolidated all separate forwarders (`bump-version.ps1`, `scripts/build-releases.ps1`, `scripts/generate-msix-assets.ps1`) into a single all-in-one developer tool (`build.ps1`). Hardened version bump interactive workflow with strict input validation, direct `-Bump` execution, and cancellation handling.
- **UI Light Mode Accessibility**: Refined theme-aware accent tokens (`--accent-amber`, `--accent-kofi`, `--accent-cyan`, `--accent-emerald`), eliminating washed-out icons in the About modal and related views.
- **Donation Provider Update**: Replaced PayPal donation links with Ko-fi across frontend modal actions and project documentation.

### v0.9.1
- **MediaInfo-Grade Stream Inspector**: Added deep stream specifications inspector (`MediaDetailsModal.tsx`, `MediaSpecsVisualView.tsx`, stream specs probe) displaying comprehensive audio/video codecs, color spaces, bit depths, chroma subsampling, sample rates, channels, and container specs with visual badge views.
- **Dependency Toolchain Robustness**: Enforced complete toolchain validation checking both `ffmpeg.exe` and `ffprobe.exe` (plus `magick.exe`); added incomplete toolchain status handling and selective binary pruning upon uninstall so third-party user binaries in `%LOCALAPPDATA%\curlyzed\bin\` are never wiped out.
- **Updater Resilience**: Added download cancellation support, GitHub API rate-limit fallback handling, and modal state cleanup preventing UI hangs or flashing.
- **Master Developer Tool (`build.ps1`)**: Consolidated all developer workflows, local dev mode, visual asset generation, version bumping, updater signing, and multi-target release packaging (MSIX, NSIS, Portable for x64/ARM64) into a single unified script.

### v0.9.0
- **DWM Stroke Elimination & Window Lock**: Removed 1px DWM border stroke on Windows 11; strictly locked startup window resizing across all four edges and corners (`window.rs`).
- **Modular Domain Refactoring**: Decomposed monolithic frontend components into modular sub-packages (`queue/`, `trimmer/`, `config/`, `video-config/`, `image-config/`, `titlebar/`, `welcome/`, `ui/`, `modals/`, `settings/`, `banners/`) maintaining root re-export shims.
- **About Modal Reorganization**: Revamped about actions into a sleek 2x2 grid with repository and website links.

### v0.8.0 – v0.8.4
- **Tauri v2 Migration**: Transformed CLI codebase into native Windows borderless glass GUI with Acrylic/Mica effects, dark/light theme engine, and custom `Titlebar.tsx`.
- **3-Tier Preview & Scrubbing Engine**: Tier 1 direct HTML5 streaming, Tier 2 lossless container remux (`<200ms`), Tier 3 GPU hardware proxy and WMF base64 frame preview.
- **Interactive Video Trimmer**: Dual in/out slider with microsecond-accurate timeline, real-time audio scrub mute, and storage validation.
- **Playback Speed Engine**: 0.10x–50.00x playback speed scaling with fast duplicate frame mode vs AI optical smooth (`minterpolate`), and chained `atempo` audio pitch preservation.

---

## 📝 Code Evolution & Change Gist Log

*Record high-level summaries of changes here whenever code is modified:*

### [2026-10-24] v0.9.2 - Automated Microsoft Store MSIX Bundle (.msixbundle) Packaging
- **`build.ps1`**: Integrated automated multi-architecture bundle packaging (`MakeAppx.exe bundle`) in `Invoke-ReleasePipeline` under MS Store targets; combines `_MSStore_64.msix` and `_MSStore_ARM64.msix` into a single `Alitken_v<ver>_MSStore.msixbundle` ready for 1-file upload to Microsoft Partner Center; updated `Invoke-CleanCaches` to purge `msix_bundle_staging`; updated menu descriptions for options `[6]` and `[8]` to reflect unified `.msixbundle` generation.

### [2026-10-24] v0.9.2 - Trimmer Seekbar Cursors, Shift+Drag Guard, Single-Click Summon & Zoom Edge Helper
- **`src/components/trimmer/timeline/useTimelineZoom.ts`**: Replaced indefinite boolean `wasPanningRef` with timestamp-based window (`lastPanEndTimeRef`) in `checkWasPanning()`, eliminating the two-click playhead summon bug caused by browser-suppressed trailing click events after pointer-captured pan drags; added global `Shift` key tracking and exported `isShiftPressed`.
- **`src/components/trimmer/timeline/useTimelineScrubber.ts`**: Guarded selected range dragging behind `e.shiftKey`, falling back to immediate playhead seek and scrub navigation when Shift is not held; added instant `onSeek` execution on playhead `pointerdown`.
- **`src/components/trimmer/timeline/TimelineSlider.tsx`**: Standardized default track cursor to hand pointer 👆 (`pointer`); wired `isShiftPressed` down to `RangeHandles`; added industry-standard timeline gesture tooltips; wired track pointerdown to initiate instant playhead scrubbing.
- **`src/components/trimmer/timeline/RangeHandles.tsx`**: Set default cursor on selected range to hand pointer 👆 (`pointer`), switching dynamically to `grab` / `grabbing` only when Shift is held; updated tooltips to industry standard (`Selected Range (Click to seek • Shift + Drag to move range)`, in/out trim hints, playhead scrub hint).
- **`src/components/trimmer/VideoCanvasRenderer.tsx`**: Decomposed the crop border into 4 discrete edge lines applying GPU matrix counter-scaling (`scaleY(${invScale})` on top/bottom and `scaleX(${invScale})` on left/right), mathematically canceling parent `scale(${cropScale})` and locking screen line thickness to exactly 1.5px across all zoom levels; fixed CSS `transformOrigin` on Left Edge (`left center`) and Right Edge (`right center`); anchored `<video>` and fallback `<img>` with `position: absolute; inset: 0; width: 100%; height: 100%; objectFit: fill`, taking them out of flexbox centering and eliminating video protrusion past wireframe lines so the white border and corner handles sit precisely on the perimeter of the video; refined corner handles to 8px circles with crisp dark border matching CapCut wireframe proportions.
- **`src/components/trimmer/VideoPlayerViewport.tsx`**: Integrated `ResizeObserver` on `viewportRef` to dynamically set `width: 100%, height: auto` vs `width: auto, height: 100%` on `containerRef`, guaranteeing that the black canvas container strictly preserves `canvasAspect` without distorting when the viewport aspect ratio is narrower than 16:9; added `margin: '0 auto'` on `containerRef` to ensure portrait and square canvases center horizontally; set `background: aspectRatio === 'ORIGINAL' ? 'transparent' : '#000000'` on `containerRef` so no black container background is exposed in Light Mode; streamlined overlay styles keeping file under 285 lines.

### [2026-10-24] v0.9.2 - Bump Application Version to v0.9.2
- **`package.json` & `package-lock.json`**: Bumped patch version from `0.9.1` to `0.9.2`.
- **`src-tauri/tauri.conf.json`**: Synchronized package version to `0.9.2` and main window title to `ALITKEN v0.9.2`.
- **`src-tauri/Cargo.toml`**: Synchronized Rust package version to `0.9.2`.
- **`index.html`**: Updated document title to `ALITKEN v0.9.2`.
- **`build.ps1`**: Updated fallback version string to `0.9.2`.

### [2026-10-24] v0.9.1 - Consolidate Scripts into All-In-One build.ps1 & Fix Version Bump
- **`build.ps1`**: Converted `-Bump` into a dedicated switch parameter and added `-BumpType` for direct invocation (`./build.ps1 -Bump` or via `npm run bump`); hardened `Invoke-VersionBumpWorkflow` with strict input validation to prevent accidental patch increments on input typo; added custom version prompt handling; resolved double-pause return bug on cancellation (`B`).
- **`package.json`**: Updated `"bump"` script to invoke `./build.ps1 -Bump` directly.
- **Removed Forwarders**: Deleted redundant single-line forwarders `bump-version.ps1`, `scripts/build-releases.ps1`, and `scripts/generate-msix-assets.ps1`, centralizing all build, dev, release packaging, asset generation, and version synchronization into `build.ps1`.

### [2026-10-24] v0.9.1 - Light Mode Icon Contrast & Theme Token Enhancements
- **`src/index.css`**: Tuned light mode `--accent-amber` to `#b45309` for WCAG AA compliant contrast (> 4.5:1) against frosted glass backdrops; defined theme-aware `--accent-kofi`, `--kofi-bg`, and `--kofi-border` tokens for dark and light modes.
- **`src/components/modals/about/AboutLinksGrid.tsx`**: Replaced hardcoded `#f59e0b` on `<Bug>` with `var(--accent-amber)` and `#38bdf8` on `<Folder>` with `var(--accent-cyan)`, eliminating washed-out icons in light mode.
- **`src/components/modals/about/AboutBrandingSection.tsx`**: Replaced hardcoded `#f59e0b` on `<Coffee>` with `var(--accent-amber)`; wired Ko-fi button to theme-aware `var(--kofi-bg)`, `var(--kofi-border)`, and `var(--accent-kofi)` for high-contrast presentation.
- **`src/components/modals/about/UpdateCheckerSection.tsx`**: Replaced hardcoded `#10b981` on `<CheckCircle2>` and `<ArrowUpCircle>` with `var(--accent-emerald)`, rendering deep legible green in light mode and vibrant emerald in dark mode.

### [2026-10-24] v0.9.1 - Replace PayPal Donation Link with Ko-fi
- **`src/components/modals/about/AboutBrandingSection.tsx`**: Replaced PayPal donation link (`https://paypal.me/BagusMassani`) with Ko-fi (`https://ko-fi.com/curlyzed`), updated button label to `Ko-fi`, and styled with frosted-glass coral accent (`#ff5e5b`).
- **`README.md`**: Replaced PayPal global donation shield badge with Ko-fi badge linking to `https://ko-fi.com/curlyzed`.

### [2026-10-24] v0.9.1 - Disable Maximize Button & Windows Snap in Startup Mode
- **`src-tauri/tauri.conf.json`**: Added `"maximizable": false` to main window config to prevent native maximization and snap layout assists on initial launch.
- **`src-tauri/src/lib.rs`**: Explicitly enforced `main_window.set_maximizable(false)` during `setup()`.
- **`src-tauri/src/window.rs`**: Intercepted `SC_MAXIMIZE` alongside `SC_SIZE` in `WM_SYSCOMMAND` within Win32 subclass proc while `IS_STARTUP_RESIZE_LOCKED` is true, blocking Windows 11 Aero Snap / Snap Assist when dragging the window to the top monitor edge or pressing `Win + Up`.
- **`src-tauri/src/commands/system.rs`**: Unmaximized and disabled maximizability (`window.set_maximizable(false)`) in `collapse_to_startup_window`, restored maximizability (`window.set_maximizable(true)`) in `expand_to_working_window`, and guarded `toggle_maximize_window` against execution when startup resize is locked.
- **`src/components/titlebar/WindowControls.tsx`**: Added `isMaximizable` prop support; styled disabled maximize button with dimmed opacity (`0.35`), `not-allowed` cursor, disabled attribute, descriptive tooltip, and suppressed hover highlights.
- **`src/components/titlebar/Titlebar.tsx`**: Added `isMaximizable` prop and forwarded down to `WindowControls`.
- **`src/App.tsx`**: Calculated `isMaximizable={files.length > 0 || activeView === 'trimmer'}` and passed to `Titlebar`.

### [2026-10-24] v0.9.1 - Video Trimmer Seekbar Zoom & Current Timestamp
- **`src/components/trimmer/timeline/useTimelineZoom.ts`**: Created modular custom hook for seekbar zoom scaling (1.0x to 10.0x), cursor-anchored wheel zooming (`Ctrl + Wheel` / trackpad pinch), interactive `Ctrl + Drag` seekbar panning with boundary clamping, global Ctrl key tracking, and playhead auto-tracking restricted strictly to active playback. Fixed sling-back snap bug by preventing auto-scroll when paused or user-panned, and added `centerOnTime` convenience re-center helper.
- **`src/components/trimmer/timeline/TimelineZoomControls.tsx`**: Created sleek frosted-glass zoom controls (`-`, `+`, `1.0x Reset`) with hover effects and descriptive gesture tooltips matching the Windows 11 acrylic/mica design system.
- **`src/components/trimmer/timeline/TimelineSlider.tsx`**: Integrated real-time playback position display (`Current: HH:MM:SS.mmm • Selected: HH:MM:SS.mmm`), clickable `Current` timestamp badge to re-center on playhead, embedded zoom controls, eliminated visible scrollbars via `.no-scrollbar`, and wired `Ctrl + Drag` pan interaction with dynamic `grab`/`grabbing` cursor states.
- **`src/components/VideoTrimmer.tsx`**: Forwarded `isPlaying` state to `TimelineSlider` to prevent auto-scroll from overriding manual pans when paused.
- **`src/components/trimmer/timeline/useTimelineScrubber.ts`**: Refined hover thumbnail tooltip positioning to clamp against the visible scroll viewport, and bypassed handle dragging when Ctrl or middle click is pressed.
- **`src/index.css`**: Added `.no-scrollbar` utility eliminating scrollbars across Chromium/WebView2 and Firefox while retaining smooth programmatic and gesture panning.
- **`src/components/trimmer/timeline/index.ts`**: Exported `TimelineZoomControls` and `useTimelineZoom`.

### [2026-10-22] v0.9.1 - Agent Architecture & History System Update
- **`.agents/AGENTS.md`**: Updated project version to v0.9.1. Added mandatory rules for `history.md` tracking, multi-file commit grouping & automated execution, and strict release notes generation (artifacts-only, no quotes `>`, no emojis, delta-only, mandatory structure).
- **`.agents/skills/alitken-expert/SKILL.md`**: Updated codebase references to v0.9.1, incorporated MediaInfo inspector, unified `build.ps1`, updater cancellation, and commit/release note policies.
- **`.agents/workflows/proceed.md`**: Added mandatory pre-planning review of `history.md` in Phase 1 and post-execution change logging in Phase 2.
- **`history.md`**: Initialized project history, architecture log, and mistake register in project root.
- **`build.ps1`**: Updated fallback version strings to `0.9.1`.

---

## 🛑 Mistake & Anti-Pattern Register

*Agents MUST inspect this section before formulating any plan or writing code. Never repeat documented mistakes.*

### 1. Release Notes Formatting & Placement
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Writing release notes directly in the project workspace, using Markdown blockquote `>` symbols, using decorative emojis, or writing generic boilerplate covering already released features.
- **Root Cause**: Cluttered workspace, visual pollution with blockquotes, unprofessional appearance with emojis, and lack of delta isolation between releases.
- **Strict Invariants**:
  1. **NEVER** write release notes in the project repository folder (`/`). **ALWAYS** write release notes as an artifact document in the system artifacts directory (`<appDataDir>\brain\<conversation-id>/release_notes_v<version>.md`).
  2. **NEVER** use `>` (Markdown blockquote / alert quote) in release notes. It looks ugly to the user.
  3. **NEVER** use emojis in release notes.
  4. **NEVER** include download links in release notes.
  5. **NEVER** rehash or include changes already covered in previous release notes; inspect git delta (`git log <prev_tag>..HEAD --oneline`) and only document net-new changes.
  6. **ALWAYS** use professional, technical, objective language without hype or excessive enthusiasm.
  7. **ALWAYS** use the required 7-part format:
     - Title
     - Target of the change / release note
     - Summary of the change
     - Detailing what changed
     - Explain why the change was made
     - Bug fixing (if any)
     - Technical details and commits covered by the release note.

### 2. Commit Message Generation & Multi-File Execution
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Proposing a single massive commit for unrelated changes, writing repetitive/duplicate commit messages, or asking the user to manually run the commit commands.
- **Root Cause**: Lack of change grouping and making the user manually copy-paste commit commands when agents can safely execute them.
- **Strict Invariants**:
  1. When asked for commit messages, agents **MUST inspect all changed/untracked files** (`git status`, `git diff`).
  2. **Group files by similarity / logical category** (e.g., UI/Styling, Backend/Rust, Build/Scripts, Config/Deps, Documentation).
  3. For each group, stage files group-by-group (`git add <files>`) and craft a two-tier commit message:
     - Bullet points documenting each specific file change (e.g., `- adjust UI ...`)
     - A broader batch summary explaining the overarching purpose and fix
  4. **Directly execute the commit command** (`git commit -m "..."`) via shell tool so the user does not have to type it manually.
  5. Report committed groups clearly so the user can inspect with `git log`.

### 3. File Ceiling & Monolith Prevention
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Bloating coordinator shell components (`Dropzone.tsx`, `ConfigPanel.tsx`, `VideoTrimmer.tsx`) or writing oversized single-file components.
- **Root Cause**: Violating modular domain decomposition and ignoring line limits.
- **Strict Invariants**:
  1. Frontend components/hooks have a strict ceiling of **250–300 lines**.
  2. Backend Rust modules have a strict ceiling of **300–400 lines** (functions under **50–60 lines**).
  3. Always decompose new UI logic into domain subcomponents under `src/components/<domain>/`.

### 4. Zero Native `<select>` UI Policy
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Using browser-native `<select>` dropdowns or unstyled floating popups without frosted glass.
- **Root Cause**: Breaking the Windows 11 acrylic/mica glassmorphism aesthetic.
- **Strict Invariants**:
  1. All dropdowns, selectors, and pickers **MUST** use `GlassSelect.tsx` or apply the frosted glass tokens (`backdrop-filter: blur(20px)`, `border: 1px solid var(--border-glass)`).

### 5. CSS Transform-Origin Keyword Order & Container Aspect Distortion
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Vertical edge wireframe lines disappeared when video was edge-snapped to a 16:9 canvas because left and right lines were clipped by `overflow: hidden`, while top and bottom lines remained visible.
- **Root Cause**:
  1. CSS `transform-origin` expects `<horizontal> <vertical>` keyword syntax (e.g., `left center`, `right center`). Supplying `center left` or `center right` was rejected as invalid CSS by Chromium's parser, causing fallback to `50% 50%` (center center) which pushed 50% of the 1.5px border outside the container boundary into the `overflow: hidden` clip plane.
  2. The black canvas container (`containerRef`) had hardcoded `height: 100%`, which distorted the canvas aspect ratio whenever the window viewport was narrower than `canvasAspect`, leaving black letterboxing at the top/bottom while clamping the video width flush to the container boundary.
- **Strict Invariants**:
  1. Always use valid CSS `transform-origin` keyword syntax (`left center`, `right center`, `top center`, `bottom center`) when scaling wireframes and handles.
  2. Never hardcode `height: 100%` on aspect-ratio canvas containers without accounting for narrow viewports (`width: 100%, height: auto` when `viewportAspect < canvasAspect`).

