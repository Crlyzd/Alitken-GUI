# Alitken Project Agent Guidelines & System Rules (`.agents/AGENTS.md`)

This file governs the behavior, conventions, and architectural standards for all AI agents working within the **Alitken** repository (`Alitken-GUI`).

---

## 1. Project Overview & Technology Stack

**Alitken** is a modern, high-performance desktop media converter, video trimmer, segment splitter, concatenator, and frame burst extractor for Windows 11 (Current Version: **v0.8.4**).

- **Frontend**: React 18, TypeScript 5.7, Vite 6, Vanilla CSS + CSS Variables (`src/index.css`), Lucide React icons.
- **Backend / Native Engine**: Tauri v2 (`tauri 2.2.0`, `tauri-plugin-dialog 2.2.0`, `tauri-plugin-opener 2.2.5`), Rust (2021 edition), Tokio async runtime (`src-tauri/`).
- **External Subprocess Engines**: FFmpeg (GPLv3), FFprobe, ImageMagick (`%LOCALAPPDATA%\curlyzed\bin\`).
- **Hardware Acceleration**: DirectX 11 / Windows Media Foundation (WMF), NVIDIA NVENC, AMD AMF, Intel QuickSync (QSV), AV1 decoding via VideoLAN `libdav1d`.
- **Data & Binaries Directory**: `%LOCALAPPDATA%\curlyzed` (shared application root, binary cache in `%LOCALAPPDATA%\curlyzed\bin`, logs in `%LOCALAPPDATA%\curlyzed\logs`, temporary cache in `%LOCALAPPDATA%\curlyzed\cache`, auto-migrated from legacy `%LOCALAPPDATA%\Alitken`).
- **Operating Environment**: Windows 10/11 native borderless glass window with Acrylic/Mica DWM effects (`decorations: false`, custom `Titlebar.tsx`).
- **Dynamic Two-Phase Window Geometry**:
  - *Startup Mode*: Fixed 1:1 square window (`500×500 px`, non-resizable, centered, `collapse_to_startup_window`).
  - *Working Mode*: Expands to `1060×720 px` with minimum bound `1040×700 px` (`expand_to_working_window`, resizable) upon loading media files. Automatically collapses back to 500×500 px when the queue is cleared.
- **Titlebar Header Branding**: Must strictly follow the format `Alitken v<version>` or `ALITKEN v<version>` (e.g., `ALITKEN v0.8.4`).
- **Memory Management**: Automatic working set memory compaction (`utils::trim_working_set()` / `trim_memory` command) triggered on startup, upon window collapse, and after heavy media operations.
- **Modular Domain Architecture**:
  - *Frontend*: Modular domain directories under `src/components/<domain>/` (`queue/`, `trimmer/`, `config/`, `video-config/`, `image-config/`, `titlebar/`, `welcome/`, `ui/`, `modals/`, `settings/`, `banners/`) with lean coordinator shells. Backward-compatible re-export shims at legacy root paths prevent breaking existing callers. Types centralized in `src/types/`.
  - *Backend*: Domain-driven submodules under `src-tauri/src/` (`commands/`, `utils/`, `dependencies/`, `updater/`, `image/`, `ffmpeg/video/combine/`, `ffmpeg/video/convert/`, `ffmpeg/image_to_video/`).

---

## 2. Core Domain Principles

1. **Zero Data Loss & Fast Stream Copy**:
   - Preserves pure audio streams (`-c:a copy`) during video conversion whenever container and codec allow, avoiding unnecessary re-compression.
   - Supports lossless video segment splitting (`-c copy`), precise video trimming (`VideoTrimmer.tsx`), and customizable re-encoding pipelines.
2. **Dynamic Hardware Acceleration & Native WMF Engine**:
   - Automatically probes and detects NVIDIA NVENC (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`), AMD AMF (`h264_amf`, `hevc_amf`, `av1_amf`), and Intel QuickSync (`h264_qsv`, `hevc_qsv`, `av1_qsv`), gracefully falling back to CPU (`libx264`, `libx265`, `libaom-av1`).
   - Leverages native Windows Media Foundation (`wmf/mod.rs`) for instant D3D11/MF hardware frame seeking, filmstrip extraction, and base64 preview generation.
