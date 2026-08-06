use super::process::execute_ffmpeg_process;
use super::probe::probe_file;
use super::types::ConversionConfig;
use crate::utils::{log_error, log_info, resolve_conflict_path, resolve_unique_split_dir, resolve_unique_split_stem};
use std::path::{Path, PathBuf};


/// Main execution routine for video transcode and segment splitting
pub async fn run_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ConversionConfig,
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

        // --- SPLIT MODE EXECUTION ---
        if config.video_action == "SPLIT" {
            let mut segment_sec = 60.0;
            if config.split_mode == "DURATION" && config.split_value > 0.0 {
                segment_sec = config.split_value;
            } else if config.split_mode == "PARTS" && config.split_value > 0.0 {
                if meta.duration_sec > 0.0 {
                    segment_sec = meta.duration_sec / config.split_value;
                }
            }

            let num_parts = if config.split_mode == "PARTS" && config.split_value > 0.0 {
                config.split_value as usize
            } else if meta.duration_sec > 0.0 && segment_sec > 0.0 {
                (meta.duration_sec / segment_sec).ceil() as usize
            } else {
                1
            };

            let out_ext = if config.split_fast_copy {
                input_path
                    .extension()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "mp4".to_string())
            } else {
                gpu_caps.extension.clone()
            };

            // Deconflict the output location based on whether the user chose a
            // custom output folder:
            //   - No custom dir  → group segments in a named sub-folder next to source
            //   - Custom dir set → keep files flat, deconflict via stem-prefix counter
            let (pattern_base, split_file_stem) = if config.custom_output_dir.is_none() {
                let split_dir = resolve_unique_split_dir(&parent_dir, &file_stem);
                if let Err(e) = std::fs::create_dir_all(&split_dir) {
                    log_error(&format!("Failed to create split output directory {:?}: {}", split_dir, e));
                }
                let pat = if config.split_fast_copy {
                    split_dir.join(format!("{}_part%03d.{}", file_stem, out_ext))
                } else {
                    split_dir.join(format!("{}_part%03d_{}_{}.{}", file_stem, res_tag, bit_tag, out_ext))
                };
                (pat, file_stem.clone())
            } else {
                let batch_stem = resolve_unique_split_stem(&parent_dir, &file_stem, &out_ext);
                let pat = if config.split_fast_copy {
                    parent_dir.join(format!("{}_part%03d.{}", batch_stem, out_ext))
                } else {
                    parent_dir.join(format!("{}_part%03d_{}_{}.{}", batch_stem, res_tag, bit_tag, out_ext))
                };
                (pat, batch_stem)
            };
            let _ = split_file_stem; // used only to keep binding for potential future use


            let mut args: Vec<String> = vec!["-hide_banner".to_string()];

            if config.split_fast_copy {
                args.extend(["-i".to_string(), file_path.to_string()]);
                args.extend([
                    "-c".to_string(),
                    "copy".to_string(),
                    "-map".to_string(),
                    "0".to_string(),
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
                for dec_arg in &input_decoder_args {
                    args.push(dec_arg.to_string());
                }
                args.extend(["-i".to_string(), file_path.to_string()]);

                if config.target_height != "ORIGINAL" {
                    let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                        h.clamp(144, 8192).to_string()
                    } else {
                        config.target_height.clone()
                    };
                    args.extend([
                        "-vf".to_string(),
                        format!("scale=-2:{},format=yuv420p", effective_height),
                    ]);
                }

                args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
                for arg in gpu_caps.encoder_args.split_whitespace() {
                    args.push(arg.to_string());
                }

                append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

                args.extend([
                    "-map".to_string(),
                    "0:v:0".to_string(),
                    "-map".to_string(),
                    "0:a?".to_string(),
                    "-c:a".to_string(),
                    "copy".to_string(),
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
                &meta.file_name,
                idx + 1,
                total_videos,
                meta.duration_sec,
                num_parts,
            )
            .await?;

            continue;
        }

        // --- FULL CONVERT MODE EXECUTION ---
        let raw_outfile = parent_dir.join(format!(
            "{}_{}_{}.{}",
            file_stem, res_tag, bit_tag, gpu_caps.extension
        ));
        let resolved_outfile = resolve_conflict_path(raw_outfile);

        let mut args: Vec<String> = vec!["-hide_banner".to_string()];
        for dec_arg in &input_decoder_args {
            args.push(dec_arg.to_string());
        }
        args.extend(["-i".to_string(), file_path.to_string()]);

        if config.target_height != "ORIGINAL" {
            let effective_height = if let Ok(h) = config.target_height.parse::<u32>() {
                h.clamp(144, 8192).to_string()
            } else {
                config.target_height.clone()
            };
            args.extend([
                "-vf".to_string(),
                format!("scale=-2:{},format=yuv420p", effective_height),
            ]);
        }

        args.extend(["-c:v".to_string(), gpu_caps.encoder.clone()]);
        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        args.extend([
            "-map".to_string(),
            "0:v:0".to_string(),
            "-map".to_string(),
            "0:a?".to_string(),
            "-c:a".to_string(),
            "copy".to_string(),
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
            &meta.file_name,
            idx + 1,
            total_videos,
            meta.duration_sec,
            1,
        )
        .await?;
    }

    Ok(())
}

pub(crate) fn append_bitrate_flags(args: &mut Vec<String>, target_bitrate: &str, encoder: &str) {
    if target_bitrate == "ORIGINAL" {
        match encoder {
            "libx264" | "libx265" => args.extend(["-crf".to_string(), "23".to_string()]),
            "libaom-av1" => args.extend(["-crf".to_string(), "30".to_string()]),
            "h264_nvenc" | "hevc_nvenc" | "av1_nvenc" => {
                args.extend(["-qp".to_string(), "23".to_string()])
            }
            "h264_amf" | "hevc_amf" | "av1_amf" => args.extend([
                "-rc".to_string(),
                "cqp".to_string(),
                "-qp_i".to_string(),
                "23".to_string(),
                "-qp_p".to_string(),
                "23".to_string(),
            ]),
            "h264_qsv" | "hevc_qsv" | "av1_qsv" => {
                args.extend(["-global_quality".to_string(), "23".to_string()])
            }
            _ => {}
        }
    } else if let Ok(raw_bit_int) = target_bitrate.parse::<u32>() {
        let bit_int = raw_bit_int.clamp(100, 500_000);
        let max_rate = bit_int + (bit_int / 4);
        let buf_size = bit_int * 2;
        args.extend([
            "-b:v".to_string(),
            format!("{}k", bit_int),
            "-maxrate".to_string(),
            format!("{}k", max_rate),
            "-bufsize".to_string(),
            format!("{}k", buf_size),
        ]);
    }
}
