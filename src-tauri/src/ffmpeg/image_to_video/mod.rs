pub mod demuxer;
pub mod pipe;


use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::process::is_ffmpeg_native_image_format;
use crate::ffmpeg::types::ImageToVideoConfig;
use crate::utils::{log_error, log_info, resolve_conflict_path};
use std::path::{Path, PathBuf};

/// Formats paths for ImageMagick so multi-layer/multi-page files select only frame [0].
pub fn format_magick_input_arg(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if matches!(ext.as_str(), "psd" | "psb" | "ico" | "gif" | "webp") {
        format!("{}[0]", path)
    } else {
        path.to_string()
    }
}

/// Shared O(1)-memory 256-color GIF palettegen/paletteuse filter stage for Image-to-GIF pipelines.
pub fn gif_palette_filter_stage(transparent: bool) -> &'static str {
    if transparent {
        "split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=1:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:alpha_threshold=128:new=1"
    } else {
        "split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=0:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:new=1"
    }
}

async fn resolve_canvas_and_homogeneity(
    ffprobe_path: &str,
    inputs: &[String],
    resolution: &str,
    has_non_native: bool,
    export_gif: bool,
    export_webp: bool,
    anim_transparent: bool,
) -> ((u32, u32), bool) {
    let mut dims: Vec<(u32, u32)> = Vec::with_capacity(inputs.len());
    for file_path in inputs {
        let (mut w, mut h) = crate::utils::get_image_dimensions(file_path);
        if (w == 0 || h == 0) && !ffprobe_path.is_empty() {
            if let Ok(meta) = probe_file(ffprobe_path, file_path).await {
                w = meta.width;
                h = meta.height;
            }
        }
        dims.push((w, h));
    }

    let mut portrait_count = 0usize;
    let mut landscape_count = 0usize;
    for &(w, h) in &dims {
        if w > 0 && h > 0 {
            if h > w {
                portrait_count += 1;
            } else {
                landscape_count += 1;
            }
        }
    }
    let is_majority_portrait = portrait_count > landscape_count;
    let effective_res = if export_gif && !matches!(resolution, "720p" | "480p" | "360p") {
        "720p"
    } else if export_webp && !matches!(resolution, "1080p" | "720p" | "480p" | "360p") {
        "720p"
    } else {
        resolution
    };

    let canvas = match effective_res {
        "4k" => {
            if is_majority_portrait { (2160, 3840) } else { (3840, 2160) }
        }
        "1080p" => {
            if is_majority_portrait { (1080, 1920) } else { (1920, 1080) }
        }
        "720p" => {
            if is_majority_portrait { (720, 1280) } else { (1280, 720) }
        }
        "480p" => {
            if is_majority_portrait { (480, 854) } else { (854, 480) }
        }
        "360p" => {
            if is_majority_portrait { (360, 640) } else { (640, 360) }
        }
        "ORIGINAL" | _ => {
            let mut max_w = 0u32;
            let mut max_h = 0u32;
            for &(w, h) in &dims {
                if w > 0 && h > 0 && (h > w) == is_majority_portrait {
                    max_w = max_w.max(w);
                    max_h = max_h.max(h);
                }
            }
            if max_w == 0 || max_h == 0 {
                for &(w, h) in &dims {
                    max_w = max_w.max(w);
                    max_h = max_h.max(h);
                }
            }
            if max_w > 0 && max_h > 0 {
                let w = if max_w % 2 != 0 { max_w + 1 } else { max_w };
                let h = if max_h % 2 != 0 { max_h + 1 } else { max_h };
                log_info(&format!(
                    "Probed original resolution canvas ({}): {}x{}",
                    if is_majority_portrait { "Portrait" } else { "Landscape" },
                    w,
                    h
                ));
                (w, h)
            } else {
                log_info("Could not probe image dimensions; falling back to 1920x1080 canvas.");
                (1920, 1080)
            }
        }
    };

    let first_ext = inputs
        .first()
        .and_then(|p| Path::new(p).extension())
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let first_dim = dims.first().copied().unwrap_or((0, 0));

    let is_homogeneous = !has_non_native
        && !anim_transparent
        && first_dim.0 > 0
        && first_dim.1 > 0
        && inputs.iter().enumerate().all(|(i, p)| {
            let ext = Path::new(p)
                .extension()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            ext == first_ext && dims[i] == first_dim
        });

    (canvas, is_homogeneous)
}

