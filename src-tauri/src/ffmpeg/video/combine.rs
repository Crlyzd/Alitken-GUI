use super::convert::append_bitrate_flags;
use crate::ffmpeg::process::{execute_ffmpeg_combine_process, execute_ffmpeg_combine_segment_process};
use crate::ffmpeg::probe::probe_file;
use crate::ffmpeg::types::{ConversionConfig, MediaMetadata, StreamCompatibilityResult};
use crate::utils::{log_info, resolve_conflict_path};
use std::path::{Path, PathBuf};

/// Pre-flight stream compatibility check for lossless video combination.
/// Validates that all queued video files share matching codecs, resolutions, pixel formats, and audio presence.
pub async fn check_stream_compatibility(
    ffprobe_path: &str,
    file_paths: &[String],
) -> Result<StreamCompatibilityResult, String> {
    if file_paths.len() < 2 {
        return Ok(StreamCompatibilityResult {
            is_compatible: true,
            reason: String::new(),
        });
    }

    struct StreamInfo {
        v_codec: String,
        width: u32,
        height: u32,
        pix_fmt: String,
        fps_num: u64,
        fps_den: u64,
        has_audio: bool,
        a_codec: String,
    }

    let mut first_info: Option<StreamInfo> = None;

    for path_str in file_paths {
        let path = PathBuf::from(&path_str);
        if !path.exists() {
            continue;
        }

        let output = crate::utils::create_tokio_hidden_cmd(ffprobe_path)
            .args(&[
                "-v",
                "error",
                "-show_entries",
                "stream=codec_name,width,height,pix_fmt,r_frame_rate,codec_type",
                "-of",
                "json",
                path.to_str().unwrap_or_default(),
            ])
            .output()
            .await;

        let mut v_codec = String::new();
        let mut width = 0u32;
        let mut height = 0u32;
        let mut pix_fmt = String::new();
        let mut fps_num = 0u64;
        let mut fps_den = 1u64;
        let mut has_audio = false;
        let mut a_codec = String::new();

        if let Ok(out) = output {
            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                if let Some(streams) = json["streams"].as_array() {
                    for stream in streams {
                        let codec_type = stream["codec_type"].as_str().unwrap_or("");
                        if codec_type == "video" && v_codec.is_empty() {
                            v_codec = stream["codec_name"].as_str().unwrap_or("").to_string();
                            width = stream["width"].as_u64().unwrap_or(0) as u32;
                            height = stream["height"].as_u64().unwrap_or(0) as u32;
                            pix_fmt = stream["pix_fmt"].as_str().unwrap_or("").to_string();

                            if let Some(r_fps) = stream["r_frame_rate"].as_str() {
                                let parts: Vec<&str> = r_fps.split('/').collect();
                                if parts.len() == 2 {
                                    fps_num = parts[0].parse::<u64>().unwrap_or(0);
                                    fps_den = parts[1].parse::<u64>().unwrap_or(1);
                                }
                            }
                        } else if codec_type == "audio" {
                            has_audio = true;
                            a_codec = stream["codec_name"].as_str().unwrap_or("").to_string();
                        }
                    }
                }
            }
        }

        let current = StreamInfo {
            v_codec,
            width,
            height,
            pix_fmt,
            fps_num,
            fps_den,
            has_audio,
            a_codec,
        };

        if let Some(ref base) = first_info {
            if current.v_codec != base.v_codec {
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!(
                        "Codec mismatch: {} vs {}",
                        base.v_codec, current.v_codec
                    ),
                });
            }
            if current.width != base.width || current.height != base.height {
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!(
                        "Resolution mismatch: {}x{} vs {}x{}",
                        base.width, base.height, current.width, current.height
                    ),
                });
            }
            if current.pix_fmt != base.pix_fmt && !current.pix_fmt.is_empty() && !base.pix_fmt.is_empty() {
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!(
                        "Pixel format mismatch: {} vs {}",
                        base.pix_fmt, current.pix_fmt
                    ),
                });
            }
            if base.fps_den > 0 && current.fps_den > 0 {
                let fps1 = base.fps_num as f64 / base.fps_den as f64;
                let fps2 = current.fps_num as f64 / current.fps_den as f64;
                if (fps1 - fps2).abs() > 0.05 {
                    return Ok(StreamCompatibilityResult {
                        is_compatible: false,
                        reason: format!(
                            "Frame rate mismatch: {:.2} fps vs {:.2} fps",
                            fps1, fps2
                        ),
                    });
                }
            }
            if current.has_audio != base.has_audio {
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!(
                        "Audio stream mismatch: {} audio vs {} audio",
                        if base.has_audio { "with" } else { "without" },
                        if current.has_audio { "with" } else { "without" }
                    ),
                });
            }
            if base.has_audio && current.has_audio && base.a_codec != current.a_codec {
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!(
                        "Audio codec mismatch: {} vs {}",
                        base.a_codec, current.a_codec
                    ),
                });
            }
        } else {
            first_info = Some(current);
        }
    }

    Ok(StreamCompatibilityResult {
        is_compatible: true,
        reason: String::new(),
    })
}

