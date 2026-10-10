use super::args::{append_audio_pipeline_args, append_bitrate_flags};
use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::types::MediaMetadata;
use crate::ffmpeg::types::ConversionConfig;
use crate::gpu::GpuCapability;
use crate::utils::{log_error, log_info, resolve_unique_split_dir, resolve_unique_split_stem};
use std::path::Path;

pub struct SplitItemParams<'a> {
    pub file_path: &'a str,
    pub idx: usize,
    pub total_videos: usize,
    pub meta: &'a MediaMetadata,
    pub parent_dir: &'a Path,
    pub file_stem: &'a str,
    pub res_tag: &'a str,
    pub bit_tag: &'a str,
    pub input_decoder_args: &'a [&'a str],
    pub has_trim: bool,
    pub start_sec: f64,
    pub end_sec: f64,
    pub effective_duration: f64,
    pub crop_filter: Option<&'a str>,
    pub crop_box: (Option<u32>, Option<u32>, Option<u32>, Option<u32>),
    pub effective_split_fast_copy: bool,
}

pub async fn execute_split_step<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    config: &ConversionConfig,
    gpu_caps: &GpuCapability,
    params: SplitItemParams<'_>,
) -> Result<(), String> {
    let mut segment_sec = 60.0;
    if config.split_mode == "DURATION" && config.split_value > 0.0 {
        segment_sec = config.split_value;
    } else if config.split_mode == "PARTS" && config.split_value > 0.0 {
        if params.effective_duration > 0.0 {
            segment_sec = params.effective_duration / config.split_value;
        }
    }

    let num_parts = if config.split_mode == "PARTS" && config.split_value > 0.0 {
        config.split_value as usize
    } else if params.effective_duration > 0.0 && segment_sec > 0.0 {
        (params.effective_duration / segment_sec).ceil() as usize
    } else {
        1
    };

    let input_path = Path::new(params.file_path);
    let out_ext = if params.effective_split_fast_copy {
        input_path
            .extension()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "mp4".to_string())
    } else {
        gpu_caps.extension.clone()
    };

    let (pattern_base, split_file_stem) = if config.custom_output_dir.is_none() {
        let split_dir = resolve_unique_split_dir(params.parent_dir, params.file_stem);
        if let Err(e) = std::fs::create_dir_all(&split_dir) {
            log_error(&format!("Failed to create split output directory {:?}: {}", split_dir, e));
        }
        let pat = if params.effective_split_fast_copy {
            split_dir.join(format!("{}_part%03d.{}", params.file_stem, out_ext))
        } else {
            split_dir.join(format!(
                "{}_part%03d_{}_{}.{}",
                params.file_stem, params.res_tag, params.bit_tag, out_ext
            ))
        };
        (pat, params.file_stem.to_string())
    } else {
        let batch_stem = resolve_unique_split_stem(params.parent_dir, params.file_stem, &out_ext);
        let pat = if params.effective_split_fast_copy {
            params.parent_dir.join(format!("{}_part%03d.{}", batch_stem, out_ext))
        } else {
            params.parent_dir.join(format!(
                "{}_part%03d_{}_{}.{}",
                batch_stem, params.res_tag, params.bit_tag, out_ext
            ))
        };
        (pat, batch_stem)
    };
    let _ = split_file_stem;

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];

    if params.effective_split_fast_copy {
        if params.has_trim {
            args.extend([
                "-ss".to_string(),
                format!("{:.3}", params.start_sec),
                "-to".to_string(),
                format!("{:.3}", params.end_sec),
            ]);
        }
        args.extend(["-i".to_string(), params.file_path.to_string()]);
        args.extend([
            "-map".to_string(),
            "0:v:0".to_string(),
            "-map".to_string(),
            "0:a?".to_string(),
            "-c".to_string(),
            "copy".to_string(),
            "-dn".to_string(),
            "-segment_time".to_string(),
            format!("{}", segment_sec),
            "-f".to_string(),
            "segment".to_string(),
            "-reset_timestamps".to_string(),
            "1".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            pattern_base.to_string_lossy().to_string(),
        ]);
    } else {
        for dec_arg in params.input_decoder_args {
            args.push(dec_arg.to_string());
        }
        if params.has_trim {
            args.extend([
                "-ss".to_string(),
                format!("{:.3}", params.start_sec),
                "-to".to_string(),
                format!("{:.3}", params.end_sec),
            ]);
        }
        args.extend(["-i".to_string(), params.file_path.to_string()]);
        if let Some(ref audio_path) = config.audio_path {
            if !audio_path.is_empty() && Path::new(audio_path).exists() {
                args.extend(["-i".to_string(), audio_path.clone()]);
            }
        }

        let (cw, ch, cx, cy) = params.crop_box;
        let mut vf_parts: Vec<String> = Vec::new();
        if let Some(cf) = params.crop_filter {
            log_info(&format!("Applying canvas aspect ratio & crop filter: {}", cf));
            vf_parts.push(cf.to_string());
        } else if let (Some(w), Some(h), Some(x), Some(y)) = (cw, ch, cx, cy) {
            log_info(&format!("Applying aspect ratio video crop filter: {}x{}+{}+{}", w, h, x, y));
            vf_parts.push(format!("crop={}:{}:{}:{}", w, h, x, y));
        }
        if config.target_height != "ORIGINAL" {
            let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                h.clamp(144, 8192).to_string()
            } else {
                config.target_height.clone()
            };
            vf_parts.push(format!("scale=-2:{},format=yuv420p", effective_height));
        } else if !vf_parts.is_empty() {
            vf_parts.push("format=yuv420p".to_string());
        }

        if !vf_parts.is_empty() {
            args.extend(["-vf".to_string(), vf_parts.join(",")]);
        }

        args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        append_audio_pipeline_args(
            &mut args,
            config.audio_path.as_deref(),
            config.audio_fade_in.unwrap_or(false),
            config.audio_fade_out.unwrap_or(false),
            params.effective_duration,
        );

        args.extend([
            "-dn".to_string(),
            "-fps_mode".to_string(),
            "cfr".to_string(),
            "-segment_time".to_string(),
            format!("{}", segment_sec),
            "-f".to_string(),
            "segment".to_string(),
            "-reset_timestamps".to_string(),
            "1".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            pattern_base.to_string_lossy().to_string(),
        ]);
    }

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &params.meta.file_name,
        params.idx + 1,
        params.total_videos,
        params.effective_duration,
        num_parts,
        None,
    )
    .await
}
