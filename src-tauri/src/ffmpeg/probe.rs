use super::process::fs_err_file_size;
use super::types::MediaMetadata;
use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use std::path::Path;

/// Probes a media file using ffprobe for metadata analysis without spawning console window
pub async fn probe_file(ffprobe_path: &str, file_path: &str) -> Result<MediaMetadata, String> {
    if ffprobe_path.is_empty() || !Path::new(ffprobe_path).exists() {
        let err_msg = format!(
            "ffprobe executable not found at: '{}'. Please download dependencies.",
            ffprobe_path
        );
        log_error(&err_msg);
        return Err(err_msg);
    }

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
    let mut audio_codec = String::new();
    let mut width = 0;
    let mut height = 0;
    let mut is_video = false;

    if let Some(streams) = parsed["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or("");
            if codec_type == "video" && !is_video {
                is_video = true;
                codec_name = stream["codec_name"].as_str().unwrap_or("unknown").to_string();
                width = stream["width"].as_u64().unwrap_or(0) as u32;
                height = stream["height"].as_u64().unwrap_or(0) as u32;

                if let Some(nb_frames) = stream["nb_frames"].as_str() {
                    if let Ok(f) = nb_frames.parse::<f64>() {
                        total_frames = f;
                    }
                }
            } else if codec_type == "audio" && audio_codec.is_empty() {
                audio_codec = stream["codec_name"].as_str().unwrap_or("").to_string();
            }

            // Stream-level duration fallback if format.duration was missing/N/A
            if duration_sec <= 0.0 {
                if let Some(dur_str) = stream["duration"].as_str() {
                    if let Ok(d) = dur_str.parse::<f64>() {
                        if d > 0.0 {
                            duration_sec = d;
                        }
                    }
                } else if let Some(dur_str) = stream["tags"]["DURATION"].as_str() {
                    if let Some(d) = parse_timecode_str(dur_str) {
                        if d > 0.0 {
                            duration_sec = d;
                        }
                    }
                }
            }
        }
    }

    // Fast packet scan fallback if duration is still missing (e.g., Chromium MediaRecorder unindexed WebMs)
    if is_video && duration_sec <= 0.0 {
        let ffmpeg_candidate = Path::new(ffprobe_path).with_file_name("ffmpeg.exe");
        let ffmpeg_exe = if ffmpeg_candidate.exists() {
            ffmpeg_candidate
        } else {
            crate::dependencies::get_appdata_bin_dir().join("ffmpeg.exe")
        };

        if ffmpeg_exe.exists() {
            let scan_cmd = create_tokio_hidden_cmd(&ffmpeg_exe.to_string_lossy())
                .args(["-hide_banner", "-i", file_path, "-c", "copy", "-f", "null", "-"])
                .output()
                .await;

            if let Ok(scan_out) = scan_cmd {
                let stderr_str = String::from_utf8_lossy(&scan_out.stderr);
                if let Some((d, f_opt)) = parse_ffmpeg_packet_time(&stderr_str) {
                    if d > 0.0 {
                        duration_sec = d;
                        log_info(&format!(
                            "Fast packet probe resolved duration for {}: {:.3}s",
                            file_name, duration_sec
                        ));
                    }
                    if let Some(frames) = f_opt {
                        if frames > 0.0 {
                            total_frames = frames;
                        }
                    }
                }
            }
        }
    }

    log_info(&format!(
        "Probed {}: v_codec={}, a_codec={}, duration={}s, res={}x{}",
        file_name, codec_name, audio_codec, duration_sec, width, height
    ));

    let is_corrupted = file_size == 0.0 || (width == 0 && height == 0 && duration_sec == 0.0);
    let error_message = if file_size == 0.0 {
        Some("0 Bytes (Empty File)".to_string())
    } else if width == 0 && height == 0 && duration_sec == 0.0 {
        Some("Corrupted or unreadable media".to_string())
    } else {
        None
    };

    Ok(MediaMetadata {
        file_name,
        file_path: file_path.to_string(),
        duration_sec,
        total_frames,
        codec_name,
        audio_codec,
        width,
        height,
        file_size_mb: file_size / (1024.0 * 1024.0),
        is_video,
        is_corrupted,
        error_message,
    })
}

fn parse_timecode_str(tc: &str) -> Option<f64> {
    let parts: Vec<&str> = tc.split(':').collect();
    if parts.len() == 3 {
        let hrs: f64 = parts[0].trim().parse().ok()?;
        let mins: f64 = parts[1].trim().parse().ok()?;
        let secs: f64 = parts[2].trim().parse().ok()?;
        Some(hrs * 3600.0 + mins * 60.0 + secs)
    } else if parts.len() == 2 {
        let mins: f64 = parts[0].trim().parse().ok()?;
        let secs: f64 = parts[1].trim().parse().ok()?;
        Some(mins * 60.0 + secs)
    } else {
        tc.trim().parse::<f64>().ok()
    }
}

fn parse_ffmpeg_packet_time(stderr: &str) -> Option<(f64, Option<f64>)> {
    let mut duration_sec: Option<f64> = None;
    let mut frames: Option<f64> = None;

    // Look from the end for the last "time=HH:MM:SS.ss" line
    for line in stderr.lines().rev() {
        if let Some(time_idx) = line.find("time=") {
            let after_time = &line[time_idx + 5..];
            let time_token = after_time.split_whitespace().next().unwrap_or("");
            if let Some(d) = parse_timecode_str(time_token) {
                if d > 0.0 {
                    duration_sec = Some(d);
                }
            }
        }

        if frames.is_none() {
            if let Some(frame_idx) = line.find("frame=") {
                let after_frame = &line[frame_idx + 6..];
                let frame_token = after_frame.split_whitespace().next().unwrap_or("");
                if let Ok(f) = frame_token.parse::<f64>() {
                    if f > 0.0 {
                        frames = Some(f);
                    }
                }
            }
        }

        if duration_sec.is_some() {
            break;
        }
    }

    duration_sec.map(|d| (d, frames))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_timecode_str() {
        assert_eq!(parse_timecode_str("00:00:20.28"), Some(20.28));
        assert_eq!(parse_timecode_str("01:02:03.500"), Some(3600.0 + 120.0 + 3.5));
        assert_eq!(parse_timecode_str("05:30.123"), Some(330.123));
        assert_eq!(parse_timecode_str("45.67"), Some(45.67));
        assert_eq!(parse_timecode_str("N/A"), None);
    }

    #[test]
    fn test_parse_ffmpeg_packet_time() {
        let stderr = r#"
[in#0/matroska,webm @ 000001faa5261900] File ended prematurely at pos. 4633002
frame=  605 fps=0.0 q=-1.0 Lsize=    4525KiB time=00:00:20.28 bitrate=1827.1kbits/s speed=2.84e+03x elapsed=0:00:00.00
"#;
        let res = parse_ffmpeg_packet_time(stderr);
        assert!(res.is_some());
        let (dur, frames) = res.unwrap();
        assert!((dur - 20.28).abs() < 0.001);
        assert_eq!(frames, Some(605.0));
    }
}
