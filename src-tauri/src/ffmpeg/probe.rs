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
        }
    }

    log_info(&format!(
        "Probed {}: v_codec={}, a_codec={}, duration={}s, res={}x{}",
        file_name, codec_name, audio_codec, duration_sec, width, height
    ));

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
    })
}
