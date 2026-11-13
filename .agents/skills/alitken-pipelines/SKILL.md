---
name: alitken-pipelines
description: Authoritative architectural reference for all Video-to-Image, Image-to-Video, Image-to-Image, and Video-to-Video pipelines in Alitken. Use this skill BEFORE planning or coding any media conversion, animation, frame extraction, GIF export, slideshow, image sequence, trimming, or format support feature so existing battle-tested pipelines are reused and never replaced.
---

# Alitken Media Pipelines Architecture Reference

This skill documents every production media processing pipeline in **Alitken** (`src-tauri/src/` and `src/`).

---

## 1. Mandatory Anti-Replacement & Reuse Rule

1. **Inspect Before Designing**: Before proposing any implementation plan or writing code for media conversion, animation, GIF export, slideshow, image sequence, frame extraction, video trimming, or format support, agents **MUST** inspect the existing backend modules documented below.
2. **Never Replace Working Pipelines**: **NEVER** build a parallel or replacement pipeline when an existing pipeline already handles input probing, resolution normalization, multi-format decoding (including ImageMagick fallback for 45+ formats), hardware acceleration, or frame extraction. Always reuse and extend the existing pipeline in place.

---

## 2. Pipeline 1: Image-to-Video & Animated Sequence/Slideshow (`src-tauri/src/ffmpeg/image_to_video/`)

Transforms heterogeneous or homogeneous image batches into video (`Animation_Render.mp4` / `Image_Slideshow.mp4`) or animated GIF (`Animation_Render.gif` / `Image_Slideshow.gif`) across varying resolutions and all 45+ supported image extensions while preserving the exact UI queue order.

- **Frontend Entry**: `src/components/image-config/FormatSelector.tsx` (`Video & GIF`) → `src/components/image-config/VideoControls.tsx` + `VideoGifOptions.tsx` → `src/hooks/useMediaPipelines.ts` (`handleStartImageProcessing`) → IPC `start_image_to_video_pipeline` (`src-tauri/src/commands/media.rs`).
- **Orchestrator (`mod.rs::run_image_to_video_pipeline`)**:
  - Validates file existence, non-zero byte sizes, and optional `audio_path` (skipped when `export_gif` is true).
  - **Fast Binary Header Dimension Probing & Auto-Orientation**: Calls `crate::utils::get_image_dimensions(file_path)` (`src-tauri/src/utils/system.rs`, which reads PNG, GIF, BMP, WEBP `VP8`/`VP8L`/`VP8X`, JPEG SOF, and HEIC/AVIF `ispe` headers in `<1ms`) with `ffprobe` (`probe_file`) fallback. Computes even-numbered `(scale_w, scale_h)` canvas dimensions with majority Portrait/Landscape auto-orientation for presets (`4k`, `1080p`, `720p`, `480p`, `360p`) or `ORIGINAL` (`max_w × max_h`), plus `is_homogeneous` check (same native extension + identical `(w, h)`).
  - Checks `has_non_native = sorted_inputs.iter().any(|p| !is_ffmpeg_native_image_format(p))`.
  - **Native FFmpeg Image Formats** (`is_ffmpeg_native_image_format` in `src-tauri/src/ffmpeg/process.rs`): `png`, `jpg`, `jpeg`, `bmp`, `webp`, `gif`.
  - **Non-Native Formats (45+ supported in `src/utils/mediaType.ts`)**: `heic`, `heif`, `avif`, `jxl`, `tiff`, `tif`, `ico`, `svg`, `psd`, `psb`, `tga`, `dds`, `hdr`, `exr`, `jp2`, `j2k`, `wdp`, `jxr`, `pcx`, `pbm`, `pgm`, `ppm`, `pnm`, `xbm`, `xpm`, `wbmp`, and Camera RAW (`raw`, `cr2`, `cr3`, `nef`, `nrw`, `arw`, `srf`, `sr2`, `dng`, `orf`, `rw2`, `pef`, `raf`, `3fr`, `erf`, `kdc`, `mrw`, `x3f`).
