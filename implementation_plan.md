# Disable Transcode Options in Edit Mode when Lossless Copy is Checked

## Summary
In Edit Mode (Video Trimmer), when **Lossless Copy** (`fastCopyTrim`) is checked, FFmpeg performs stream copying (`-c copy`) without re-encoding. As a result, transcoding parameters—specifically **Target Codec**, **Target Resolution**, and **Target Bitrate / Quality**—are bypassed by FFmpeg.

Currently in [`ConfigPanel.tsx`](file:///d:/ALitken/Alitken-GUI-s/src/components/ConfigPanel.tsx), the state flag `isFastCopyActive` is defined as:
```tsx
const isFastCopyActive =
  !isTrimmerMode &&
  ((config.videoAction === 'SPLIT' && config.splitFastCopy) ||
    (config.videoAction === 'COMBINE' && config.combineFastCopy));
```
Because `!isTrimmerMode` explicitly excluded Trimmer mode, the transcoding controls remained active and enabled even when Lossless Copy was enabled, causing UI inconsistency and user confusion.

Updating `isFastCopyActive` to evaluate `fastCopyTrim` when `isTrimmerMode` is `true` will automatically disable/dim all transcoding options and display the `"Bypassed (-c copy)"` badge in Edit Mode.

---

## User Review Required

> [!NOTE]
> This change is purely UX enhancement and consistency enforcement. When Lossless Copy is checked in Edit mode, Target Codec, Target Resolution, and Target Bitrate controls will be visually dimmed (40% opacity), non-interactive, and marked with `"Bypassed (-c copy)"`. Unchecking Lossless Copy immediately re-enables all transcoding options.

---

## Open Questions

None. The user's observation is 100% correct and aligns with FFmpeg stream copy mechanics.

---

## Proposed Changes

### Frontend Components

#### [MODIFY] [ConfigPanel.tsx](file:///d:/ALitken/Alitken-GUI-s/src/components/ConfigPanel.tsx)

- Update `isFastCopyActive` definition to account for `isTrimmerMode` and `fastCopyTrim`:
  ```tsx
  const isFastCopyActive = isTrimmerMode
    ? !!fastCopyTrim
    : (config.videoAction === 'SPLIT' && config.splitFastCopy) ||
      (config.videoAction === 'COMBINE' && config.combineFastCopy);
  ```

---

## Verification Plan

### Automated Verification
- Run TypeScript compiler check: `npx tsc --noEmit` from the project root to ensure zero type errors.

### Manual Verification
1. Launch the Tauri application (`npm run tauri dev`).
2. Open a video file to enter **Edit Mode** (Trimmer view).
3. Verify that when **Lossless Copy** is checked:
   - Target Codec buttons (H.264, H.265, AV1) are dimmed and disabled.
   - `"Bypassed (-c copy)"` badge appears next to **TARGET CODEC**.
   - Target Resolution dropdown is dimmed and disabled.
   - Target Bitrate / Quality dropdown is dimmed and disabled.
4. Uncheck **Lossless Copy** and verify all transcode options are immediately re-enabled.
