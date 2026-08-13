use super::convert::append_bitrate_flags;
use crate::ffmpeg::process::execute_ffmpeg_combine_process;
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

    // Structure to hold per-file probed metadata along with resolved trim bounds
    struct CombineClipInfo {
        meta: MediaMetadata,
        start_sec: f64,
        end_sec: f64,
        has_trim: bool,
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

        // Resolve saved trim boundaries (from config.video_items or trim_presets.json)
        let mut trim_start: Option<f64> = None;
        let mut trim_end: Option<f64> = None;

        if let Some(ref items) = config.video_items {
            if let Some(item) = items.iter().find(|i| i.path == *file_path).or_else(|| items.get(idx)) {
                trim_start = item.trim_start_sec;
                trim_end = item.trim_end_sec;
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
        });
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
        // Transcode mode: Multi-input + filter_complex for robust combination of mismatched codecs/resolutions
        let mut args: Vec<String> = vec!["-hide_banner".to_string()];

        if !has_av1_input {
            args.push("-hwaccel".to_string());
            args.push("auto".to_string());
        }

        // Add each input file with trim boundaries (-ss and -to before -i)
        for (idx, file_path) in config.video_files.iter().enumerate() {
            let info = &clip_infos[idx];

            // Scope VideoLAN libdav1d software decoder per-input specifically for AV1 clips
            let is_av1 = info.meta.codec_name.to_lowercase().contains("av1");
            if is_av1 {
                log_info(&format!(
                    "Input [{}] '{}' is AV1: Forcing VideoLAN libdav1d software decoder",
                    idx, file_path
                ));
                args.push("-c:v".to_string());
                args.push("libdav1d".to_string());
            }

            if info.has_trim {
                args.push("-ss".to_string());
                args.push(format!("{:.3}", info.start_sec));
                args.push("-to".to_string());
                args.push(format!("{:.3}", info.end_sec));
            }
            args.push("-i".to_string());
            args.push(file_path.clone());
        }

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

        let num_inputs = config.video_files.len();
        let mut filter_parts: Vec<String> = Vec::new();

        for (i, info) in clip_infos.iter().enumerate() {
            // Video stream scaling & padding with SAR reset
            let v_filter = format!(
                "[{}:v:0]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1[v{}]",
                i, target_w, target_h, target_w, target_h, i
            );
            filter_parts.push(v_filter);

            let has_audio = !info.meta.audio_codec.is_empty();
            if has_audio {
                filter_parts.push(format!("[{}:a:0]aresample=48000[a{}]", i, i));
            } else {
                filter_parts.push(format!("anullsrc=r=48000:cl=stereo[a{}]", i));
            }
        }

        // Concat clause
        let mut concat_clause = String::new();
        for i in 0..num_inputs {
            concat_clause.push_str(&format!("[v{}][a{}]", i, i));
        }
        concat_clause.push_str(&format!("concat=n={}:v=1:a=1[vout][aout]", num_inputs));
        filter_parts.push(concat_clause);

        let full_filter_complex = filter_parts.join("; ");
        log_info(&format!("Combine filter_complex: {}", full_filter_complex));

        args.push("-filter_complex".to_string());
        args.push(full_filter_complex);

        args.push("-map".to_string());
        args.push("[vout]".to_string());
        args.push("-map".to_string());
        args.push("[aout]".to_string());

        // GPU or CPU encoder
        args.push("-c:v".to_string());
        args.push(gpu_caps.encoder.clone());

        for arg in gpu_caps.encoder_args.split_whitespace() {
            args.push(arg.to_string());
        }

        append_bitrate_flags(&mut args, &config.target_bitrate, &gpu_caps.encoder);

        args.push("-c:a".to_string());
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("192k".to_string());

        args.push("-movflags".to_string());
        args.push("+faststart".to_string());
        args.push("-progress".to_string());
        args.push("pipe:1".to_string());
        args.push("-y".to_string());
        args.push(output_str.clone());

        let output_file_name = format!("{}.{}", raw_stem, ext);
        execute_ffmpeg_combine_process(
            app,
            ffmpeg_path,
            args,
            &output_file_name,
            clip_boundaries,
            total_duration_sec,
        )
        .await
    }
}
