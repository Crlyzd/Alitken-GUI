# Decoupling Architecture Plan: SettingsModal.tsx

## Overview
`SettingsModal.tsx` currently functions as a monolithic 1,147-line file containing mixed concerns: Tauri IPC business logic, optimistic UI state management, file-dialog directory pickers, engine validation/download dispatching, and extensive inline presentation styles for 5 distinct settings domains.

This plan details a clean decoupling strategy that breaks `SettingsModal.tsx` into an isolated state hook (`useSettingsState.ts`) and modular, focused subcomponents under `src/components/settings/`, following the established patterns of `src/components/trimmer/` and `src/components/video-config/`.

---

## Architectural Breakdown & File Structure

```
src/
├── hooks/
│   └── useSettingsState.ts           # [NEW] Encapsulates all Tauri IPC calls, cache & dep state, optimistic toggles
├── components/
│   ├── settings/                     # [NEW] Modular subcomponents
│   │   ├── SettingsHeader.tsx        # Modal header & close trigger
│   │   ├── SettingsAlertBanners.tsx  # Feedback notifications (success/error banners)
│   │   ├── ThemeSection.tsx          # Appearance & Theme mode cards (Dark/Light)
│   │   ├── EngineStatusRow.tsx       # Engine version badge & status indicator row
│   │   ├── MediaEnginesSection.tsx   # FFmpeg & ImageMagick cards, multi-state action buttons & AppData explorer
│   │   ├── CacheStorageSection.tsx   # Temp cache management, size gauge, clear cache, custom dir picker & reset
│   │   ├── WindowsIntegrationSection.tsx # Windows "Send To" shortcut toggle & portable tag
│   │   ├── SettingsFooter.tsx        # Target binary path inspector
│   │   └── index.ts                  # Barrel export
│   └── SettingsModal.tsx             # [REFACTOR] Slim, clean top-level modal wrapper (~75 lines)
```

---

## Component Responsibilities & State Flow

### 1. `useSettingsState.ts` (Hook)
- **Responsibilities**:
  - Fetches and stores `IntegrationStatus`, `DependencyStatus`, and `CacheInfo` via Tauri IPC (`get_system_integration_status`, `check_app_dependencies`, `get_temp_cache_info`).
  - Handles optimistic updates for Windows SendTo shortcut (`set_sendto_status`).
  - Manages AppData binary installation (`install_to_appdata`) and uninstallation (`uninstall_appdata`).
  - Manages temp cache directory selection via `@tauri-apps/plugin-dialog` (`open({ directory: true })`), cache clearing (`clear_temp_cache`), and resetting custom cache directory (`set_custom_temp_dir`).
  - Dispatches OS folder open commands (`open_folder`).
  - Manages UI feedback state (`successMsg`, `errorMsg`, loading flags: `loadingSendTo`, `loadingDeps`, `loadingCache`).
  - Provides helper utilities (`formatBytes`, `formatEngineVersion`).

### 2. `src/components/settings/` (Subcomponents)
- **`SettingsHeader.tsx`**:
  - Renders title with `Layers` icon, subtitle, and close button.
- **`SettingsAlertBanners.tsx`**:
  - Displays formatted success and error banners with icons (`CheckCircle2`, `ShieldAlert`).
- **`ThemeSection.tsx`**:
  - Renders Dark Mode (Frosted Glass) and Light Mode (Mica/Acrylic) selection cards with active glow styles.
- **`EngineStatusRow.tsx`**:
  - Reusable component for rendering engine status (FFmpeg / ImageMagick), version tag, pulsing status dot, update tag, and update action trigger.
- **`MediaEnginesSection.tsx`**:
  - Renders the Media Processing Engines card, embeds `EngineStatusRow` for FFmpeg and ImageMagick, computes dynamic action states (Uninstall vs Update vs Install to AppData), and renders the AppData folder link.
- **`CacheStorageSection.tsx`**:
  - Renders the Cache & Storage card: Temp cache size gauge, open folder in Explorer button, clear cache trigger (with active preview preservation info), custom directory picker (`Change`), and reset button (`RotateCcw`).
- **`WindowsIntegrationSection.tsx`**:
  - Renders Windows Context Menu section: "Send To" shortcut card, "100% Portable" badge, and interactive toggle switch with loading spinner.
- **`SettingsFooter.tsx`**:
  - Renders the Target Binary executable path at the bottom of the modal.
- **`index.ts`**:
  - Exports all subcomponents for clean import ergonomics.

### 3. `SettingsModal.tsx` (Top-Level Container)
- **Responsibilities**:
  - Handles modal visibility check (`isOpen`), backdrop rendering (`blur(20px)`), and `Escape` keyboard dismissal.
  - Consumes `useSettingsState`.
  - Glues theme toggling and engine download dispatchers (`onUpdateEngine`).
  - Composes the decoupled subcomponents cleanly with zero bloated business logic.

---

## Step-by-Step Execution Plan

1. **Step 1: Create `src/hooks/useSettingsState.ts`**
   - Extract state variables, helper formatters, and async IPC handlers from `SettingsModal.tsx`.
   - Export structured state and action dispatcher object.

2. **Step 2: Create Subcomponents under `src/components/settings/`**
   - Create `SettingsHeader.tsx`, `SettingsAlertBanners.tsx`, `ThemeSection.tsx`.
   - Create `EngineStatusRow.tsx` and `MediaEnginesSection.tsx`.
   - Create `CacheStorageSection.tsx` adhering to the MS Store compliance and cache isolation rules.
   - Create `WindowsIntegrationSection.tsx` and `SettingsFooter.tsx`.
   - Create `index.ts` barrel file.

3. **Step 3: Refactor `src/components/SettingsModal.tsx`**
   - Import `useSettingsState` and subcomponents from `./settings`.
   - Replace the monolithic JSX structure with the composed subcomponents.
   - Ensure props interface (`isOpen`, `onClose`, `theme`, `onToggleTheme`, `onUpdateEngine`) remains 100% backward compatible with `App.tsx`.

4. **Step 4: Verification & Type Checking**
   - Run TypeScript type checks (`npx tsc --noEmit` or build verify).
   - Ensure all styles, animations (pulsing dot, spin), theme transitions, and IPC commands function identically without regression.

---

## Dependencies
- No new external packages required (uses existing `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `lucide-react`).

## Flagged Assumptions & Tradeoffs
- **Prop Drilling vs Hook Consumption**: Subcomponents will receive their specific props from `SettingsModal` which consumes `useSettingsState`. This ensures pure, easily testable presentational components while keeping state orchestration centralized.

## Verification Plan
### Automated Tests / Type Checking
- Run `npm run build` or `npx tsc --noEmit` to confirm complete type safety across all newly extracted modules and consumers.
### Manual UI Verification
- Verify Theme switching (Dark <-> Light).
- Verify FFmpeg / ImageMagick status badges and click-to-update triggers.
- Verify Cache folder opening, custom path selection, reset, and clear cache.
- Verify SendTo context menu toggle switch.
