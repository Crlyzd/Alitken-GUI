pub mod args;
pub mod split;
pub mod transcode;

pub use args::*;


use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::types::ConversionConfig;
use crate::gpu::GpuCapability;
use crate::utils::{log_error, log_info};
use std::path::{Path, PathBuf};

/// Main execution routine for video transcode and segment splitting
pub async fn run_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ConversionConfig,
    gpu_caps: GpuCapability,
) -> Result<(), String> {
    if ffmpeg_path.is_empty() || !Path::new(ffmpeg_path).exists() {
        let err_msg = format!(
            "FFmpeg executable not found at: '{}'. Please download dependencies.",
            ffmpeg_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }
    if ffprobe_path.is_empty() || !Path::new(ffprobe_path).exists() {
        let err_msg = format!(
            "FFprobe executable not found at: '{}'. Please download dependencies.",
            ffprobe_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

    let total_videos = config.video_files.len();

    log_info(&format!(
        "Starting pipeline: action={}, files_count={}, encoder={}",
        config.video_action, total_videos, gpu_caps.encoder
    ));

    crate::utils::reset_cancel_flag();

    // Pre-flight file existence check
    for file_path in &config.video_files {
        if !Path::new(file_path).exists() {
            let err_msg = format!(
                "Input video file not found: '{}'. Please ensure the file was not deleted or moved.",
                file_path
            );
            log_error(&err_msg);
            return Err(err_msg);
        }
        if let Ok(m) = std::fs::metadata(file_path) {
            if m.len() == 0 {
                let fname = Path::new(file_path).file_name().unwrap_or_default().to_string_lossy();
                let err_msg = format!("Input video file '{}' is empty (0 Bytes) and cannot be processed.", fname);
                log_error(&err_msg);
                return Err(err_msg);
            }
        }
    }

    for (idx, file_path) in config.video_files.iter().enumerate() {
        if crate::utils::check_cancel_flag() {
            return Err("Processing aborted by user.".to_string());
        }

        let meta = probe_file(ffprobe_path, file_path).await?;
        let input_path = Path::new(file_path);
        let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
            PathBuf::from(custom_dir)
        } else {
            input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
        };

        if let Err(e) = std::fs::create_dir_all(&parent_dir) {
            log_error(&format!("Failed to create output directory {:?}: {}", parent_dir, e));
        }

        // Determine input video decoder (VideoLAN libdav1d for AV1 inputs)
        let mut input_decoder_args = Vec::new();
        if meta.codec_name == "av1" {
            log_info("AV1 input detected: Forcing VideoLAN libdav1d software decoder");
            input_decoder_args.push("-c:v:0");
            input_decoder_args.push("libdav1d");
        } else {
            input_decoder_args.push("-hwaccel");
            input_decoder_args.push("auto");
        }

        let res_tag = if config.target_height == "ORIGINAL" {
            "origRes".to_string()
        } else {
            format!("{}p", config.target_height)
        };

        let bit_tag = if config.target_bitrate == "ORIGINAL" {
            "origBit".to_string()
        } else {
            format!("{}k", config.target_bitrate)
        };

        let file_stem = input_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "output".to_string());

        // Resolve saved trim boundaries & crop parameters (if present in config.video_items or trim_presets.json)
        let mut trim_start: Option<f64> = None;
        let mut trim_end: Option<f64> = None;
        let mut crop_x: Option<u32> = None;
        let mut crop_y: Option<u32> = None;
        let mut crop_w: Option<u32> = None;
        let mut crop_h: Option<u32> = None;
        let mut crop_filter: Option<String> = None;

        if let Some(ref items) = config.video_items {
            if let Some(item) = items.iter().find(|i| i.path == *file_path).or_else(|| items.get(idx)) {
                trim_start = item.trim_start_sec;
                trim_end = item.trim_end_sec;
                crop_x = item.crop_x;
                crop_y = item.crop_y;
                crop_w = item.crop_w;
                crop_h = item.crop_h;
                crop_filter = item.crop_filter.clone();
            }
        }

        if trim_start.is_none() && trim_end.is_none() && crop_filter.is_none() {
            if let Ok(Some(preset)) = crate::commands::load_trim_preset(file_path.clone()) {
                trim_start = Some(preset.start_sec);
                trim_end = Some(preset.end_sec);
                if crop_filter.is_none() {
                    crop_x = preset.crop_x;
                    crop_y = preset.crop_y;
                    crop_w = preset.crop_w;
                    crop_h = preset.crop_h;
                    crop_filter = preset.crop_filter;
                }
            }
        }

        let start_sec = trim_start.unwrap_or(0.0).max(0.0);
        let end_sec = if let Some(e) = trim_end {
            if e > start_sec {
                e.min(meta.duration_sec)
            } else {
                meta.duration_sec
            }
        } else {
            meta.duration_sec
        };

        let has_trim = start_sec > 0.001 || (end_sec > start_sec && end_sec < meta.duration_sec - 0.05);
        let has_crop = (crop_w.is_some() && crop_h.is_some()) || crop_filter.is_some();
        let has_custom_audio = config
            .audio_path
            .as_ref()
            .map_or(false, |p| !p.is_empty() && Path::new(p).exists());
        let effective_split_fast_copy = config.split_fast_copy && !has_crop && !has_custom_audio;

        let effective_duration = if has_trim {
            (end_sec - start_sec).max(0.1)
        } else {
            meta.duration_sec
        };

        let crop_box = (crop_w, crop_h, crop_x, crop_y);

        if config.video_action == "SPLIT" {
            split::execute_split_step(
                app,
                ffmpeg_path,
                &config,
                &gpu_caps,
                split::SplitItemParams {
                    file_path,
                    idx,
                    total_videos,
                    meta: &meta,
                    parent_dir: &parent_dir,
                    file_stem: &file_stem,
                    res_tag: &res_tag,
                    bit_tag: &bit_tag,
                    input_decoder_args: &input_decoder_args,
                    has_trim,
                    start_sec,
                    end_sec,
                    effective_duration,
                    crop_filter: crop_filter.as_deref(),
                    crop_box,
                    effective_split_fast_copy,
                },
            )
            .await?;
        } else {
            transcode::execute_transcode_step(
                app,
                ffmpeg_path,
                &config,
                &gpu_caps,
                transcode::TranscodeItemParams {
                    file_path,
                    idx,
                    total_videos,
                    meta: &meta,
                    parent_dir: &parent_dir,
                    file_stem: &file_stem,
                    res_tag: &res_tag,
                    bit_tag: &bit_tag,
                    input_decoder_args: &input_decoder_args,
                    has_trim,
                    start_sec,
                    end_sec,
                    effective_duration,
                    crop_filter: crop_filter.as_deref(),
                    crop_box,
                },
            )
            .await?;
        }
    }

    Ok(())
}