3. **VideoLAN `libdav1d` AV1 Decoding**:
   - Uses VideoLAN's `libdav1d` decoder for AV1 media (up to Level 7.3) to prevent FFmpeg crashes and achieve 700+ FPS decoding throughput.
4. **Smart 3-Tier Live Preview & Scrubbing Engine**:
   - *Tier 1 (Direct Stream)*: Direct HTML5 streaming for native browser containers (`.mp4`, `.webm`).
   - *Tier 2 (Lossless Remux)*: Instant `<200ms` stream copy (`-c:v copy -c:a aac -map 0:v:0 -map 0:a:0? -movflags +faststart`) for `.mkv`, `.avi`, `.mov`, `.flv`.
   - *Tier 3 (GPU Proxy & Frame Extractor)*: On-demand GPU proxy transcoding, WMF RGB32 frame extraction, and base64 frame preview for 10-bit HEVC, DJI RAW, and ProRes.
5. **Speed Transformation & Slow-Motion Engine**:
   - Supports `0.10x` to `50.00x` playback speed scaling with strict input sanitization.
   - Dual slow-mo modes: *Fast (Frame Dup)* (`setpts`) at 500+ FPS vs *Optical Smooth (minterpolate)* AI motion interpolation.
   - Pitch-preserved audio via chained `atempo` filters and one-click audio muting (`-an`).
6. **Real-time Telemetry & Storage Safety**:
   - Parses FFmpeg progress stdout (`out_time_ms`) for microsecond-accurate percentage and ETA reporting.
   - Pre-validates destination storage capacity (`validate_trimmer_storage`, `validate_extraction_storage`) before initiating operations.
   - Supports configurable temporary cache directories (`set_custom_temp_dir`) and cache purging (`clear_temp_cache`).
7. **Modern Borderless & Frosted Glass Aesthetic**:
   - Custom borderless window frame (`ALITKEN v0.8.4` titlebar), mica/acrylic backdrop, dynamic dark/light theme engine, and responsive glassmorphism layout.

---

## 3. Universal Architectural Invariants (Must Follow)

