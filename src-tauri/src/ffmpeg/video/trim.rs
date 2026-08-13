use super::convert::append_bitrate_flags;
use crate::ffmpeg::process::execute_ffmpeg_process;
use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::types::TrimConfig;
use crate::utils::{log_error, log_info, resolve_conflict_path};
use std::path::{Path, PathBuf};

/// Execution routine for single video precision trimming
pub async fn run_trim_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: TrimConfig,
    gpu_caps: crate::gpu::GpuCapability,
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

    if !Path::new(&config.input_file).exists() {
        let err_msg = format!(
            "Input video file not found: '{}'. Please ensure the file was not deleted or moved.",
            config.input_file
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

    log_info(&format!(
        "Starting trim pipeline: file='{}', start={:.3}, end={:.3}, fast_copy={}",
        config.input_file, config.start_sec, config.end_sec, config.fast_copy
    ));

    crate::utils::reset_cancel_flag();

    let meta = probe_file(ffprobe_path, &config.input_file).await?;
    let input_path = Path::new(&config.input_file);
    let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
        PathBuf::from(custom_dir)
    } else {
        input_path.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    if let Err(e) = std::fs::create_dir_all(&parent_dir) {
        log_error(&format!("Failed to create output directory {:?}: {}", parent_dir, e));
    }

    let file_stem = input_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "trimmed_video".to_string());

    let out_ext = if config.fast_copy {
        input_path
            .extension()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "mp4".to_string())
    } else {
        gpu_caps.extension.clone()
    };

    let raw_outfile = parent_dir.join(format!("{}_trimmed.{}", file_stem, out_ext));
    let resolved_outfile = resolve_conflict_path(raw_outfile);

    let mute_audio = config.mute_audio.unwrap_or(false);
    let raw_speed = config.playback_speed.unwrap_or(1.0);
    let speed = raw_speed.clamp(0.1, 50.0);
    let is_speed_changed = (speed - 1.0).abs() > 0.001;
    let has_crop = config.crop_w.is_some() && config.crop_h.is_some();
    let effective_fast_copy = config.fast_copy && !is_speed_changed && !has_crop;

    let start_sec = config.start_sec.max(0.0);
    let end_sec = if config.end_sec > start_sec {
        config.end_sec.min(meta.duration_sec)
    } else {
        meta.duration_sec
    };
    let trim_duration = (end_sec - start_sec).max(0.1);
    let effective_output_duration = trim_duration / speed;

    let mut args: Vec<String> = vec!["-hide_banner".to_string()];

    if effective_fast_copy {
        args.extend([
            "-ss".to_string(),
            format!("{:.3}", start_sec),
            "-to".to_string(),
            format!("{:.3}", end_sec),
            "-i".to_string(),
            config.input_file.clone(),
            "-c:v".to_string(),
            "copy".to_string(),
        ]);

        if mute_audio {
            args.push("-an".to_string());
        } else {
            args.extend([
                "-c:a".to_string(),
                "copy".to_string(),
                "-map".to_string(),
                "0".to_string(),
            ]);
        }

        args.extend([
            "-reset_timestamps".to_string(),
            "1".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            resolved_outfile.to_string_lossy().to_string(),
        ]);
    } else {
        if meta.codec_name == "av1" {
            log_info("AV1 input detected: Forcing VideoLAN libdav1d software decoder");
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

        let mut vf_filters: Vec<String> = Vec::new();

        if let (Some(w), Some(h), Some(x), Some(y)) = (config.crop_w, config.crop_h, config.crop_x, config.crop_y) {
            log_info(&format!("Applying aspect ratio video crop filter: {}x{}+{}+{}", w, h, x, y));
            vf_filters.push(format!("crop={}:{}:{}:{}", w, h, x, y));
        }

        if config.target_height != "ORIGINAL" {
            let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                h.clamp(144, 8192).to_string()
            } else {
                config.target_height.clone()
            };
            vf_filters.push(format!("scale=-2:{},format=yuv420p", effective_height));
        }

        if is_speed_changed {
            let pts_factor = 1.0 / speed;
            if speed < 1.0 && config.slow_mo_mode.as_deref() == Some("OPTICAL_SMOOTH") {
                log_info(&format!("Applying Optical Smooth slow-mo (speed: {:.2}x)", speed));
                vf_filters.push(format!(
                    "setpts={:.6}*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir",
                    pts_factor
                ));
            } else {
                log_info(&format!("Applying Frame Dup speed scale (speed: {:.2}x)", speed));
                vf_filters.push(format!("setpts={:.6}*PTS", pts_factor));
            }
        }

        if !vf_filters.is_empty() {
            args.extend(["-vf".to_string(), vf_filters.join(",")]);
        }

        args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        args.extend(["-map".to_string(), "0:v:0".to_string()]);

        if mute_audio || speed > 4.0 || speed < 0.25 {
            args.push("-an".to_string());
        } else if is_speed_changed {
            let mut af_filters: Vec<String> = Vec::new();
            if speed >= 0.5 && speed <= 2.0 {
                af_filters.push(format!("atempo={:.4}", speed));
            } else if speed > 2.0 && speed <= 4.0 {
                af_filters.push("atempo=2.0".to_string());
                af_filters.push(format!("atempo={:.4}", speed / 2.0));
            } else if speed >= 0.25 && speed < 0.5 {
                af_filters.push("atempo=0.5".to_string());
                af_filters.push(format!("atempo={:.4}", speed / 0.5));
            }

            if !af_filters.is_empty() {
                args.extend([
                    "-map".to_string(),
                    "0:a?".to_string(),
                    "-af".to_string(),
                    af_filters.join(","),
                    "-c:a".to_string(),
                    "aac".to_string(),
                ]);
            }
        } else {
            args.extend([
                "-map".to_string(),
                "0:a?".to_string(),
                "-c:a".to_string(),
                "copy".to_string(),
            ]);
        }

        args.extend([
            "-fps_mode".to_string(),
            "cfr".to_string(),
            "-y".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            resolved_outfile.to_string_lossy().to_string(),
        ]);
    }

    execute_ffmpeg_process(
        app,
        ffmpeg_path,
        args,
        &meta.file_name,
        1,
        1,
        effective_output_duration,
        1,
        None,
    )
    .await?;

    Ok(())
}
