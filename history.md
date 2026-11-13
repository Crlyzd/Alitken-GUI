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

### v0.9.3 (Current Version)
- **Coexisting Animated WebP & GIF Engine (`video/gif.rs`, `image_to_video/`)**: Added streaming 24-bit Animated WebP (`-c:v libwebp`, up to `1080p`, optional 8-bit `yuva420p` alpha transparency in Image mode) alongside 256-color O(1)-memory Animated GIF (`stats_mode=single` + `paletteuse=new=1`, capped at `720p`) across batch Video Convert, Video Trimmer, and Image-to-Animation pipelines, plus `[0]` first-frame safety for `.psd`, `.psb`, `.ico`, `.gif`, and `.webp` inputs.

### v0.9.2
- **Automated MS Store `.msixbundle` Packaging**: Integrated `MakeAppx.exe bundle` in `build.ps1` combining x64 and ARM64 MSIX packages into a single `.msixbundle`.
- **Trimmer Seekbar Zoom & Crop Wireframe Precision**: Added cursor-anchored seekbar zoom (`1.0x–10.0x`), `Shift + Drag` range move guard, single-click playhead summon, and GPU matrix counter-scaled 1.5px crop wireframe edge lines (`VideoCanvasRenderer.tsx`).
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

### [2026-11-14] v0.9.3 - Bump Application Version to v0.9.3
- **`.agents/` Docs & Skills Sync (`.agents/AGENTS.md`, `.agents/skills/alitken-expert/SKILL.md`, `.agents/workflows/proceed.md`, `history.md`)**: Updated current version references (`v0.9.3`), Startup Mode maximize/Snap lock, `.msixbundle` packaging, trimmer zoom/wireframe precision, O(1)-memory Animated WebP & GIF pipelines, updated directory tree, and fixed stale `file:///e:/Default/...` links to `file:///d:/ALitken/Alitken-GUI/...`.
- **`package.json` & `package-lock.json`**: Bumped patch version from `0.9.2` to `0.9.3` via `build.ps1 -Bump -Version "0.9.3"`.
- **`src-tauri/tauri.conf.json`**: Synchronized package version to `0.9.3` and main window title to `ALITKEN v0.9.3`.
- **`src-tauri/Cargo.toml` & `src-tauri/Cargo.lock`**: Synchronized Rust package version to `0.9.3`.
- **`index.html`**: Updated document title to `ALITKEN v0.9.3`.
- **`build.ps1`**: Updated `Get-AppVersion` fallback version strings to `0.9.3`.

### [2026-11-14] v0.9.2 - Add Animated WebP Support & O(1) Memory Streaming for WebP/GIF
- **Video & Trimmer Animated WebP (`src-tauri/src/ffmpeg/video/gif.rs`, `types.rs`)**: Added streaming 24-bit Animated WebP (`-c:v libwebp`, `format=yuv420p`, `-quality 80 -compression_level 3` High Detail / `-quality 65 -compression_level 4` Compact Size, `-loop 0|1`, up to `1080p`) alongside GIF (`720p` max) via `anim_format`; upgraded `build_gif_palette_filter` to `stats_mode=single` + `paletteuse=...:new=1` for O(1) memory streaming.
- **Image-to-WebP & Input Safety (`src-tauri/src/ffmpeg/image_to_video/mod.rs`, `pipe.rs`, `demuxer.rs`, `src-tauri/src/image/convert.rs`)**: Extended `image_to_video` Tier 1 (`pipe.rs`) and Tier 2 (`demuxer.rs`) with `export_webp` (`.webp`, `1080p` max, `yuva420p` 8-bit smooth alpha when transparent, `-c:v libwebp` streaming); upgraded `gif_palette_filter_stage` to `stats_mode=single` + `new=1`; appended `[0]` first-frame selection for `.webp` (and `.gif`/`.ico` in `image/convert.rs`).
- **Frontend UI & Hooks (`src/types/`, `src/App.tsx`, `src/hooks/`, `src/components/video-config/`, `src/components/image-config/`, `src/components/config/`, `src/components/trimmer/`, `src/components/VideoTrimmer.tsx`)**: Added `animFormat` (`'WEBP' | 'GIF'`, default `'WEBP'`) with 4-card `WEBP / GIF` selector, `[Animated WebP | Animated GIF]` sub-toggle, `1080p` WebP / `720p` GIF resolution caps (auto-clamping `1080p` -> `720p` on GIF switch), 3-pill `[MP4 Video | Anim WebP | Anim GIF]` selector in Image mode, and dynamic progress/CTA labels.
- **Image Category Pill Layout (`src/styles/image-config.css`, `src/components/image-config/FormatSelector.tsx`)**: Updated `.image-config-category-grid` (`minmax(0, 1fr)`) and `.image-config-category-btn` (`font-size: 11.5px`, `padding: 8px 6px`, `gap: 5px`, `min-width: 0`) with compact `14px` `flexShrink: 0` icons to prevent right-edge clipping of the `"Video & Animation"` category pill.
- **`.agents/skills/alitken-pipelines/SKILL.md`**: Documented Animated WebP (`libwebp`), O(1) GIF streaming (`stats_mode=single` + `new=1`), and `[0]` `.webp` input handling.

