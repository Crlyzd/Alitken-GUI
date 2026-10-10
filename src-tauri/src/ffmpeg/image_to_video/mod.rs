pub mod demuxer;
pub mod pipe;


use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::process::is_ffmpeg_native_image_format;
use crate::ffmpeg::types::ImageToVideoConfig;
use crate::utils::{log_error, log_info, resolve_conflict_path};
use std::path::{Path, PathBuf};

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

    // Pre-flight file existence check
    for file_path in &config.input_files {
        if !Path::new(file_path).exists() {
            let err_msg = format!(
                "Input image file for video rendering not found: '{}'. Please ensure the file was not deleted or moved.",
                file_path
            );
            log_error(&err_msg);
            return Err(err_msg);
        }
    }

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

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");

    log_info(&format!(
        "Starting Image-to-Video pipeline ({}). Inputs: {}, Duration: {}s, FPS: {}",
        mode,
        config.input_files.len(),
        config.duration_sec,
        config.fps
    ));

    // Pre-flight validation: Ensure all input files exist and are not 0 bytes
    for file_path in &config.input_files {
        let p = Path::new(file_path);
        if !p.exists() {
            let fname = p.file_name().unwrap_or_default().to_string_lossy();
            return Err(format!("Input file '{}' does not exist or was moved.", fname));
        }
        if let Ok(meta) = std::fs::metadata(p) {
            if meta.len() == 0 {
                let fname = p.file_name().unwrap_or_default().to_string_lossy();
                return Err(format!("File '{}' is empty (0 Bytes) and cannot be converted.", fname));
            }
        }
    }

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

    let target_file = out_dir.join(format!("{}.mp4", stem));
    let resolved_out = resolve_conflict_path(target_file);

    let (scale_w, scale_h) = match config.resolution.as_str() {
        "4k" => (3840, 2160),
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        "ORIGINAL" | _ => {
            let mut max_w = 0u32;
            let mut max_h = 0u32;

            // Probe input files using fast binary header reader first
            for file_path in &config.input_files {
                let (w, h) = crate::utils::get_image_dimensions(file_path);
                if w > max_w {
                    max_w = w;
                }
                if h > max_h {
                    max_h = h;
                }
            }

            // Fallback to probe_file (ffprobe) if needed
            if max_w == 0 || max_h == 0 {
                let sample_count = std::cmp::min(config.input_files.len(), 10);
                for file_path in &config.input_files[..sample_count] {
                    if let Ok(meta) = probe_file(ffprobe_path, file_path).await {
                        if meta.width > max_w {
                            max_w = meta.width;
                        }
                        if meta.height > max_h {
                            max_h = meta.height;
                        }
                    }
                }
            }

            if max_w > 0 && max_h > 0 {
                let w = if max_w % 2 != 0 { max_w + 1 } else { max_w };
                let h = if max_h % 2 != 0 { max_h + 1 } else { max_h };
                log_info(&format!("Probed original resolution canvas for Image-to-Video: {}x{}", w, h));
                (w, h)
            } else {
                log_info("Could not probe image dimensions; falling back to 1920x1080 canvas.");
                (1920, 1080)
            }
        }
    };

    // Natural sort files if in sequence mode
    let mut sorted_inputs = config.input_files.clone();
    if mode == "SEQUENCE" {
        sorted_inputs.sort();
    }

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

    let has_non_native = sorted_inputs.iter().any(|p| !is_ffmpeg_native_image_format(p));

    // Zero-Disk In-Memory Pipe Streaming for Non-Native Formats (e.g. HEIC/TIFF/RAW)
    if has_non_native && !magick_path.is_empty() && Path::new(magick_path).exists() {
        log_info("Non-native images detected (e.g. HEIC/TIFF). Engaging Zero-Disk In-Memory Pipe Stream.");
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

    // Fallback: Concat demuxer with pre-normalized frames
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
        &get_img_info,
    )
    .await
}
