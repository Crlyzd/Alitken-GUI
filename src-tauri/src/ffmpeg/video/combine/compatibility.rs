use crate::ffmpeg::types::StreamCompatibilityResult;
use std::path::PathBuf;

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
        if let Ok(m) = std::fs::metadata(&path) {
            if m.len() == 0 {
                let fname = path.file_name().unwrap_or_default().to_string_lossy();
                return Ok(StreamCompatibilityResult {
                    is_compatible: false,
                    reason: format!("File '{}' is empty (0 Bytes) and cannot be combined.", fname),
                });
            }
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