### [2026-11-13] v0.9.2 - Enforce 720p GIF Ceiling & Clean Target Resolution Labels
- **`src/components/video-config/ResolutionSelector.tsx` & `src/types/config.ts`**: Removed `360p Compact (GIF / Web)` option and unused `'360'` entry in `PRESET_HEIGHTS`; filtered `Target Resolution` dropdown in GIF mode strictly to `720p HD`, `480p SD`, and `Custom Height (144 - 720 px)` with active clamping on change/blur.
- **`src/components/video-config/CodecSelector.tsx`**: Auto-clamped `ORIGINAL` and any height `> 720` down to `'720'` when switching into GIF mode.
- **`src/components/image-config/VideoControls.tsx`**: Restricted Image-to-GIF resolution options strictly to `720p`, `480p`, and `360p`.
- **`src-tauri/src/ffmpeg/video/gif.rs` & `src-tauri/src/ffmpeg/image_to_video/mod.rs`**: Pruned dead `"ORIGINAL"` scale branch in `build_gif_palette_filter` and enforced a hard `720px` cap across both Video-to-GIF (`144..=720`, even-aligned) and Image-to-GIF (`720p`/`480p`/`360p`).
- **`.agents/skills/alitken-pipelines/SKILL.md`**: Synced `video/gif.rs` preset documentation to reflect the 720p cap and `360p` removal.

### [2026-11-13] v0.9.2 - Export to GIF (Video, Trimmer, Images) & Image-to-Video Sequence Bug Fixes
- **Video & Trimmer GIF Pipeline (`src-tauri/src/ffmpeg/video/gif.rs`, `convert/mod.rs`, `trim.rs`, `types.rs`)**: Added high-quality single-pass 256-color adaptive palette GIF encoding (`execute_gif_convert_step`, `execute_gif_trim_step`) supporting GIF FPS (`10`/`15`/`24`/`30`/`ORIGINAL`), palette quality (`HIGH` diff+floyd_steinberg vs `BALANCED` full+bayer), infinite loop (`-loop 0` vs `-1`), crop framing, speed scaling (`0.10x`–`50.00x`), `libdav1d` AV1 decode, and `360p` compact preset.
- **Image-to-GIF & Sequence Hardening (`src-tauri/src/ffmpeg/image_to_video/mod.rs`, `pipe.rs`, `demuxer.rs`, `src-tauri/src/commands/media.rs`)**: Extended `image_to_video` with `.gif` animated output (`export_gif`, `gif_loop`, `gif_transparent`), `480p`/`360p` presets, majority Portrait/Landscape preset auto-orientation, UI queue order preservation (removed alphabetical sort), 0ms `is_homogeneous` fast-path guard for uniform native sequences, `[0]` composite frame extraction for `.psd`/`.psb`/`.ico`/`.gif`, uniform `-colorspace sRGB -depth 8` in `pipe.rs`, and RGBA `pam:-` / alpha padding when `gif_transparent` is enabled.
- **Frontend UI (`src/components/video-config/`, `src/components/image-config/`, `src/components/config/`, `src/hooks/`, `src/types/`, `src/App.tsx`)**: Added 4th `GIF` codec card in `CodecSelector.tsx` + `GifExportControls.tsx` + `360p` option in `ResolutionSelector.tsx`; renamed Image category to `Video & GIF` in `FormatSelector.tsx` with `[MP4 Video | Animated GIF]` pills, adaptive FPS presets (`[10, 15, 24]` vs `[24, 30, 60]`), and `VideoGifOptions.tsx` (`gifLoop`, `gifTransparent`); updated CTA labels and trimmer fast-copy bypass.
- **`.agents/skills/alitken-pipelines/SKILL.md`**: Synchronized pipeline reference with the new GIF modes, auto-orientation, composite `[0]`, uniform depth, and homogeneous fast-path details.

### [2026-11-13] v0.9.2 - Document Media Pipelines Skill & Enforce Anti-Replacement Rule
- **`.agents/skills/alitken-pipelines/SKILL.md`**: Created dedicated skill documenting every production media pipeline (`image_to_video` 2-tier pipe + concat/3-stage normalizer, `extract_frames` + WMF hardware scrubbing, `image/convert` + `pdf` ImageMagick pipelines, and `video/convert`/`trim`/`combine`/`preview`) along with native vs non-native 45+ format routing rules.
- **`.agents/AGENTS.md` & `.agents/skills/alitken-expert/SKILL.md`**: Registered `alitken-pipelines` under Domain Knowledge Reference so agents always audit existing pipelines before proposing or coding media features.
- **`history.md`**: Logged Mistake #6 (`[MISTAKE]` / `[CORRECTION]`) regarding reinventing existing multi-format/resolution pipelines without inspecting `src-tauri/src/ffmpeg/image_to_video/` first.

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

