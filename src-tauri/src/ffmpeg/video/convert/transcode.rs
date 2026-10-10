use super::args::{append_audio_pipeline_args, append_bitrate_flags};
use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::types::MediaMetadata;
use crate::ffmpeg::types::ConversionConfig;
use crate::gpu::GpuCapability;
use crate::utils::{log_info, resolve_conflict_path};
use std::path::Path;

pub struct TranscodeItemParams<'a> {
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
}

pub async fn execute_transcode_step<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    config: &ConversionConfig,
    gpu_caps: &GpuCapability,
    params: TranscodeItemParams<'_>,
) -> Result<(), String> {
    let effective_stem = if params.has_trim && !params.file_stem.ends_with("_trimmed") {
        format!("{}_trimmed", params.file_stem)
    } else {
        params.file_stem.to_string()
    };

    let raw_outfile = params.parent_dir.join(format!(
        "{}_{}_{}.{}",
        effective_stem, params.res_tag, params.bit_tag, gpu_caps.extension
    ));
    let resolved_outfile = resolve_conflict_path(raw_outfile);

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];
    for dec_arg in params.input_decoder_args {
        args.push(dec_arg.to_string());
    }

    if params.has_trim {
        log_info(&format!(
            "Trim interval detected for '{}': start={:.3}s, end={:.3}s (duration={:.3}s)",
            params.meta.file_name, params.start_sec, params.end_sec, params.effective_duration
        ));
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
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        resolved_outfile.to_string_lossy().to_string(),
    ]);

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &params.meta.file_name,
        params.idx + 1,
        params.total_videos,
        params.effective_duration,
        1,
        None,
    )
    .await
}
