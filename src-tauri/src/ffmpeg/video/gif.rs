use super::convert::transcode::TranscodeItemParams;
use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::types::{ConversionConfig, MediaMetadata, TrimConfig};
use crate::utils::{log_info, resolve_conflict_path};
use std::path::Path;

/// Builds an O(1)-memory single-pass FFmpeg 256-color palettegen/paletteuse GIF filtergraph.
pub fn build_gif_palette_filter(
    pre_filters: &[String],
    target_height: &str,
    gif_fps: &str,
    gif_quality: &str,
) -> String {
    let mut chain: Vec<String> = pre_filters.to_vec();

    if !gif_fps.is_empty() && gif_fps != "ORIGINAL" {
        if let Ok(fps_val) = gif_fps.parse::<f64>() {
            let clamped = fps_val.clamp(1.0, 60.0);
            chain.push(format!("fps={}", clamped));
        }
    }

    let h = (target_height.parse::<u32>().unwrap_or(720).clamp(144, 720) / 2) * 2;
    chain.push(format!("scale=-2:{}:flags=lanczos", h));

    let palette_stage = if gif_quality == "BALANCED" {
        "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=single[p];[s1][p]paletteuse=dither=sierra2_4a:new=1"
    } else {
        "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:new=1"
    };
    chain.push(palette_stage.to_string());
    chain.join(",")
}

/// Builds a streaming FFmpeg filtergraph for 24-bit Animated WebP (`libwebp`).
pub fn build_webp_anim_filter(
    pre_filters: &[String],
    target_height: &str,
    anim_fps: &str,
) -> String {
    let mut chain: Vec<String> = pre_filters.to_vec();

    if !anim_fps.is_empty() && anim_fps != "ORIGINAL" {
        if let Ok(fps_val) = anim_fps.parse::<f64>() {
            let clamped = fps_val.clamp(1.0, 60.0);
            chain.push(format!("fps={}", clamped));
        }
    }

    let h = (target_height.parse::<u32>().unwrap_or(720).clamp(144, 1080) / 2) * 2;
    chain.push(format!("scale=-2:{}:flags=lanczos,format=yuv420p", h));
    chain.join(",")
}

fn append_anim_encode_args(
    args: &mut Vec<String>,
    is_webp: bool,
    pre_filters: &[String],
    target_height: &str,
    anim_fps: &str,
    quality: &str,
    loop_enabled: bool,
) {
    if is_webp {
        let vf = build_webp_anim_filter(pre_filters, target_height, anim_fps);
        let (q_val, comp_lvl) = if quality == "BALANCED" { ("65", "4") } else { ("80", "3") };
        let loop_val = if loop_enabled { "0" } else { "1" };
        args.extend([
            "-vf".to_string(),
            vf,
            "-c:v".to_string(),
            "libwebp".to_string(),
            "-lossless".to_string(),
            "0".to_string(),
            "-compression_level".to_string(),
            comp_lvl.to_string(),
            "-quality".to_string(),
            q_val.to_string(),
            "-preset".to_string(),
            "default".to_string(),
            "-an".to_string(),
            "-dn".to_string(),
            "-loop".to_string(),
            loop_val.to_string(),
        ]);
    } else {
        let vf = build_gif_palette_filter(pre_filters, target_height, anim_fps, quality);
        let loop_val = if loop_enabled { "0" } else { "-1" };
        args.extend([
            "-vf".to_string(),
            vf,
            "-an".to_string(),
            "-dn".to_string(),
            "-loop".to_string(),
            loop_val.to_string(),
        ]);
    }
}

fn collect_crop_filters(
    crop_filter: Option<&str>,
    crop_box: (Option<u32>, Option<u32>, Option<u32>, Option<u32>),
) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(cf) = crop_filter {
        if !cf.is_empty() {
            filters.push(cf.to_string());
            return filters;
        }
    }
    if let (Some(w), Some(h), Some(x), Some(y)) = crop_box {
        filters.push(format!("crop={}:{}:{}:{}", w, h, x, y));
    }
    filters
}

fn build_speed_filter(speed: f64, slow_mo_mode: Option<&str>, meta: &MediaMetadata) -> String {
    let pts_factor = 1.0 / speed;
    let slowmo = slow_mo_mode.unwrap_or("fast");
    if speed < 1.0 && slowmo == "OPTICAL_SMOOTH" {
        let base_fps = if meta.duration_sec > 0.0 && meta.total_frames > 0.0 {
            (meta.total_frames / meta.duration_sec).clamp(1.0, 240.0)
        } else {
            60.0
        };
        let target_fps = (base_fps * pts_factor).clamp(24.0, 120.0);
        format!(
            "minterpolate='mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:fps={:.2}',setpts={:.4}*PTS",
            target_fps, pts_factor
        )
    } else {
        format!("setpts={:.4}*PTS", pts_factor)
    }
}