### 6. Reinventing Media Pipelines Without Auditing Existing Engine Modules
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Proposing a new Image-to-GIF / multi-resolution / multi-format handling pipeline during planning without first inspecting `src-tauri/src/ffmpeg/image_to_video/` (`mod.rs`, `pipe.rs`, `demuxer.rs`) and `src-tauri/src/image/convert.rs`, requiring the user to remind the agent that Alitken already solved multi-resolution and 45+ image format conversion in Image-to-Video.
- **Root Cause**: Failing to audit existing backend pipeline modules (`image_to_video`, `extract_frames`, `image/convert`, `video/convert`) before drafting architectural plans for media features.
- **Strict Invariants**:
  1. **ALWAYS** read `.agents/skills/alitken-pipelines/SKILL.md` and inspect the underlying `src-tauri/src/ffmpeg/` and `src-tauri/src/image/` modules before proposing any media conversion, animation, GIF, or frame extraction plan.
  2. **NEVER** replace or duplicate a working media pipeline with a new, unproven pipeline when the existing pipeline can be reused and extended.

### 7. GIF Resolution Cap (720p Max) & No Format Labels in Target Resolution
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: (1) Allowing GIF exports to select `Original`, `1080p`, `2K`, `4K`, or custom heights above `720p`, and (2) labeling the 360p option in `Target Resolution` as `360p Compact (GIF / Web)`, which misleads users into thinking selecting that resolution in video codec modes (`H.264`/`H.265`/`AV1`) will export a GIF.
- **Root Cause**: Failing to restrict the resolution dropdown and custom height input upper bound (`max=720`) when GIF mode is active, and mixing format/codec terminology (`GIF`) into a resolution preset label.
- **Strict Invariants**:
  1. **ALWAYS** cap GIF resolution options and custom height inputs strictly at **720p maximum** (`144px–720px`) across both UI controls and backend Rust pipelines.
  2. **NEVER** include codec or file-format names (such as `GIF`) inside `Target Resolution` dropdown option labels.

### 8. Unbounded Frame Buffering in FFmpeg lavfi Benchmarks & Single-Pass Palette/WebP Encoders
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Running an FFmpeg `lavfi` benchmark (`mandelbrot`) with `-t 3` placed as an output flag after `-i` while piping through `split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, causing `ffmpeg.exe` to buffer unbounded 1080p frames on `[s1]` (~19.7 GB RAM) until the user intervened (`"stop it bruh"`).
- **Root Cause**:
  1. Infinite `lavfi` sources (`mandelbrot`, `testsrc2` without `duration=`) never reach EOF unless `-t` is passed *before* `-i` (or `duration=` is inside the filter string).
  2. In FFmpeg's `split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse`, `palettegen` does not emit `[p]` until `[s0]` hits EOF, forcing `[s1]` to buffer every uncompressed frame of the entire video in RAM. Similarly, `libwebp_anim` buffers all encoded frames in RAM until `WebPAnimEncoderAssemble()` at EOF and reports `0%` progress until completion.
- **Strict Invariants**:
  1. **NEVER** run `lavfi` test generators without an explicit finite `duration=<sec>` inside the filter graph or `-t <sec>` *before* `-i`, and avoid running heavy multi-second 1080p CLI benchmarks unless explicitly requested by the user.
  2. **ALWAYS** use `-c:v libwebp` (streaming per-frame WebP encoder with real-time `out_time_ms` telemetry and `O(1)` RAM usage) instead of `libwebp_anim` (which buffers all frames in RAM until EOF).
  3. **ALWAYS** use `palettegen=max_colors=256:stats_mode=single` paired with `paletteuse=new=1` in single-pass GIF filtergraphs so FFmpeg streams frames in `O(1)` memory instead of buffering the entire video in RAM on `[s1]`.

### 9. Horizontal Overflow & Right-Edge Clipping When Lengthening 2-Column Pill Labels in Narrow Sidebars
- **Tag**: `[MISTAKE]` / `[CORRECTION]`
- **Context & Objection**: Renaming the second Image mode category pill from `Video & GIF` to `Video & Animation` caused both 2-column `.image-config-category-btn` buttons (`13px` bold, `12px` horizontal padding, `white-space: nowrap`, `1fr 1fr` grid tracks) to exceed the `316px` inner sidebar width and clip the right edge of `"Video & Animation"`.
- **Root Cause**: CSS Grid `1fr` tracks default to `minmax(auto, 1fr)`, allowing `white-space: nowrap` button content to expand the grid wider than its container unless constrained by `minmax(0, 1fr)` and sized appropriately for narrow panels.
- **Strict Invariants**:
  1. **ALWAYS** use `minmax(0, 1fr)` on multi-column pill grids inside the fixed `360px` config sidebar and verify combined icon + padding + label widths fit comfortably within `316px` (`padding: 8px 6px`, `font-size: 11.5px`, `gap: 5px`, `min-width: 0`).