- **Tier 1 — Zero-Disk In-Memory Pipe (`pipe.rs::run_pipe_stream`)**:
  - Used when `magick.exe` is available and non-native formats, heterogeneous batches, or `export_gif && gif_transparent` need normalization without temporary disk writes.
  - Spawns `ffmpeg -f image2pipe -framerate <in_fps> -i pipe:0 ...` and feeds its `stdin` directly from per-image `magick.exe` processes:
    - Uses `format_magick_input_arg` (`<path>[0]` for `.psd`/`.psb`/`.ico`/`.gif`) so ImageMagick flattens/selects the composite frame rather than bursting layers.
    - Forces uniform pixel formatting before piping (`-colorspace sRGB -depth 8 ppm:-` for opaque RGB, or `-background none -alpha set ... pam:-` when preserving alpha transparency for GIF) so FFmpeg `image2pipe` never drops frames due to 8-bit vs 16-bit depth mismatches (`rgb24` vs `rgb48be`).
    - Applies `gif_palette_filter_stage` (`split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`) and `-loop` when `export_gif` is active.
  - Automatically falls back to `demuxer.rs` (`Ok(false)`) if the pipe fails before `stdin` is consumed.
- **Tier 2 — Concat Demuxer & 3-Stage Pre-Normalizer (`demuxer.rs::run_concat_demuxer`)**:
  - **Homogeneous `SEQUENCE` Fast Path**: When `is_homogeneous` is true in `SEQUENCE` mode (all native images share the same extension and identical `(w, h)` dimensions and not transparent GIF), writes `alitken_concat_<batch_id>.txt` directly (0ms extra preprocessing) and runs `ffmpeg -f concat -safe 0` with `-vf scale=...:force_original_aspect_ratio=decrease,pad=...`.
  - **3-Stage Pre-Normalization (`SLIDESHOW` & Heterogeneous Sequences)**: Normalizes each image into `alitken_frame_<batch_id>_<idx>.png` at uniform `(scale_w, scale_h)` (with `-background none` + `rgba` padding when `export_gif && gif_transparent`, or black padding otherwise) via Stage 1 (ImageMagick), Stage 2 (FFmpeg), or Stage 3 (Emergency ImageMagick fallback) before feeding FFmpeg `concat` + optional `gif_palette_filter_stage`.
  - Cleans up all temp PNGs and the concat manifest automatically on completion, error, or cancellation.

---

## 3. Pipeline 2: Video-to-Image Frame Extraction & Scrubbing (`src-tauri/src/ffmpeg/video/extract_frames.rs` & `src-tauri/src/wmf/mod.rs`)

Handles both batch burst frame extraction to disk and real-time single-frame timeline scrubbing.

- **Batch Burst Frame Extraction (`extract_frames.rs::run_extract_frames_pipeline`)**:
  - **Frontend Entry**: `src/components/video-config/ExtractFramesControls.tsx` → `useMediaPipelines.ts` → IPC `validate_extraction_storage` (`commands/storage.rs`) → `LargeFrameWarningModal.tsx` (if > 500 frames) → IPC `start_extract_frames_pipeline` (`commands/media.rs`).
  - Enforces VideoLAN `-c:v:0 libdav1d` when `meta.codec_name == "av1"`.
  - Supports `1`, `5`, `10`, `30` FPS (`-vf fps=<N>`) or `MAX` (`-fps_mode passthrough`), outputting `frame_%05d.<png|jpg|webp>` into `<stem>_frames/`.