/// Converts a queued video (with optional saved trim/crop) into an animated GIF or WebP.
pub async fn execute_gif_convert_step<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    config: &ConversionConfig,
    params: TranscodeItemParams<'_>,
) -> Result<(), String> {
    let is_webp = config.anim_format.as_deref() == Some("WEBP");
    let effective_stem = if params.has_trim && !params.file_stem.ends_with("_trimmed") {
        format!("{}_trimmed", params.file_stem)
    } else {
        params.file_stem.to_string()
    };

    let (tag, ext, status_label) = if is_webp {
        ("webp", "webp", "Exporting Animated WebP")
    } else {
        ("gif", "gif", "Exporting Animated GIF")
    };
    let raw_outfile = params
        .parent_dir
        .join(format!("{}_{}_{}.{}", effective_stem, tag, params.res_tag, ext));
    let resolved_outfile = resolve_conflict_path(raw_outfile);

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];
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

    let pre_filters = collect_crop_filters(params.crop_filter, params.crop_box);
    let gif_fps = config.gif_fps.as_deref().unwrap_or("15");
    let gif_quality = config.gif_quality.as_deref().unwrap_or("HIGH");
    let loop_enabled = config.gif_loop.unwrap_or(true);
    append_anim_encode_args(
        &mut args,
        is_webp,
        &pre_filters,
        &config.target_height,
        gif_fps,
        gif_quality,
        loop_enabled,
    );

    args.extend([
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        resolved_outfile.to_string_lossy().to_string(),
    ]);

    log_info(&format!("Exporting video to {} -> {:?}", if is_webp { "Animated WebP" } else { "GIF" }, resolved_outfile));

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &params.meta.file_name,
        params.idx + 1,
        params.total_videos,
        params.effective_duration,
        1,
        Some(status_label),
    )
    .await
}

/// Exports a precision-trimmed, optionally cropped/speed-adjusted video segment as an animated GIF or WebP.
pub async fn execute_gif_trim_step<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    config: &TrimConfig,
    meta: &MediaMetadata,
    parent_dir: &Path,
    file_stem: &str,
    start_sec: f64,
    end_sec: f64,
    speed: f64,
    is_speed_changed: bool,
    effective_output_duration: f64,
) -> Result<(), String> {
    let is_webp = config.anim_format.as_deref() == Some("WEBP");
    let (ext, status_label) = if is_webp {
        ("webp", "Exporting Trimmed WebP")
    } else {
        ("gif", "Exporting Trimmed GIF")
    };
    let raw_outfile = parent_dir.join(format!("{}_trimmed.{}", file_stem, ext));
    let resolved_outfile = resolve_conflict_path(raw_outfile);

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];
    if meta.codec_name == "av1" {
        args.extend(["-c:v:0".to_string(), "libdav1d".to_string()]);
    } else {
        args.extend(["-hwaccel".to_string(), "auto".to_string()]);
    }

    args.extend([
        "-ss".to_string(),
        format!("{:.3}", start_sec),
        "-to".to_string(),
        format!("{:.3}", end_sec),
        "-i".to_string(),
        config.input_file.clone(),
    ]);

    let mut pre_filters = collect_crop_filters(
        config.crop_filter.as_deref(),
        (config.crop_w, config.crop_h, config.crop_x, config.crop_y),
    );
    if is_speed_changed {
        pre_filters.push(build_speed_filter(speed, config.slow_mo_mode.as_deref(), meta));
    }

    let gif_fps = config.gif_fps.as_deref().unwrap_or("15");
    let gif_quality = config.gif_quality.as_deref().unwrap_or("HIGH");
    let loop_enabled = config.gif_loop.unwrap_or(true);
    append_anim_encode_args(
        &mut args,
        is_webp,
        &pre_filters,
        &config.target_height,
        gif_fps,
        gif_quality,
        loop_enabled,
    );

    args.extend([
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        resolved_outfile.to_string_lossy().to_string(),
    ]);

    log_info(&format!("Exporting trimmed video to {} -> {:?}", if is_webp { "Animated WebP" } else { "GIF" }, resolved_outfile));

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &meta.file_name,
        1,
        1,
        effective_output_duration,
        1,
        Some(status_label),
    )
    .await
}