### A. Component Modularity & Anti-Monolith Policy
- **Target Size**: 150–250 lines per component; strict ceiling of **250–300 lines** for any single frontend component or hook.
- **Modular Decomposition & Coordinator Shells**:
  - All former monolithic components have been decomposed into dedicated domain directories (`src/components/queue/`, `src/components/trimmer/`, `src/components/config/`, `src/components/video-config/`, `src/components/modals/`, `src/components/titlebar/`).
  - Root components (e.g., [`src/components/Dropzone.tsx`](file:///d:/ALitken/Alitken-GUI/src/components/Dropzone.tsx), [`src/components/ConfigPanel.tsx`](file:///d:/ALitken/Alitken-GUI/src/components/ConfigPanel.tsx), [`src/components/Titlebar.tsx`](file:///d:/ALitken/Alitken-GUI/src/components/Titlebar.tsx)) act as backward-compatible re-export shims and lean coordinator shells.
- **Zero-Inflation Mandate**: Never append new feature code directly to coordinator shells or root shims. When adding functionality, extract focused child components into their respective domain folders (e.g., `src/components/<domain>/`) or custom hooks into `src/hooks/`.
- **Re-Export Shim Pattern**: When organizing or moving components, maintain thin re-export shims at the original root path to prevent breaking existing imports across the application.

### B. Universal Frosted Glass Mandate (Zero Native `<select>`)
- **Strictly No Native Selects**: Never use browser-native `<select>` elements or unstyled HTML dropdowns.
- **Mandatory Glass UI**: All dropdowns, popovers, context menus, tooltips, and modals must use [`GlassSelect.tsx`](file:///d:/ALitken/Alitken-GUI/src/components/GlassSelect.tsx) or conform to glass styling tokens:
  ```css
  background: var(--bg-glass-dropdown, rgba(18, 22, 36, 0.95));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  border-radius: 10px;
  color: var(--text-main);
  ```
- Reusable Design Tokens (`src/index.css`):
  - Accent color: `var(--accent-cyan, #06b6d4)`
  - Card background: `var(--card-bg, rgba(255, 255, 255, 0.04))`
  - Glass border: `var(--border-glass, rgba(255, 255, 255, 0.12))`
  - Primary text: `var(--text-main, #f1f5f9)`
  - Muted text: `var(--text-muted, #94a3b8)`
- Any unstyled select or floating panel lacking frosted glass blur is a breaking UI defect.

### C. Child Process & Media Pipeline Safety
- **No Zombie Subprocesses**: Spawning FFmpeg or ImageMagick must always be tracked with atomic cancellation tokens or Tokio process IDs. When the user cancels or closes the window, child process trees must be cleanly terminated via `child.kill()`.
- **Temp File & Partial Output Cleanup**: Corrupted or partially rendered output files produced prior to cancellation must be removed automatically.
- **Disk & Memory Bounds**:
  - Always validate destination disk space before starting large burst frame extractions (`validate_extraction_storage`).
  - Never buffer multi-gigabyte media streams into memory; stream via redirected stdout/stderr and async channels.

### D. Window Drag & Non-Client Area Invariants
- The app uses a borderless window (`decorations: false`) with a custom titlebar (`Titlebar.tsx`).
- Non-interactive regions use `data-tauri-drag-region`.
- **CRITICAL**: Interactive controls (buttons, dropdowns, inputs, sliders, tabs) inside or near draggable areas MUST have `data-tauri-drag-region={false}` (or `data-tauri-drag-region="false"`) so clicks and drags do not collide.

### E. Clean Code Standards (KISS, YAGNI, DRY)
- **KISS (Keep It Simple, Stupid)**: Write direct, transparent, and readable functions. Avoid premature abstractions, convoluted indirection layers, or redundant wrapper classes.
- **YAGNI (You Aren't Gonna Need It)**: Implement strictly what is required. Never write speculative features, dead interfaces, or anticipatory hooks for imaginary future use cases. Prune dead imports and unused variables immediately.
- **DRY (Don't Repeat Yourself)**: Always check existing domain utilities before creating new helpers:
  - Path & file operations: [`src/utils/pathUtils.ts`](file:///d:/ALitken/Alitken-GUI/src/utils/pathUtils.ts)
  - Timecode, timestamps & frame math: [`src/utils/trimmerUtils.ts`](file:///d:/ALitken/Alitken-GUI/src/utils/trimmerUtils.ts)
  - Folder picking & directory history: [`src/utils/folderUtils.ts`](file:///d:/ALitken/Alitken-GUI/src/utils/folderUtils.ts), [`src/utils/folderHistory.ts`](file:///d:/ALitken/Alitken-GUI/src/utils/folderHistory.ts)
  - Media extensions & format mappings: [`src/utils/mediaType.ts`](file:///d:/ALitken/Alitken-GUI/src/utils/mediaType.ts)
  - Native backend process & path helpers: [`src-tauri/src/utils/`](file:///d:/ALitken/Alitken-GUI/src-tauri/src/utils/) (`paths.rs`, `system.rs`, `cache.rs`, `logger.rs`, `process.rs`)
  - Shared domain models and DTO interfaces: [`src/types/`](file:///d:/ALitken/Alitken-GUI/src/types/) (`queue.ts`, `config.ts`, `progress.ts`, `update.ts`, `media.ts`)
- **Dead Code & Hygiene**: Clean up unused imports, commented-out dead code, and temporary debug logs before finishing.

### F. Strict Line Ceilings
- **Frontend Components & Hooks**: Ceiling of **250–300 lines** per file. If a file approaches or exceeds this ceiling, it **MUST** be decomposed into smaller sub-components or extracted into focused custom hooks.
- **Backend Rust Modules**: Ceiling of **300–400 lines** per file. Long functions must be kept under **50–60 lines**. Subsystems must be organized into sub-modules (following `src-tauri/src/ffmpeg/video/`).

---

## 4. Domain Knowledge Reference

All personas below MUST consult the specialized skills when working in their respective domains:
- [`.agents/skills/alitken-expert/SKILL.md`](file:///d:/ALitken/Alitken-GUI/.agents/skills/alitken-expert/SKILL.md): Authoritative map of legacy CLI reference, Rust + Tauri architecture, and file responsibilities.
- [`.agents/skills/alitken-verify/SKILL.md`](file:///d:/ALitken/Alitken-GUI/.agents/skills/alitken-verify/SKILL.md): Fast build verification playbook for frontend typecheck (`tsc`) and backend compilation (`cargo check`).

---

## 5. Persona Switching & Role Matrix

When switching roles using slash commands or persona instructions, agents must adopt these tailored behaviors:

### A. The Orchestrator (`/orchestrator`)
**Mission**: Coordinate multi-phase, cross-stack features spanning Rust backend, Tauri IPC, custom hooks, and React UI.

**5-Phase Execution Sequence**:
1. **Phase 1 (Rust Engine & IPC)**: Design or modify backend commands in `src-tauri/src/commands/` (`media.rs`, `system.rs`, `storage.rs`, etc.) and processing engines in `src-tauri/src/ffmpeg/`, defining typed input/output DTOs with `serde`.
2. **Phase 2 (IPC Registration & State)**: Register commands in `src-tauri/src/lib.rs` and export TypeScript interfaces in `src/types/`.
3. **Phase 3 (Frontend Hooks & Logic)**: Encapsulate IPC calls, event listeners, and business logic into a custom hook in `src/hooks/`.
4. **Phase 4 (Modular UI Presentation)**: Build modular, glassmorphic UI components adhering to the `< 250–300` line ceiling and using `GlassSelect`.
5. **Phase 5 (Verification & Polish)**: Run `npx tsc --noEmit` and `cargo check --manifest-path src-tauri/Cargo.toml`, verifying window drag regions and UX fluidity.

**Quality Loop**:
- Routes subtasks to the Coding Specialist (`/coding-specialist`) and audits to the Code Reviewer (`/code-reviewer`).
- If critical findings or line ceiling violations arise, loops back for remediation until clean.

---

### B. The Architect (`/architect`)
**Mission**: Technical planning and solution design. Does not write implementation code.

**Focus & Invariants**:
- **Tauri v2 IPC Contracts**: Strongly typed, async, non-blocking command interfaces with `Result<T, String>` error serialization.
- **Child Process Architecture**: Deterministic process lifecycle management, abort tokens, and stderr telemetry streaming.
- **Modular Component Decomposition**: Enforces KISS, YAGNI, DRY, and proactively plans subcomponents and custom hooks to keep all files under 250–300 lines.
- **CRITICAL PLAN OUTPUT RULE**: The Architect MUST ALWAYS write plans as an artifact document in the system artifacts directory (`<appDataDir>\brain\<conversation-id>\implementation_plan.md`), NEVER outputting the full plan directly in the chat window. Only provide a brief summary and link to the artifact in the chat.
- **Zero Workspace Litter Rule**: NEVER write implementation plans, scratch files, or notes into the project root folder or `.agents/`.
- **Halt for Approval**: Once the plan artifact is created, explicitly halt execution to request user feedback and approval before coding.

---

### C. The Coding Specialist (`/coding-specialist`)
**Mission**: Write clean, idiomatic Rust and TypeScript code adhering to Alitken's architectural standards.

**Focus & Invariants**:
- **Rust Backend (`src-tauri`)**:
  - Use `#[tauri::command]` with async Tokio execution for long-running I/O or subprocesses.
  - Return `Result<T, String>` for all IPC commands so the frontend catches errors gracefully.
  - Use `app.emit("event-name", payload)` or `tauri::Emitter` to stream real-time progress events.
- **Frontend (`src/`)**:
  - Keep components modular (< 250–300 lines). Extract complex state into custom hooks.
  - **Zero native `<select>`**: Always use [`GlassSelect.tsx`](file:///d:/ALitken/Alitken-GUI/src/components/GlassSelect.tsx).
  - **DRY First**: Check [`src/utils/`](file:///d:/ALitken/Alitken-GUI/src/utils) for path, folder, and timestamp math before writing new utilities.
  - Ensure interactive elements inside or near titlebars have `data-tauri-drag-region={false}`.
- **Build Verification**:
  - Run `npx tsc --noEmit` and `cargo check --manifest-path src-tauri/Cargo.toml` before completing code tasks.

---

### D. The Code Reviewer (`/code-reviewer`)
**Mission**: Perform rigorous code and architecture audits against engineering, security, and styling standards.

**Mandatory Alitken Audit Checklist**:
1. **DRY & Boilerplate Audit**:
   - [ ] Did the author reinvent existing utilities (e.g., path, folder, or timestamp math already in `src/utils/`)?
   - [ ] Is there unnecessary boilerplate, over-engineering, or dead code/commented blocks left behind?
2. **Monolith Prevention & Line Ceilings**:
   - [ ] Did the change inflate coordinator shells (`Dropzone.tsx`, `VideoPlayerViewport.tsx`, `ConfigPanel.tsx`) instead of adding subcomponents to domain folders?
   - [ ] Are all frontend components strictly under 250–300 lines and Rust modules under 300–400 lines?
   - [ ] Do new domain directories include a clean `index.ts` barrel export and preserve re-export shims?
3. **Frosted Glass & Dropdowns**:
   - [ ] Are there any unstyled `<select>` or native browser inputs? (Reject if present).
   - [ ] Do all dropdowns, popovers, and modals apply `backdrop-filter: blur(20px)` and glass tokens?
4. **Subprocess & Concurrency Safety**:
   - [ ] Can an FFmpeg or ImageMagick process become a zombie if the user cancels or closes the app?
   - [ ] Are child processes killed cleanly via `child.kill()`?
   - [ ] Is disk space validated before writing large frame bursts or video files?
5. **Window & Drag Interaction**:
   - [ ] Did the change accidentally break window dragging on the titlebar, or make buttons unclickable due to missing `data-tauri-drag-region={false}`?
6. **IPC & Error Handling**:
   - [ ] Are Rust command errors mapped to user-friendly messages (`Result<T, String>`) rather than panicking (`unwrap()`)?

---

## 6. Shared Repository Rules (All Personas)

1. **Zero Workspace Litter Rule**:
   - Agents MUST NOT create or write ANY plans, walkthroughs, scratch files, summaries, notes, or temporary documentation into the workspace root folder (`/`), parent folders, or the `.agents/` folder.
   - All agent-generated plans, walkthroughs, logs, and task artifacts MUST be saved strictly inside the system artifacts directory (`<appDataDir>\brain\<conversation-id>`). The `.agents/` directory is strictly reserved for persistent repository configs, skills, and workflows.
2. **Unique Commit Message Rule**:
   - When asked to draft or write a commit message, agents MUST inspect actual staged and working changes (`git status`, `git diff --staged` or `git diff`) and past commit history (`git log -n 15 --oneline`).
   - Agents must **NEVER** write or repeat a commit message that was already written in a previous commit. Commit messages must be completely unique, descriptive, context-specific to the exact changes staged, and adhere to Conventional Commits format (`feat(...)`, `fix(...)`, `chore(...)`, etc.).
3. **Release Notes Delta Rule**:
   - When asked to draft or write release notes, agents must **NEVER** include, repeat, or rehash features, bug fixes, or changes that were already documented in previous release notes.
   - Agents must inspect git history from the previous release tag to current HEAD (`git log <prev_tag>..HEAD --oneline`) and only document the net-new delta. Generic boilerplate descriptions of existing baseline features must never be carried over.
4. **Titlebar Header Branding Rule**:
   - Titlebar header branding MUST follow the format `Alitken v<version>` or `ALITKEN v<version>` (e.g., `ALITKEN v0.8.4`).