- **Real-Time Single-Frame Scrubbing & Filmstrip Generation**:
  - **Tier 1 — Native Windows Media Foundation (`src-tauri/src/wmf/mod.rs`)**: Direct D3D11 / `IMFSourceReader` hardware frame seeking (`extract_wmf_frame_base64`, `extract_wmf_filmstrip`) producing RGB32 BMP base64 strings with zero subprocess spawn overhead.
  - **Tier 2 — FFmpeg Hardware Accelerated Pipe (`extract_frames.rs::extract_frame_base64_hwaccel` & `extract_ffmpeg_filmstrip`)**: Fallback for non-WMF containers (`.mkv`, `.webm`, `.flv`), using `-hwaccel auto -ss <t> -i <file> -frames:v 1 -vf scale=min(320\,iw):-2 -f image2 pipe:1` and cancelling stale in-flight PIDs via `cancel_and_kill_previous_frame_extraction()`.

---

## 4. Pipeline 3: Image-to-Image & Image-to-PDF (`src-tauri/src/image/`)

- **Batch Image Conversion (`image/convert.rs::run_image_pipeline`)**:
  - Converts any of Alitken's 45+ input image formats into target image formats via ImageMagick (`magick.exe`).
  - **Multi-Layer / Multi-Page Handling**: Appends `[0]` (`format!("{}[0]", input_path_str)`) for `.psd`, `.psb`, `.ico`, and `.gif` inputs to extract only the flattened composite/first frame rather than exploding layers.
  - Supports aspect-preserving proportional `-resize <pct>%` or `-resize x<height>`.
- **Image-to-PDF Merging (`image/pdf.rs::run_pdf_pipeline`)**:
  - Merges multiple images into a single PDF or converts 1-to-1 PDFs with page size (`A4`, `Letter`, `Fit Image`), orientation, and margin controls.

---

## 5. Pipeline 4: Video Transcode, Split, Trim, Combine & 3-Tier Preview (`src-tauri/src/ffmpeg/video/`)

- **Transcode & Split (`video/convert/`)**:
  - Uses GPU detector capabilities (`gpu.rs`: NVENC, AMF, QSV, or CPU fallback `libx264`/`libx265`/`libaom-av1`) and forces `libdav1d` when decoding AV1 inputs.
  - Builds unified crop/scale/speed filters (`args.rs`), preserves pure audio streams (`-c:a copy`) when container and codec allow, or mixes custom audio tracks (`-map 0:v:0 -map 1:a:0 -shortest`).
  - Lossless segment splitting (`split.rs`) via `-c copy -f segment` or full re-encode when cropped/scaled.
- **Video-to-GIF & Trimmer-to-GIF (`video/gif.rs`)**:
  - Triggered when `codec_choice == "4"` (Batch Convert) or `export_gif || codec_choice == "4"` (Video Trimmer), outputting `.gif` via single-pass `split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse` (`HIGH` `stats_mode=diff` + `floyd_steinberg` vs `BALANCED` `stats_mode=full` + `bayer`) with configurable GIF FPS (`10`/`15`/`24`/`30`/`ORIGINAL`), strict 720p maximum cap (`720p`, `480p`, or custom `144–720 px`), and `-loop` (`0` vs `-1`).
  - Reuses crop framing (`collect_crop_filters`), speed scaling (`build_speed_filter`), and `libdav1d` AV1 decoding.
- **Precision Trimmer (`video/trim.rs`)**:
  - Microsecond In/Out trimming, aspect-ratio crop framing, playback speed (`0.10x`–`50.00x` via `setpts` or optical `minterpolate` + chained `atempo`), and lossless `-c copy` fast trim when uncropped at `1.0x` speed.
- **Video Combine (`video/combine/`)**:
  - Probes stream compatibility (`compatibility.rs`), executes fast concat demuxer (`combineFastCopy`), or normalized `filter_complex` concat with optional audio overlay (`audio.rs`).
- **3-Tier Live Video Preview (`video/preview.rs`)**:
  - Tier 1 direct HTML5 streaming (`.mp4`, `.webm`), Tier 2 `<200ms` lossless container remux (`-c:v copy -c:a aac -movflags +faststart`), Tier 3 GPU proxy & WMF frame extractor.

