# Implementation Plan - Improve Light Mode Error Alert Text Readability

Fix low contrast / poor text readability in `ProgressModal.tsx` error alert card during light mode by utilizing the app's theme-aware CSS color tokens (`var(--accent-rose)`).

## User Review Required

> [!NOTE]
> In Light Mode, hardcoded pastel red `#f87171` had insufficient contrast against light modal backdrops. Switching to `var(--accent-rose)` ensures crisp contrast `#e11d48` in Light Mode and `#f43f5e` in Dark Mode.

## Proposed Changes

### React Frontend Layer

#### [MODIFY] [ProgressModal.tsx](file:///d:/ALitken/Alitken-GUI-s/src/components/ProgressModal.tsx)
- Update error icon color in header from `#fb7185` to `var(--accent-rose)`.
- Update error box text color from hardcoded `#f87171` / `#fb7185` to `var(--accent-rose)` with `fontWeight: 500`.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify clean TypeScript compilation.

### Manual Verification
- Trigger an error condition (e.g. invalid version warning or missing input file) in Light Mode and Dark Mode.
- Confirm error text is sharp, high-contrast, and effortlessly readable in Light Mode.