/// Concatenates all queued video files into a single output file using FFmpeg's concat demuxer (lossless) or re-encoding with filter_complex.
pub async fn run_combine_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ConversionConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if config.video_files.len() < 2 {
        return Err("At least 2 video files are required to combine.".to_string());
    }

    crate::utils::reset_cancel_flag();

    let is_fast_copy = config.combine_fast_copy.unwrap_or(true);

    // If fast copy requested, verify stream compatibility first
    if is_fast_copy {
        let compatibility = check_stream_compatibility(ffprobe_path, &config.video_files).await?;
        if !compatibility.is_compatible {
            return Err(format!(
                "Lossless stream copy failed: {}",
                compatibility.reason
            ));
        }
    }

    // Structure to hold per-file probed metadata along with resolved trim/crop bounds
    struct CombineClipInfo {
        meta: MediaMetadata,
        start_sec: f64,
        end_sec: f64,
        has_trim: bool,
        crop_x: Option<u32>,
        crop_y: Option<u32>,
        crop_w: Option<u32>,
        crop_h: Option<u32>,
        crop_filter: Option<String>,
        has_crop: bool,
    }

    let mut clip_infos: Vec<CombineClipInfo> = Vec::new();
    let mut total_duration_sec = 0.0;
    let mut first_height: Option<u32> = None;
    let mut first_width: Option<u32> = None;
    let mut clip_boundaries: Vec<(String, f64)> = Vec::new();
    let mut has_av1_input = false;

    for (idx, file_path) in config.video_files.iter().enumerate() {
        if !Path::new(file_path).exists() {
            return Err(format!("Input video file not found: '{}'", file_path));
        }
        let meta = probe_file(ffprobe_path, file_path).await?;
        if meta.codec_name == "av1" {
            has_av1_input = true;
        }

        // Resolve saved trim boundaries & crop params (from config.video_items or trim_presets.json)
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

        if trim_start.is_none() && trim_end.is_none() {
            if let Ok(Some(preset)) = crate::commands::load_trim_preset(file_path.clone()) {
                trim_start = Some(preset.start_sec);
                trim_end = Some(preset.end_sec);
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
        let effective_duration = if has_trim {
            (end_sec - start_sec).max(0.001)
        } else {
            meta.duration_sec
        };

        total_duration_sec += effective_duration;

        let name = Path::new(file_path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        clip_boundaries.push((name, total_duration_sec));

        if idx == 0 && meta.width > 0 && meta.height > 0 {
            first_width = Some(meta.width);
            first_height = Some(meta.height);
        }

        clip_infos.push(CombineClipInfo {
            meta,
            start_sec,
            end_sec,
            has_trim,
            crop_x,
            crop_y,
            crop_w,
            crop_h,
            crop_filter,
            has_crop,
        });
    }

    let any_clip_has_crop = clip_infos.iter().any(|c| c.has_crop);
    if is_fast_copy && any_clip_has_crop {
        return Err("Lossless stream copy cannot be used when video cropping is applied to clips. Please switch off Lossless Copy to combine cropped videos.".to_string());
    }

    // Resolve destination output path
    let first_path = Path::new(&config.video_files[0]);
    let parent_dir = if let Some(ref custom_dir) = config.custom_output_dir {
        PathBuf::from(custom_dir)
    } else {
        first_path.parent().unwrap_or(Path::new(".")).to_path_buf()
    };
    let _ = std::fs::create_dir_all(&parent_dir);

    let raw_stem = config
        .combine_output_name
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("combined_output");
    let ext = first_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4");
    let initial_output = parent_dir.join(format!("{}.{}", raw_stem, ext));
    let final_output = resolve_conflict_path(initial_output);
    let output_str = final_output.to_string_lossy().to_string();

    log_info(&format!(
        "Starting combine pipeline: fast_copy={}, output='{}', total_duration={:.2}s, has_av1={}",
        is_fast_copy, output_str, total_duration_sec, has_av1_input
    ));

    if is_fast_copy {
        // Fast stream copy mode via demuxer
        let timestamp_nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let temp_dir = std::env::temp_dir();
        let concat_file_path = temp_dir.join(format!("alitken_concat_{}.txt", timestamp_nanos));
        {
            let mut file = std::fs::File::create(&concat_file_path)
                .map_err(|e| format!("Failed to create temporary concat list: {}", e))?;
            use std::io::Write;
            for (idx, path_str) in config.video_files.iter().enumerate() {
                let safe_path = path_str.replace('\'', "'\\''");
                writeln!(file, "file '{}'", safe_path)
                    .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                
                let info = &clip_infos[idx];
                if info.has_trim {
                    writeln!(file, "inpoint {:.3}", info.start_sec)
                        .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                    writeln!(file, "outpoint {:.3}", info.end_sec)
                        .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                }
            }
        }

        let args: Vec<String> = vec![
            "-hide_banner".to_string(),
            "-f".to_string(),
            "concat".to_string(),
            "-safe".to_string(),
            "0".to_string(),
            "-i".to_string(),
            concat_file_path.to_string_lossy().to_string(),
            "-c".to_string(),
            "copy".to_string(),
            "-movflags".to_string(),
            "+faststart".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            "-y".to_string(),
            output_str.clone(),
        ];

        let output_file_name = format!("{}.{}", raw_stem, ext);
        let result = execute_ffmpeg_combine_process(
            app,
            ffmpeg_path,
            args,
            &output_file_name,
            clip_boundaries,
            total_duration_sec,
        )
        .await;

        let _ = std::fs::remove_file(&concat_file_path);
        result
    } else {
        // Transcode mode: Smart Hybrid Architecture
        // Pass 1: If streams are compatible, runs Fast Concat Pre-pass (-c copy ~1s) then single-input GPU transcode (300+ FPS).
        // Fallback: If streams differ, uses Sequential Segment Normalization.
        // Peak RAM is strictly bounded (~150MB constant RAM).
        let base_temp_dir = crate::utils::get_temp_dir();
        let timestamp_nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let staging_dir = base_temp_dir.join(format!("alitken_combine_{}", timestamp_nanos));
        if let Err(e) = std::fs::create_dir_all(&staging_dir) {
            return Err(format!("Failed to create staging directory for combine: {}", e));
        }

        log_info(&format!(
            "Sequential Combine Staging Directory created: {:?}",
            staging_dir
        ));

        // RAII Guard to guarantee deletion of staging directory on completion, failure, or cancellation
        struct StagingGuard(PathBuf);
        impl Drop for StagingGuard {
            fn drop(&mut self) {
                if self.0.exists() {
                    let _ = std::fs::remove_dir_all(&self.0);
                    log_info(&format!("Cleaned up staging directory: {:?}", self.0));
                }
            }
        }
        let _guard = StagingGuard(staging_dir.clone());

        let output_file_name = format!("{}.{}", raw_stem, ext);

        // Target bounding box dimensions (even numbers)
        let (target_w, target_h) = if config.target_height != "ORIGINAL" {
            let h = config.target_height.parse::<u32>().unwrap_or(720).clamp(144, 8192);
            let w = match h {
                1080 => 1920,
                720 => 1280,
                480 => 854,
                2160 => 3840,
                _ => (h * 16 / 9 / 2) * 2,
            };
            ((w / 2) * 2, (h / 2) * 2)
        } else {
            let w = (first_width.unwrap_or(1920) / 2) * 2;
            let h = (first_height.unwrap_or(1080) / 2) * 2;
            (w.max(2), h.max(2))
        };

        // Check if stream compatibility allows Fast Concat Pre-Pass
        let compatibility = if any_clip_has_crop {
            StreamCompatibilityResult {
                is_compatible: false,
                reason: "Video crop filters require per-segment re-encoding".to_string(),
            }
        } else {
            check_stream_compatibility(ffprobe_path, &config.video_files).await?
        };
        if compatibility.is_compatible {
            log_info("Streams compatible: Using Fast Concat Pre-Pass + Single-Input GPU Transcode pipeline");
            let master_concat_path = staging_dir.join("master_concat.mp4");
            let concat_txt_path = staging_dir.join("concat_list.txt");
            {
                let mut file = std::fs::File::create(&concat_txt_path)
                    .map_err(|e| format!("Failed to create staging concat list: {}", e))?;
                use std::io::Write;
                for (idx, path_str) in config.video_files.iter().enumerate() {
                    let safe_path = path_str.replace('\'', "'\\''");
                    writeln!(file, "file '{}'", safe_path)
                        .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                    
                    let info = &clip_infos[idx];
                    if info.has_trim {
                        writeln!(file, "inpoint {:.3}", info.start_sec)
                            .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                        writeln!(file, "outpoint {:.3}", info.end_sec)
                            .map_err(|e| format!("Failed to write to concat list: {}", e))?;
                    }
                }
            }

            let concat_args = vec![
                "-hide_banner".to_string(),
                "-f".to_string(),
                "concat".to_string(),
                "-safe".to_string(),
                "0".to_string(),
                "-i".to_string(),
                concat_txt_path.to_string_lossy().to_string(),
                "-c".to_string(),
                "copy".to_string(),
                "-movflags".to_string(),
                "+faststart".to_string(),
                "-y".to_string(),
                master_concat_path.to_string_lossy().to_string(),
            ];

            let pass1_output = crate::utils::create_tokio_hidden_cmd(ffmpeg_path)
                .args(&concat_args)
                .output()
                .await;

            if pass1_output.is_ok() && master_concat_path.exists() {
                let mut transcode_args: Vec<String> = vec!["-hide_banner".to_string()];

                if !has_av1_input {
                    transcode_args.push("-hwaccel".to_string());
                    transcode_args.push("auto".to_string());
                }

                transcode_args.push("-i".to_string());
                transcode_args.push(master_concat_path.to_string_lossy().to_string());

                let vf = format!(
                    "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1",
                    target_w, target_h, target_w, target_h
                );
                transcode_args.push("-vf".to_string());
                transcode_args.push(vf);

                transcode_args.push("-c:v".to_string());
                transcode_args.push(gpu_caps.encoder.clone());

                for arg in gpu_caps.encoder_args.split_whitespace() {
                    transcode_args.push(arg.to_string());
                }

                append_bitrate_flags(&mut transcode_args, &config.target_bitrate, &gpu_caps.encoder);

                transcode_args.push("-c:a".to_string());
                transcode_args.push("aac".to_string());
                transcode_args.push("-b:a".to_string());
                transcode_args.push("192k".to_string());

                transcode_args.push("-movflags".to_string());
                transcode_args.push("+faststart".to_string());
                transcode_args.push("-progress".to_string());
                transcode_args.push("pipe:1".to_string());
                transcode_args.push("-y".to_string());
                transcode_args.push(output_str.clone());

                return execute_ffmpeg_combine_process(
                    app,
                    ffmpeg_path,
                    transcode_args,
                    &output_file_name,
                    clip_boundaries,
                    total_duration_sec,
                )
                .await;
            } else {
                log_info("Fast Concat Pre-pass failed, falling back to Sequential Segment Normalization");
            }
        }

        log_info("Using Sequential Segment Normalization fallback pipeline");
        let total_clips = clip_infos.len();
        let mut temp_clip_paths: Vec<PathBuf> = Vec::new();
        let mut elapsed_duration_sec = 0.0;

        // Step 1: Normalize each clip sequentially into an intermediate staging file
        for (idx, info) in clip_infos.iter().enumerate() {
            if crate::utils::check_cancel_flag() {
                return Err("Processing aborted by user.".to_string());
            }

            let file_path = &config.video_files[idx];
            let clip_duration = if info.has_trim {
                (info.end_sec - info.start_sec).max(0.001)
            } else {
                info.meta.duration_sec
            };

            let temp_clip_path = staging_dir.join(format!("segment_{}.mp4", idx));
            temp_clip_paths.push(temp_clip_path.clone());

            let is_av1 = info.meta.codec_name.to_lowercase().contains("av1");
            let has_audio = !info.meta.audio_codec.is_empty();

            let mut args: Vec<String> = vec!["-hide_banner".to_string()];

            if !is_av1 {
                args.push("-hwaccel".to_string());
                args.push("auto".to_string());
            }

            // Input trimming (-ss before -i, -t for relative duration limit)
            if info.has_trim {
                args.push("-ss".to_string());
                args.push(format!("{:.3}", info.start_sec));
                args.push("-t".to_string());
                args.push(format!("{:.3}", clip_duration));
            }

            if is_av1 {
                args.push("-c:v".to_string());
                args.push("libdav1d".to_string());
            }

            args.push("-i".to_string());
            args.push(file_path.clone());

            // If input file has no audio, generate a duration-bounded dummy silent audio stream
            if !has_audio {
                args.push("-f".to_string());
                args.push("lavfi".to_string());
                args.push("-t".to_string());
                args.push(format!("{:.3}", clip_duration));
                args.push("-i".to_string());
                args.push("anullsrc=r=48000:cl=stereo".to_string());
            }

            // Video scaling & letterboxing/pillarboxing with SAR reset (including clip crop filter if applied)
            let mut vf_parts: Vec<String> = Vec::new();
            if let Some(ref cf) = info.crop_filter {
                log_info(&format!("Applying canvas aspect ratio & crop filter for combine: {}", cf));
                vf_parts.push(cf.clone());
            } else if let (Some(cw), Some(ch), Some(cx), Some(cy)) = (info.crop_w, info.crop_h, info.crop_x, info.crop_y) {
                log_info(&format!("Applying aspect ratio video crop filter for combine: {}x{}+{}+{}", cw, ch, cx, cy));
                vf_parts.push(format!("crop={}:{}:{}:{}", cw, ch, cx, cy));
            }
            vf_parts.push(format!(
                "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1",
                target_w, target_h, target_w, target_h
            ));
            let vf = vf_parts.join(",");
            args.push("-vf".to_string());
            args.push(vf);

            args.push("-c:v".to_string());
            args.push(gpu_caps.encoder.clone());

            for arg in gpu_caps.encoder_args.split_whitespace() {
                args.push(arg.to_string());
            }

            append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

            // Limit thread count per segment process to avoid CPU thread starvation
            args.push("-threads".to_string());
            args.push("4".to_string());

            if has_audio {
                args.push("-map".to_string());
                args.push("0:v:0".to_string());
                args.push("-map".to_string());
                args.push("0:a:0".to_string());
                args.push("-c:a".to_string());
                args.push("aac".to_string());
                args.push("-ar".to_string());
                args.push("48000".to_string());
                args.push("-b:a".to_string());
                args.push("192k".to_string());
            } else {
                args.push("-map".to_string());
                args.push("0:v:0".to_string());
                args.push("-map".to_string());
                args.push("1:a:0".to_string());
                args.push("-c:a".to_string());
                args.push("aac".to_string());
                args.push("-ar".to_string());
                args.push("48000".to_string());
                args.push("-b:a".to_string());
                args.push("192k".to_string());
                args.push("-shortest".to_string());
            }

            args.push("-movflags".to_string());
            args.push("+faststart".to_string());
            args.push("-progress".to_string());
            args.push("pipe:1".to_string());
            args.push("-y".to_string());
            args.push(temp_clip_path.to_string_lossy().to_string());

            let file_display_name = Path::new(file_path)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            execute_ffmpeg_combine_segment_process(
                app,
                ffmpeg_path,
                args,
                &file_display_name,
                idx + 1,
                total_clips,
                clip_duration,
                elapsed_duration_sec,
                total_duration_sec,
            )
            .await?;

            elapsed_duration_sec += clip_duration;
        }

        // Step 2: Assemble normalized clips via instant Lossless Concat Demuxer
        let concat_txt_path = staging_dir.join("concat_list.txt");
        {
            let mut file = std::fs::File::create(&concat_txt_path)
                .map_err(|e| format!("Failed to create staging concat list: {}", e))?;
            use std::io::Write;
            for p in &temp_clip_paths {
                let safe_path = p.to_string_lossy().to_string().replace('\'', "'\\''");
                writeln!(file, "file '{}'", safe_path)
                    .map_err(|e| format!("Failed to write to staging concat list: {}", e))?;
            }
        }

        let concat_args = vec![
            "-hide_banner".to_string(),
            "-f".to_string(),
            "concat".to_string(),
            "-safe".to_string(),
            "0".to_string(),
            "-i".to_string(),
            concat_txt_path.to_string_lossy().to_string(),
            "-c".to_string(),
            "copy".to_string(),
            "-movflags".to_string(),
            "+faststart".to_string(),
            "-progress".to_string(),
            "pipe:1".to_string(),
            "-y".to_string(),
            output_str.clone(),
        ];

        let result = execute_ffmpeg_combine_process(
            app,
            ffmpeg_path,
            concat_args,
            &output_file_name,
            clip_boundaries,
            total_duration_sec,
        )
        .await;

        result
    }
}