pub async fn run_image_to_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    magick_path: &str,
    config: ImageToVideoConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if config.input_files.is_empty() {
        return Err("No input files provided for Image to Video conversion.".to_string());
    }

    crate::utils::reset_cancel_flag();

    // Pre-flight existence and non-empty check
    for file_path in &config.input_files {
        let p = Path::new(file_path);
        if !p.exists() {
            let err_msg = format!(
                "Input image file not found: '{}'. Please ensure the file was not deleted or moved.",
                file_path
            );
            log_error(&err_msg);
            return Err(err_msg);
        }
        if let Ok(meta) = std::fs::metadata(p) {
            if meta.len() == 0 {
                let fname = p.file_name().unwrap_or_default().to_string_lossy();
                return Err(format!("File '{}' is empty (0 Bytes) and cannot be converted.", fname));
            }
        }
    }

    let export_gif = config.export_gif.unwrap_or(false);
    let export_webp = config.export_webp.unwrap_or(false) && !export_gif;
    let is_anim = export_gif || export_webp;
    let anim_transparent = is_anim && config.gif_transparent.unwrap_or(false);

    if !is_anim {
        if let Some(ref audio_path) = config.audio_path {
            if !audio_path.is_empty() && !Path::new(audio_path).exists() {
                let err_msg = format!(
                    "Background audio file not found: '{}'. Please ensure the file was not deleted or moved.",
                    audio_path
                );
                log_error(&err_msg);
                return Err(err_msg);
            }
        }
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");
    log_info(&format!(
        "Starting Image-to-{} pipeline ({}). Inputs: {}, Duration: {}s, FPS: {}",
        if export_webp { "WebP" } else if export_gif { "GIF" } else { "Video" },
        mode,
        config.input_files.len(),
        config.duration_sec,
        config.fps
    ));

    let first_file = Path::new(&config.input_files[0]);
    let out_dir = if let Some(ref d) = config.output_dir {
        PathBuf::from(d)
    } else {
        first_file.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let stem = if config.input_files.len() == 1 {
        first_file.file_stem().unwrap_or_default().to_string_lossy().to_string()
    } else if mode == "SEQUENCE" {
        "Animation_Render".to_string()
    } else {
        "Image_Slideshow".to_string()
    };

    let ext = if export_webp {
        "webp"
    } else if export_gif {
        "gif"
    } else {
        "mp4"
    };
    let target_file = out_dir.join(format!("{}.{}", stem, ext));
    let resolved_out = resolve_conflict_path(target_file);

    // Preserve explicit UI queue order
    let sorted_inputs = config.input_files.clone();
    let has_non_native = sorted_inputs.iter().any(|p| !is_ffmpeg_native_image_format(p));

    let ((scale_w, scale_h), is_homogeneous) = resolve_canvas_and_homogeneity(
        ffprobe_path,
        &sorted_inputs,
        config.resolution.as_str(),
        has_non_native,
        export_gif,
        export_webp,
        anim_transparent,
    )
    .await;

    let total_count = sorted_inputs.len();
    let sorted_inputs_for_info = sorted_inputs.clone();
    let stem_for_info = stem.clone();
    let duration_sec = config.duration_sec;
    let fps = config.fps;
    let mode_str = mode.to_string();

    let get_img_info = move |sec: f64| -> (usize, String) {
        if total_count == 0 {
            return (1, stem_for_info.clone());
        }
        let idx = if mode_str == "SEQUENCE" {
            (sec * fps as f64).floor() as usize
        } else {
            (sec / duration_sec).floor() as usize
        };
        let clamped_idx = idx.min(total_count - 1);
        let name = Path::new(&sorted_inputs_for_info[clamped_idx])
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| stem_for_info.clone());
        (clamped_idx + 1, name)
    };

    let use_pipe = (has_non_native || !is_homogeneous)
        && !magick_path.is_empty()
        && Path::new(magick_path).exists()
        && !(mode == "SEQUENCE" && is_homogeneous);

    // Zero-Disk In-Memory Pipe Streaming for non-native formats, mixed sequences, or transparent GIFs
    if use_pipe {
        log_info("Engaging Zero-Disk In-Memory Pipe Stream for heterogeneous/transparent frames.");
        match pipe::run_pipe_stream(
            app,
            ffmpeg_path,
            magick_path,
            &config,
            &gpu_caps,
            &sorted_inputs,
            &resolved_out,
            scale_w,
            scale_h,
            mode,
            &get_img_info,
        )
        .await
        {
            Ok(true) => return Ok(()),
            Ok(false) => {
                log_info("Pipe streaming encountered an error; falling back to temporary file pre-normalization routine.");
            }
            Err(e) => return Err(e),
        }
    }

    // Concat demuxer (0ms fast path for homogeneous SEQUENCE, 3-stage normalizer otherwise)
    demuxer::run_concat_demuxer(
        app,
        ffmpeg_path,
        magick_path,
        &config,
        &gpu_caps,
        &sorted_inputs,
        &resolved_out,
        scale_w,
        scale_h,
        mode,
        &stem,
        is_homogeneous,
        &get_img_info,
    )
    .await
}
