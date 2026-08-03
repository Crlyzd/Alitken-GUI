use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaMetadata {
    pub file_name: String,
    pub file_path: String,
    pub duration_sec: f64,
    pub total_frames: f64,
    pub codec_name: String,
    pub width: u32,
    pub height: u32,
    pub file_size_mb: f64,
    pub is_video: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionConfig {
    pub video_files: Vec<String>,
    pub video_action: String, // "CONVERT" or "SPLIT"
    pub split_mode: String,   // "DURATION" or "PARTS"
    pub split_value: f64,
    pub split_fast_copy: bool,
    pub target_height: String,  // "ORIGINAL", "1080", "720", "480", "2160"
    pub target_bitrate: String, // "ORIGINAL" or kbps e.g. "5000"
    pub codec_choice: String,   // "1"=H264, "2"=HEVC, "3"=AV1
    pub custom_output_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfmpegProgressPayload {
    pub current_file: String,
    pub file_index: usize,
    pub total_files: usize,
    pub percent: f64,
    pub current_part: usize,
    pub total_parts: usize,
    pub status: String,
}

/// Probes a media file using ffprobe for metadata analysis without spawning console window
pub async fn probe_file(ffprobe_path: &str, file_path: &str) -> Result<MediaMetadata, String> {
    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let file_size = fs_err_file_size(file_path);

    log_info(&format!("Probing file: {}", file_path));

    let output = create_tokio_hidden_cmd(ffprobe_path)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
        ])
        .output()
        .await
        .map_err(|e| {
            let err_msg = format!("ffprobe failed to spawn: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();

    let mut duration_sec = 0.0;
    if let Some(dur_str) = parsed["format"]["duration"].as_str() {
        duration_sec = dur_str.parse::<f64>().unwrap_or(0.0);
    }

    let mut total_frames = 1000.0;
    let mut codec_name = String::new();
    let mut width = 0;
    let mut height = 0;
    let mut is_video = false;

    if let Some(streams) = parsed["streams"].as_array() {
        for stream in streams {
            if stream["codec_type"].as_str() == Some("video") {
                is_video = true;
                codec_name = stream["codec_name"].as_str().unwrap_or("unknown").to_string();
                width = stream["width"].as_u64().unwrap_or(0) as u32;
                height = stream["height"].as_u64().unwrap_or(0) as u32;

                if let Some(nb_frames) = stream["nb_frames"].as_str() {
                    if let Ok(f) = nb_frames.parse::<f64>() {
                        total_frames = f;
                    }
                }
                break;
            }
        }
    }

    log_info(&format!(
        "Probed {}: codec={}, duration={}s, res={}x{}",
        file_name, codec_name, duration_sec, width, height
    ));

    Ok(MediaMetadata {
        file_name,
        file_path: file_path.to_string(),
        duration_sec,
        total_frames,
        codec_name,
        width,
        height,
        file_size_mb: file_size / (1024.0 * 1024.0),
        is_video,
    })
}

/// Main execution routine for video transcode and segment splitting
pub async fn run_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    ffprobe_path: &str,
    config: ConversionConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    let total_videos = config.video_files.len();

    log_info(&format!(
        "Starting pipeline: action={}, files_count={}, encoder={}",
        config.video_action, total_videos, gpu_caps.encoder
    ));

    for (idx, file_path) in config.video_files.iter().enumerate() {
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

            let pattern_base = if config.split_fast_copy {
                parent_dir.join(format!("{}_part%03d.{}", file_stem, out_ext))
            } else {
                parent_dir.join(format!(
                    "{}_part%03d_{}_{}.{}",
                    file_stem, res_tag, bit_tag, out_ext
                ))
            };

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
                    args.extend([
                        "-vf".to_string(),
                        format!("scale=-2:{},format=yuv420p", config.target_height),
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
            args.extend([
                "-vf".to_string(),
                format!("scale=-2:{},format=yuv420p", config.target_height),
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

fn append_bitrate_flags(args: &mut Vec<String>, target_bitrate: &str, encoder: &str) {
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
    } else if let Ok(bit_int) = target_bitrate.parse::<u32>() {
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

async fn execute_ffmpeg_process<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    args: Vec<String>,
    file_name: &str,
    file_index: usize,
    total_files: usize,
    duration_sec: f64,
    total_parts: usize,
) -> Result<(), String> {
    log_info(&format!("Spawning FFmpeg: {} {}", ffmpeg_path, args.join(" ")));

    let mut child = create_tokio_hidden_cmd(ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Failed to spawn FFmpeg process: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut reader = BufReader::new(stdout).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if line.starts_with("out_time_ms=") {
            let ms_str = line.trim_start_matches("out_time_ms=");
            if let Ok(cur_ms) = ms_str.parse::<f64>() {
                if duration_sec > 0.0 {
                    let total_ms = duration_sec * 1_000_000.0;
                    let mut pct = (cur_ms / total_ms) * 100.0;
                    if pct > 100.0 {
                        pct = 100.0;
                    }

                    let cur_part = if total_parts > 1 {
                        let p = ((pct / 100.0) * (total_parts as f64)).floor() as usize + 1;
                        if p > total_parts {
                            total_parts
                        } else {
                            p
                        }
                    } else {
                        1
                    };

                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: file_name.to_string(),
                            file_index,
                            total_files,
                            percent: pct,
                            current_part: cur_part,
                            total_parts,
                            status: format!(
                                "Processing file {}/{} ({:.1}%)",
                                file_index, total_files, pct
                            ),
                        },
                    );
                }
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| {
            let err_msg = format!("FFmpeg wait failed: {}", e);
            log_error(&err_msg);
            err_msg
        })?;

    if status.success() {
        log_info(&format!("Successfully processed {}", file_name));
        Ok(())
    } else {
        log_error(&format!("FFmpeg failed with exit code: {:?}", status.code()));
        Err("FFmpeg processing failed".to_string())
    }
}

fn fs_err_file_size(file_path: &str) -> f64 {
    std::fs::metadata(file_path)
        .map(|m| m.len() as f64)
        .unwrap_or(0.0)
}

pub fn is_ffmpeg_native_image_format(path_str: &str) -> bool {
    let path = Path::new(path_str);
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" | "png" | "webp" | "bmp" | "tiff" | "tif" | "gif" | "tga" | "pnm"
            | "ppm" | "pgm" | "pbm" | "dpx" | "exr" | "svg" | "xpm" => true,
            _ => false,
        }
    } else {
        false
    }
}

fn resolve_conflict_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }

    let parent = path.parent().unwrap_or(Path::new("."));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().unwrap_or_default().to_string_lossy();

    let mut counter = 1;
    loop {
        let new_name = format!("{}_{}.{}", stem, counter, ext);
        let candidate = parent.join(new_name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageToVideoConfig {
    pub input_files: Vec<String>,
    pub mode: Option<String>, // "SLIDESHOW" or "SEQUENCE"
    pub duration_sec: f64,
    pub fps: u32,
    pub resolution: String,
    pub audio_path: Option<String>,
    pub codec_choice: String,
    pub output_dir: Option<String>,
}

pub async fn run_image_to_video_pipeline<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    ffmpeg_path: &str,
    magick_path: &str,
    config: ImageToVideoConfig,
    gpu_caps: crate::gpu::GpuCapability,
) -> Result<(), String> {
    if config.input_files.is_empty() {
        return Err("No input files provided for Image to Video conversion.".to_string());
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");

    log_info(&format!(
        "Starting Image-to-Video pipeline ({}). Inputs: {}, Duration: {}s, FPS: {}",
        mode,
        config.input_files.len(),
        config.duration_sec,
        config.fps
    ));

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
        _ => (1920, 1080),
    };

    let vf_filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p",
        scale_w, scale_h, scale_w, scale_h
    );

    let temp_dir = std::env::temp_dir();
    let batch_id = format!(
        "{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let mut temp_files_to_cleanup: Vec<PathBuf> = Vec::new();

    // Natural sort files if in sequence mode
    let mut sorted_inputs = config.input_files.clone();
    if mode == "SEQUENCE" {
        sorted_inputs.sort();
    }

    let total_count = sorted_inputs.len();

    let frame_dur = if mode == "SEQUENCE" {
        1.0 / (config.fps as f64)
    } else {
        config.duration_sec
    };

    let manifest_file = temp_dir.join(format!("alitken_concat_{}.txt", batch_id));
    temp_files_to_cleanup.push(manifest_file.clone());

    let mut has_preprocessing = false;

    let manifest_input_paths: Vec<String> = if mode == "SEQUENCE" {
        // Mode 2: Blender Animation Sequence Mode
        // Bypass ImageMagick completely for zero overhead on thousands of 3D render frames
        sorted_inputs.clone()
    } else {
        // Mode 1: Photo Slideshow Mode
        // Check if all files are natively supported by FFmpeg concat demuxer
        let all_native = sorted_inputs
            .iter()
            .all(|p| is_ffmpeg_native_image_format(p));

        if all_native {
            log_info(
                "All slideshow input images are native FFmpeg formats. Bypassing ImageMagick pre-conversion.",
            );
            sorted_inputs.clone()
        } else {
            has_preprocessing = true;
            let mut processed_paths = Vec::new();
            for (idx, raw_path_str) in sorted_inputs.iter().enumerate() {
                if is_ffmpeg_native_image_format(raw_path_str) {
                    processed_paths.push(raw_path_str.clone());
                } else {
                    if magick_path.is_empty() || !Path::new(magick_path).exists() {
                        for p in &temp_files_to_cleanup {
                            let _ = std::fs::remove_file(p);
                        }
                        return Err(format!(
                            "ImageMagick (magick.exe) is required to convert non-standard image format: {}",
                            Path::new(raw_path_str)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                        ));
                    }

                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: stem.clone(),
                            file_index: 1,
                            total_files: 1,
                            percent: ((idx as f64) / (total_count as f64)) * 10.0,
                            current_part: 1,
                            total_parts: 1,
                            status: format!(
                                "Preprocessing image {} of {}...",
                                idx + 1,
                                total_count
                            ),
                        },
                    );

                    let temp_png =
                        temp_dir.join(format!("alitken_frame_{}_{}.png", batch_id, idx));
                    temp_files_to_cleanup.push(temp_png.clone());

                    let mut magick_cmd = create_tokio_hidden_cmd(magick_path);
                    magick_cmd.arg(raw_path_str).arg(&temp_png);

                    let status = magick_cmd
                        .status()
                        .await
                        .map_err(|e| format!("Failed to run ImageMagick for frame {}: {}", idx + 1, e))?;

                    if !status.success() {
                        for p in &temp_files_to_cleanup {
                            let _ = std::fs::remove_file(p);
                        }
                        return Err(format!(
                            "ImageMagick failed to process image {}: {}",
                            idx + 1,
                            Path::new(raw_path_str)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                        ));
                    }
                    processed_paths.push(temp_png.to_string_lossy().to_string());
                }
            }
            processed_paths
        }
    };

    // Stage 2: Manifest Generation for Concat Demuxer
    let mut manifest_content = String::new();
    for file_path in &manifest_input_paths {
        let escaped_path = file_path.replace('\\', "/").replace('\'', "'\\''");
        manifest_content.push_str(&format!("file '{}'\nduration {}\n", escaped_path, frame_dur));
    }
    // Concat demuxer spec requires repeating the last file line without duration at the end
    if let Some(last_path) = manifest_input_paths.last() {
        let escaped_path = last_path.replace('\\', "/").replace('\'', "'\\''");
        manifest_content.push_str(&format!("file '{}'\n", escaped_path));
    }

    std::fs::write(&manifest_file, &manifest_content).map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        format!("Failed to write concat manifest file: {}", e)
    })?;

    let total_expected_sec = if mode == "SEQUENCE" {
        (total_count as f64) / (config.fps as f64)
    } else {
        config.duration_sec * (total_count as f64)
    };

    // Stage 3: FFmpeg Execution with Concat Demuxer
    let mut cmd = create_tokio_hidden_cmd(ffmpeg_path);
    cmd.args([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        &manifest_file.to_string_lossy(),
    ]);

    if let Some(ref audio_path) = config.audio_path {
        if Path::new(audio_path).exists() {
            cmd.args(["-i", audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"]);
        }
    }

    cmd.args(["-c:v", &gpu_caps.encoder]);
    for arg in gpu_caps.encoder_args.split_whitespace() {
        cmd.arg(arg);
    }
    cmd.args(["-r", &config.fps.to_string()]);
    cmd.args(["-vf", &vf_filter]);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(resolved_out.to_string_lossy().to_string());

    log_info(&format!("Spawning FFmpeg Image-to-Video: {:?}", cmd));

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        format!("Failed to spawn FFmpeg for image to video: {}", e)
    })?;

    // Asynchronously read stderr in a background task to prevent stdout/stderr pipe deadlocks
    let stderr_stream = child.stderr.take();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        if let Some(stderr) = stderr_stream {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                lines.push(line);
            }
        }
        let start = lines.len().saturating_sub(40);
        lines[start..].join("\n")
    });

    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.starts_with("out_time_ms=") {
                let ms_str = line.trim_start_matches("out_time_ms=");
                if let Ok(ms) = ms_str.parse::<f64>() {
                    let current_sec = ms / 1_000_000.0;
                    let render_pct = (current_sec / total_expected_sec)
                        * if has_preprocessing { 90.0 } else { 100.0 };
                    let pct = if has_preprocessing {
                        (10.0 + render_pct).clamp(10.0, 100.0)
                    } else {
                        render_pct.clamp(0.0, 100.0)
                    };
                    let _ = app.emit(
                        "ffmpeg-progress",
                        FfmpegProgressPayload {
                            current_file: stem.clone(),
                            file_index: 1,
                            total_files: 1,
                            percent: pct,
                            current_part: 1,
                            total_parts: 1,
                            status: format!(
                                "Rendering video ({:.1}s / {:.1}s)...",
                                current_sec, total_expected_sec
                            ),
                        },
                    );
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| {
        for p in &temp_files_to_cleanup {
            let _ = std::fs::remove_file(p);
        }
        e.to_string()
    })?;

    let stderr_output = stderr_handle.await.unwrap_or_default();

    // Stage 4: Cleanup Temp Files
    for temp_path in &temp_files_to_cleanup {
        let _ = std::fs::remove_file(temp_path);
    }

    if !status.success() {
        log_error(&format!("FFmpeg image-to-video failed. Stderr:\n{}", stderr_output));
        return Err(format!(
            "FFmpeg processing failed: {}",
            stderr_output.trim()
        ));
    }

    log_info(&format!("Successfully completed Image-to-Video conversion -> {:?}", resolved_out));

    Ok(())
}

