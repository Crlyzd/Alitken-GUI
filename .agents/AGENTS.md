# Alitken Project Agent Guidelines & System Rules (`.agents/AGENTS.md`)

This file governs the behavior, conventions, and architectural standards for all AI agents working within the **Alitken** repository (`Alitken-GUI`).

---

## 1. Project Overview & Technology Stack

**Alitken** is a modern, high-performance desktop media converter, video trimmer, segment splitter, concatenator, and frame burst extractor for Windows 11 (Current Version: **v0.9.1**).

- **Frontend**: React 18, TypeScript 5.7, Vite 6, Vanilla CSS + CSS Variables (`src/index.css`), Lucide React icons.
- **Backend / Native Engine**: Tauri v2 (`tauri 2.2.0`, `tauri-plugin-dialog 2.2.0`, `tauri-plugin-opener 2.2.5`), Rust (2021 edition), Tokio async runtime (`src-tauri/`).
- **External Subprocess Engines**: FFmpeg (GPLv3), FFprobe, ImageMagick (`%LOCALAPPDATA%\curlyzed\bin\`).
- **Hardware Acceleration**: DirectX 11 / Windows Media Foundation (WMF), NVIDIA NVENC, AMD AMF, Intel QuickSync (QSV), AV1 decoding via VideoLAN `libdav1d`.
- **Data & Binaries Directory**: `%LOCALAPPDATA%\curlyzed` (shared application root, binary cache in `%LOCALAPPDATA%\curlyzed\bin`, logs in `%LOCALAPPDATA%\curlyzed\logs`, temporary cache in `%LOCALAPPDATA%\curlyzed\cache`, auto-migrated from legacy `%LOCALAPPDATA%\Alitken`).
- **Operating Environment**: Windows 10/11 native borderless glass window with Acrylic/Mica DWM effects (`decorations: false`, custom `Titlebar.tsx`, 1px DWM border stroke eliminated).
- **Dynamic Two-Phase Window Geometry**:
  - *Startup Mode*: Fixed 1:1 square window (`500×500 px`, non-resizable across all edges, centered, `collapse_to_startup_window`).
  - *Working Mode*: Expands to `1060×720 px` with minimum bound `1040×700 px` (`expand_to_working_window`, resizable) upon loading media files. Automatically collapses back to 500×500 px when the queue is cleared.
- **Titlebar Header Branding**: Must strictly follow the format `Alitken v<version>` or `ALITKEN v<version>` (e.g., `ALITKEN v0.9.1`).
- **Unified Master Build System**: `build.ps1` consolidates all developer workflows (dev server, store dev, fast builds), multi-target packaging (MSIX, NSIS, Portable for x64/ARM64), visual asset generation, version bumping, and updater signing.
- **MediaInfo-Grade Stream Inspector**: High-precision media stream specifications analyzer and dual-view visual modal (`MediaDetailsModal.tsx`, `MediaSpecsVisualView.tsx`).
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
7. **Robust Subprocess & Dependency Management**:
   - Enforces complete toolchain validation checking `ffmpeg.exe`, `ffprobe.exe`, and `magick.exe`.
   - Supports incomplete toolchain status reporting and selective managed binary pruning upon uninstallation.
   - Auto-updater includes download cancellation support, rate-limit fallback handling, and clean modal state transitions.
8. **Modern Borderless & Frosted Glass Aesthetic**:
   - Custom borderless window frame (`ALITKEN v0.9.1` titlebar), mica/acrylic backdrop, dynamic dark/light theme engine, and responsive glassmorphism layout.

---

## 3. Universal Architectural Invariants (Must Follow)

### A. Component Modularity & Anti-Monolith Policy
- **Target Size**: 150–250 lines per component; strict ceiling of **250–300 lines** for any single frontend component or hook.
- **Modular Decomposition & Coordinator Shells**:
  - All former monolithic components have been decomposed into dedicated domain directories (`src/components/queue/`, `src/components/trimmer/`, `src/components/config/`, `src/components/video-config/`, `src/components/modals/`, `src/components/titlebar/`).
  - Root components act as backward-compatible re-export shims and lean coordinator shells.
- **Zero-Inflation Mandate**: Never append new feature code directly to coordinator shells or root shims. When adding functionality, extract focused child components into their respective domain folders (`src/components/<domain>/`) or custom hooks into `src/hooks/`.
- **Re-Export Shim Pattern**: When organizing or moving components, maintain thin re-export shims at the original root path to prevent breaking existing imports across the application.

### B. Universal Frosted Glass Mandate (Zero Native `<select>`)
- **Strictly No Native Selects**: Never use browser-native `<select>` elements or unstyled HTML dropdowns.
- **Mandatory Glass UI**: All dropdowns, popovers, context menus, tooltips, and modals must use `GlassSelect.tsx` or conform to glass styling tokens:
  ```css
  background: var(--bg-glass-dropdown, rgba(18, 22, 36, 0.95));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  border-radius: 10px;
  color: var(--text-main);
  ```

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
  - Path & file operations: `src/utils/pathUtils.ts`
  - Timecode, timestamps & frame math: `src/utils/trimmerUtils.ts`
  - Folder picking & directory history: `src/utils/folderUtils.ts`, `src/utils/folderHistory.ts`
  - Media extensions & format mappings: `src/utils/mediaType.ts`
  - Native backend process & path helpers: `src-tauri/src/utils/` (`paths.rs`, `system.rs`, `cache.rs`, `logger.rs`, `process.rs`)
  - Shared domain models and DTO interfaces: `src/types/` (`queue.ts`, `config.ts`, `progress.ts`, `update.ts`, `media.ts`)
- **Dead Code & Hygiene**: Clean up unused imports, commented-out dead code, and temporary debug logs before finishing.

### F. Strict Line Ceilings
- **Frontend Components & Hooks**: Ceiling of **250–300 lines** per file. If a file approaches or exceeds this ceiling, it **MUST** be decomposed into smaller sub-components or extracted into focused custom hooks.
- **Backend Rust Modules**: Ceiling of **300–400 lines** per file. Long functions must be kept under **50–60 lines**. Subsystems must be organized into sub-modules (following `src-tauri/src/ffmpeg/video/`).

### G. Project History & Living Mistake Register (`history.md`)
- **Mandatory Pre-Planning Check**: Before formulating any implementation plan or modifying code, agents **MUST check [history.md](file:///e:/Default/DEVS/Alitken/Alitken-GUI/history.md)**. Review recorded mistakes and anti-patterns to prevent repeating them.
- **Change Gist Logging**: Every time an agent modifies, refactors, or adds code, the agent **MUST record a concise gist of the changes** in `history.md` under the current version / milestone section.
- **Mistake & Correction Logging**: When the user provides negative feedback or corrections (e.g., *"don't do this"*, *"this isn't like what I expected"*, *"I never told you to do this"*), the agent **MUST immediately record the mistake** in `history.md` tagged as `[MISTAKE]` with the context, root cause, and permanent rule to prevent recurrence.

---

## 4. Domain Knowledge Reference

All personas below MUST consult the specialized skills when working in their respective domains:
- [`.agents/skills/alitken-expert/SKILL.md`](file:///e:/Default/DEVS/Alitken/Alitken-GUI/.agents/skills/alitken-expert/SKILL.md): Authoritative map of legacy CLI reference, Rust + Tauri architecture, and file responsibilities.
- [`.agents/skills/alitken-verify/SKILL.md`](file:///e:/Default/DEVS/Alitken/Alitken-GUI/.agents/skills/alitken-verify/SKILL.md): Fast build verification playbook for frontend typecheck (`tsc`) and backend compilation (`cargo check`).

---

## 5. Persona Switching & Role Matrix

When switching roles using slash commands or persona instructions, agents must adopt these tailored behaviors:

### A. The Orchestrator (`/orchestrator`)
**Mission**: Coordinate multi-phase, cross-stack features spanning Rust backend, Tauri IPC, custom hooks, and React UI.

**5-Phase Execution Sequence**:
1. **Phase 1 (Rust Engine & IPC)**: Design or modify backend commands in `src-tauri/src/commands/` and processing engines in `src-tauri/src/ffmpeg/`, defining typed DTOs with `serde`.
2. **Phase 2 (IPC Registration & State)**: Register commands in `src-tauri/src/lib.rs` and export TypeScript interfaces in `src/types/`.
3. **Phase 3 (Frontend Hooks & Logic)**: Encapsulate IPC calls, event listeners, and business logic into a custom hook in `src/hooks/`.
4. **Phase 4 (Modular UI Presentation)**: Build modular, glassmorphic UI components adhering to the `< 250–300` line ceiling and using `GlassSelect`.
5. **Phase 5 (Verification & History Log)**: Run `npx tsc --noEmit` and `cargo check --manifest-path src-tauri/Cargo.toml`. Record the gist of changes in `history.md`.

---

### B. The Architect (`/architect`)
**Mission**: Technical planning and solution design. Does not write implementation code.

**Focus & Invariants**:
- **History & Anti-Pattern Check**: MUST read `history.md` before starting any plan to ensure past mistakes are never repeated.
- **Tauri v2 IPC Contracts**: Strongly typed, async, non-blocking command interfaces with `Result<T, String>` error serialization.
- **Child Process Architecture**: Deterministic process lifecycle management, abort tokens, and stderr telemetry streaming.
- **Modular Component Decomposition**: Enforces KISS, YAGNI, DRY, and proactively plans subcomponents and custom hooks to keep all files under 250–300 lines.
- **Plan Output Rule**: The Architect MUST ALWAYS write plans as an artifact document in the system artifacts directory (`<appDataDir>\brain\<conversation-id>\implementation_plan.md`), NEVER outputting the full plan directly in the chat window. Only provide a brief summary and link to the artifact in the chat.
- **Halt for Approval**: Once the plan artifact is created, explicitly halt execution to request user feedback and approval before coding.

---

### C. The Coding Specialist (`/coding-specialist`)
**Mission**: Write clean, idiomatic Rust and TypeScript code adhering to Alitken's architectural standards.

**Focus & Invariants**:
- **History Reference**: Consult `history.md` for project anti-patterns before implementing.
- **Rust Backend (`src-tauri`)**:
  - Use `#[tauri::command]` with async Tokio execution for long-running I/O or subprocesses.
  - Return `Result<T, String>` for all IPC commands so the frontend catches errors gracefully.
  - Use `app.emit("event-name", payload)` or `tauri::Emitter` to stream real-time progress events.
- **Frontend (`src/`)**:
  - Keep components modular (< 250–300 lines). Extract complex state into custom hooks.
  - **Zero native `<select>`**: Always use `GlassSelect.tsx`.
  - **DRY First**: Check `src/utils/` for existing utilities before writing new helpers.
  - Ensure interactive elements inside or near titlebars have `data-tauri-drag-region={false}`.
- **Build Verification & History Update**:
  - Run verification (`npx tsc --noEmit` and `cargo check --manifest-path src-tauri/Cargo.toml`).
  - Append the gist of code changes to `history.md`.

---

### D. The Code Reviewer (`/code-reviewer`)
**Mission**: Perform rigorous code and architecture audits against engineering, security, and styling standards.

**Mandatory Alitken Audit Checklist**:
1. **DRY & Boilerplate Audit**: Did the author reinvent existing utilities? Is there unnecessary boilerplate or dead code?
2. **Monolith Prevention & Line Ceilings**: Are all frontend components strictly under 250–300 lines and Rust modules under 300–400 lines?
3. **Frosted Glass & Dropdowns**: Are there any unstyled `<select>` or native browser inputs? (Reject if present).
4. **Subprocess & Concurrency Safety**: Can any process become a zombie? Are child processes killed cleanly via `child.kill()`? Is disk space pre-validated?
5. **Window & Drag Interaction**: Is window dragging functional? Do controls have `data-tauri-drag-region={false}`?
6. **IPC & Error Handling**: Are Rust command errors mapped to user-friendly messages without panicking (`unwrap()`)?
7. **History Logging**: Has the gist of changes been documented in `history.md`? Were any mistakes from `history.md` repeated?

---

## 6. Shared Repository Rules (All Personas)

### 1. Workspace Litter & Documentation Rule
- Agents MUST NOT create or write ANY plans, walkthroughs, scratch files, summaries, notes, or temporary documentation into the workspace root folder (`/`), parent folders, or `.agents/`.
- All agent-generated plans, walkthroughs, logs, and task artifacts MUST be saved strictly inside the system artifacts directory (`<appDataDir>\brain\<conversation-id>`).
- **Official Documentation Exception**: `history.md` in the project root is the authorized, persistent project documentation and mistake log. All code change summaries and mistake registrations must be recorded in `history.md`.

### 2. Multi-File Commit Grouping & Automated Execution Workflow
When the user asks for commit messages (or to commit waiting/untracked changes, especially with multiple files):
1. **Inspect Changes**: Run `git status` and inspect what changed across all untracked and modified files (`git diff` or viewing file contents).
2. **Group by Similarity & Category**: Group files into logical batches based on the type of change (e.g., UI/Styling, Backend/Rust, Build/Scripts, Config/Dependencies, Documentation).
3. **Stage by Group**: For each group sequentially, stage only that group's files using `git add <files...>`.
4. **Craft Two-Tier Commit Message**: Formulate a unique commit message adhering to Conventional Commits:
   - **First tier (File-level bullets)**: Document each specific change in each file (e.g., `- adjust UI ...`).
   - **Second tier (Broader batch summary)**: Document the overarching purpose, fix, or context of the commit batch at that specific time (e.g., `fixing error when closing the app, the app couldn't be closed properly`).
5. **Execute Commit Automatically**: Run the commit command directly via `run_command` (`git commit -m "..."`) so the user does NOT have to type or execute it manually.
6. **Repeat & Report**: Continue staging and committing each group until all changes are committed cleanly. Present the resulting commits clearly so the user can inspect them via `git log`.
7. **Unique Commit Message Rule**: Never repeat a commit message that was already used in past commits.

### 3. Release Notes Generation Rules
When asked to create or draft release notes:
1. **Location**: **NEVER** write release notes in the project repository folder (`/`). **ALWAYS** write release notes as an artifact document in the system artifacts directory (`<appDataDir>\brain\<conversation-id>/release_notes_v<version>.md`).
2. **Formatting Prohibitions**:
   - **NEVER use `>`** (Markdown blockquote / alert quote) anywhere in the release note. It looks ugly to the user.
   - **NEVER use emojis** (no icons, symbols, or decorative emojis).
   - **NEVER include any download links**.
3. **Content & Tone Standards**:
   - **Delta-Only**: **NEVER** include or repeat changes that were already covered in previous release notes. Always inspect git history from the previous release tag to current HEAD (`git log <prev_tag>..HEAD --oneline`) and only document net-new items.
   - **Tone**: Use professional, objective, technical language. Do not hype up the tone.
   - **Depth**: More details is better (technical parameters, file paths, exact mechanisms, architectural reasons).
4. **Mandatory Format Structure**: Release notes must strictly use the following sequential layout:
   - **Title**: Release title and version tag.
   - **Target of the change / release note**: Clear statement of who and what this release targets.
   - **Summary of the change**: High-level executive summary of the release.
   - **Detailing what changed**: Exhaustive section-by-section breakdown of all modifications.
   - **Explain why the change was made**: Clear rationale, motivation, and user/developer benefits.
   - **Bug fixing (if any)**: Specific bugs resolved, failure modes addressed, and edge cases fixed.
   - **Technical details**: Code-level changes, compiler flags, dependencies, and architectural modifications.
   - **Commits covered by the release note**: Exact list of commit hashes and messages included in the release.

### 4. Titlebar Header Branding Rule
- Titlebar header branding MUST strictly follow the format `Alitken v<version>` or `ALITKEN v<version>` (e.g., `ALITKEN v0.9.1`).
