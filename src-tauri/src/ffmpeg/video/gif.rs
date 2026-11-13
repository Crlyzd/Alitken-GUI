use super::convert::transcode::TranscodeItemParams;
use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::types::{ConversionConfig, MediaMetadata, TrimConfig};
use crate::utils::{log_info, resolve_conflict_path};
use std::path::Path;

/// Builds a high-quality single-pass FFmpeg 256-color palettegen/paletteuse GIF filtergraph.
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
        "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=sierra2_4a"
    } else {
        "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle"
    };
    chain.push(palette_stage.to_string());
    chain.join(",")
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

/// Converts a queued video (with optional saved trim/crop) into an animated GIF.
pub async fn execute_gif_convert_step<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    config: &ConversionConfig,
    params: TranscodeItemParams<'_>,
) -> Result<(), String> {
    let effective_stem = if params.has_trim && !params.file_stem.ends_with("_trimmed") {
        format!("{}_trimmed", params.file_stem)
    } else {
        params.file_stem.to_string()
    };

    let raw_outfile = params
        .parent_dir
        .join(format!("{}_gif_{}.gif", effective_stem, params.res_tag));
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
    let vf = build_gif_palette_filter(&pre_filters, &config.target_height, gif_fps, gif_quality);
    let loop_val = if config.gif_loop.unwrap_or(true) { "0" } else { "-1" };

    args.extend([
        "-vf".to_string(),
        vf,
        "-an".to_string(),
        "-dn".to_string(),
        "-loop".to_string(),
        loop_val.to_string(),
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        resolved_outfile.to_string_lossy().to_string(),
    ]);

    log_info(&format!("Exporting video to GIF -> {:?}", resolved_outfile));

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &params.meta.file_name,
        params.idx + 1,
        params.total_videos,
        params.effective_duration,
        1,
        Some("Exporting Animated GIF"),
    )
    .await
}

/// Exports a precision-trimmed, optionally cropped/speed-adjusted video segment as an animated GIF.
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
    let raw_outfile = parent_dir.join(format!("{}_trimmed.gif", file_stem));
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
    let vf = build_gif_palette_filter(&pre_filters, &config.target_height, gif_fps, gif_quality);
    let loop_val = if config.gif_loop.unwrap_or(true) { "0" } else { "-1" };

    args.extend([
        "-vf".to_string(),
        vf,
        "-an".to_string(),
        "-dn".to_string(),
        "-loop".to_string(),
        loop_val.to_string(),
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        resolved_outfile.to_string_lossy().to_string(),
    ]);

    log_info(&format!("Exporting trimmed video to GIF -> {:?}", resolved_outfile));

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &meta.file_name,
        1,
        1,
        effective_output_duration,
        1,
        Some("Exporting Trimmed GIF"),
    )
    .await
}

