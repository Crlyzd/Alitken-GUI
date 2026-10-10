use crate::utils::{create_tokio_hidden_cmd, log_error, log_info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullMediaInfoPayload {
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub mediainfo_text: String,
    pub raw_json: String,
    pub general: HashMap<String, String>,
    pub video: HashMap<String, String>,
    pub audio: HashMap<String, String>,
    pub other_tracks: Vec<HashMap<String, String>>,
}

/// Probes a media file and compiles a comprehensive MediaInfo-grade report
pub async fn probe_full_media_info(
    ffprobe_path: &str,
    file_path: &str,
) -> Result<FullMediaInfoPayload, String> {
    if ffprobe_path.is_empty() || !Path::new(ffprobe_path).exists() {
        let err = format!("ffprobe not found at '{}'", ffprobe_path);
        log_error(&err);
        return Err(err);
    }

    log_info(&format!("Probing full MediaInfo for: {}", file_path));

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
        .map_err(|e| format!("Failed to spawn ffprobe: {}", e))?;

    let json_str = String::from_utf8_lossy(&output.stdout).to_string();
    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid ffprobe JSON: {}", e))?;

    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let file_size_bytes = std::fs::metadata(file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let mut general = HashMap::new();
    let mut video = HashMap::new();
    let mut audio = HashMap::new();
    let mut other_tracks = Vec::new();

    let mut report = String::new();

    // --- General Section ---
    general.insert("Complete name".into(), file_path.to_string());
    general.insert("File name".into(), file_name.clone());
    general.insert("File size".into(), format_bytes(file_size_bytes));

    let format_obj = &parsed["format"];
    let format_name = format_obj["format_long_name"]
        .as_str()
        .or_else(|| format_obj["format_name"].as_str())
        .unwrap_or("Unknown");
    general.insert("Format".into(), format_name.to_string());

    if let Some(major_brand) = format_obj["tags"]["major_brand"].as_str() {
        general.insert("Codec ID".into(), major_brand.to_string());
    }

    let duration_sec = format_obj["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    if duration_sec > 0.0 {
        general.insert("Duration".into(), format_duration(duration_sec));
    }

    let overall_bps = format_obj["bit_rate"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    if overall_bps > 0.0 {
        general.insert("Overall bit rate".into(), format_bitrate(overall_bps));
        general.insert("Overall bit rate mode".into(), "Variable".into());
    }

    if let Some(created) = format_obj["tags"]["creation_time"].as_str() {
        general.insert("Encoded date".into(), created.replace('T', " ").replace('Z', " UTC"));
    }
    if let Some(encoder) = format_obj["tags"]["encoder"].as_str() {
        general.insert("Writing application".into(), encoder.to_string());
    }
    if let Some(comment) = format_obj["tags"]["comment"].as_str() {
        general.insert("Comment".into(), comment.to_string());
    }

    report.push_str("General\n");
    append_key_value(&mut report, "Complete name", file_path);
    append_key_value(&mut report, "Format", format_name);
    if let Some(v) = general.get("Codec ID") {
        append_key_value(&mut report, "Codec ID", v);
    }
    append_key_value(&mut report, "File size", &format_bytes(file_size_bytes));
    if duration_sec > 0.0 {
        append_key_value(&mut report, "Duration", &format_duration(duration_sec));
    }
    if overall_bps > 0.0 {
        append_key_value(&mut report, "Overall bit rate mode", "Variable");
        append_key_value(&mut report, "Overall bit rate", &format_bitrate(overall_bps));
    }
    if let Some(v) = general.get("Encoded date") {
        append_key_value(&mut report, "Encoded date", v);
    }
    if let Some(v) = general.get("Writing application") {
        append_key_value(&mut report, "Writing application", v);
    }
    if let Some(v) = general.get("Comment") {
        append_key_value(&mut report, "Comment", v);
    }
    report.push('\n');

    // --- Process Streams ---
    if let Some(streams) = parsed["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or("");
            let index = stream["index"].as_u64().unwrap_or(0);

            if codec_type == "video" && video.is_empty() {
                parse_video_stream(stream, duration_sec, &mut video, &mut report);
            } else if codec_type == "audio" && audio.is_empty() {
                parse_audio_stream(stream, duration_sec, &mut audio, &mut report);
            } else {
                let mut other = HashMap::new();
                other.insert("ID".into(), (index + 1).to_string());
                other.insert("Type".into(), codec_type.to_string());
                if let Some(s) = stream["codec_name"].as_str() {
                    other.insert("Format".into(), s.to_string());
                }
                if let Some(s) = stream["codec_tag_string"].as_str() {
                    other.insert("Codec ID".into(), s.to_string());
                }
                if let Some(s) = stream["tags"]["handler_name"].as_str() {
                    other.insert("Title".into(), s.to_string());
                }
                if let Some(s) = stream["tags"]["language"].as_str() {
                    other.insert("Language".into(), s.to_string());
                }

                report.push_str("Other\n");
                append_key_value(&mut report, "ID", &(index + 1).to_string());
                append_key_value(&mut report, "Type", codec_type);
                if let Some(v) = other.get("Format") {
                    append_key_value(&mut report, "Format", v);
                }
                if let Some(v) = other.get("Codec ID") {
                    append_key_value(&mut report, "Codec ID", v);
                }
                if let Some(v) = other.get("Title") {
                    append_key_value(&mut report, "Title", v);
                }
                if let Some(v) = other.get("Language") {
                    append_key_value(&mut report, "Language", v);
                }
                report.push('\n');

                other_tracks.push(other);
            }
        }
    }

    Ok(FullMediaInfoPayload {
        file_name,
        file_path: file_path.to_string(),
        file_size_bytes,
        mediainfo_text: report.trim_end().to_string(),
        raw_json: json_str,
        general,
        video,
        audio,
        other_tracks,
    })
}

fn parse_video_stream(
    stream: &serde_json::Value,
    fallback_dur: f64,
    map: &mut HashMap<String, String>,
    report: &mut String,
) {
    report.push_str("Video\n");
    let id = (stream["index"].as_u64().unwrap_or(0) + 1).to_string();
    map.insert("ID".into(), id.clone());
    append_key_value(report, "ID", &id);

    let format_name = stream["codec_name"].as_str().unwrap_or("unknown").to_uppercase();
    let format_long = stream["codec_long_name"].as_str().unwrap_or("");
    map.insert("Format".into(), format_name.clone());
    append_key_value(report, "Format", &format_name);
    if !format_long.is_empty() {
        map.insert("Format/Info".into(), format_long.into());
        append_key_value(report, "Format/Info", format_long);
    }

    let profile = stream["profile"].as_str().unwrap_or("");
    let level = stream["level"].as_i64().unwrap_or(0);
    let profile_str = if level > 0 {
        format!("{}@L{:.1}", profile, level as f64 / 10.0)
    } else {
        profile.to_string()
    };
    if !profile_str.is_empty() {
        map.insert("Format profile".into(), profile_str.clone());
        append_key_value(report, "Format profile", &profile_str);
    }

    if let Some(tag) = stream["codec_tag_string"].as_str() {
        map.insert("Codec ID".into(), tag.into());
        append_key_value(report, "Codec ID", tag);
    }

    let dur = stream["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(fallback_dur);
    if dur > 0.0 {
        map.insert("Duration".into(), format_duration(dur));
        append_key_value(report, "Duration", &format_duration(dur));
    }

    let bps = stream["bit_rate"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    if bps > 0.0 {
        map.insert("Bit rate".into(), format_bitrate(bps));
        append_key_value(report, "Bit rate", &format_bitrate(bps));
    }

    let w = stream["width"].as_u64().unwrap_or(0);
    let h = stream["height"].as_u64().unwrap_or(0);
    if w > 0 && h > 0 {
        map.insert("Width".into(), format!("{} pixels", w));
        map.insert("Height".into(), format!("{} pixels", h));
        append_key_value(report, "Width", &format!("{} pixels", w));
        append_key_value(report, "Height", &format!("{} pixels", h));
    }

    if let Some(dar) = stream["display_aspect_ratio"].as_str() {
        map.insert("Display aspect ratio".into(), dar.into());
        append_key_value(report, "Display aspect ratio", dar);
    }

    let fps = stream["r_frame_rate"]
        .as_str()
        .or_else(|| stream["avg_frame_rate"].as_str())
        .and_then(crate::ffmpeg::probe::parse_frame_rate_str)
        .unwrap_or(0.0);
    if fps > 0.0 {
        let fps_str = format!("{:.3} FPS", fps);
        map.insert("Frame rate".into(), fps_str.clone());
        append_key_value(report, "Frame rate mode", "Constant");
        append_key_value(report, "Frame rate", &fps_str);
    }

    let pix_fmt = stream["pix_fmt"].as_str().unwrap_or("");
    if !pix_fmt.is_empty() {
        map.insert("Color space".into(), "YUV".into());
        append_key_value(report, "Color space", "YUV");
        let subsampling = if pix_fmt.contains("422") {
            "4:2:2"
        } else if pix_fmt.contains("444") {
            "4:4:4"
        } else {
            "4:2:0"
        };
        map.insert("Chroma subsampling".into(), subsampling.into());
        append_key_value(report, "Chroma subsampling", subsampling);

        let bits = stream["bits_per_raw_sample"]
            .as_str()
            .unwrap_or(if pix_fmt.contains("10") { "10" } else { "8" });
        map.insert("Bit depth".into(), format!("{} bits", bits));
        append_key_value(report, "Bit depth", &format!("{} bits", bits));
    }

    let scan = stream["field_order"].as_str().unwrap_or("progressive");
    let scan_type = if scan.contains("tt") || scan.contains("bb") {
        "Interlaced"
    } else {
        "Progressive"
    };
    map.insert("Scan type".into(), scan_type.into());
    append_key_value(report, "Scan type", scan_type);

    if w > 0 && h > 0 && fps > 0.0 && bps > 0.0 {
        let bpf = bps / (w as f64 * h as f64 * fps);
        map.insert("Bits/(Pixel*Frame)".into(), format!("{:.3}", bpf));
        append_key_value(report, "Bits/(Pixel*Frame)", &format!("{:.3}", bpf));
    }

    if let Some(range) = stream["color_range"].as_str() {
        let r = if range == "pc" || range == "full" { "Full" } else { "Limited" };
        map.insert("Color range".into(), r.into());
        append_key_value(report, "Color range", r);
    }
    if let Some(cp) = stream["color_primaries"].as_str() {
        map.insert("Color primaries".into(), cp.to_uppercase());
        append_key_value(report, "Color primaries", &cp.to_uppercase());
    }
    if let Some(tc) = stream["color_transfer"].as_str() {
        map.insert("Transfer characteristics".into(), tc.to_uppercase());
        append_key_value(report, "Transfer characteristics", &tc.to_uppercase());
    }
    if let Some(mc) = stream["color_space"].as_str() {
        map.insert("Matrix coefficients".into(), mc.to_uppercase());
        append_key_value(report, "Matrix coefficients", &mc.to_uppercase());
    }

    report.push('\n');
}

fn parse_audio_stream(
    stream: &serde_json::Value,
    fallback_dur: f64,
    map: &mut HashMap<String, String>,
    report: &mut String,
) {
    report.push_str("Audio\n");
    let id = (stream["index"].as_u64().unwrap_or(0) + 1).to_string();
    map.insert("ID".into(), id.clone());
    append_key_value(report, "ID", &id);

    let format_name = stream["codec_name"].as_str().unwrap_or("unknown").to_uppercase();
    let format_long = stream["codec_long_name"].as_str().unwrap_or("");
    map.insert("Format".into(), format_name.clone());
    append_key_value(report, "Format", &format_name);
    if !format_long.is_empty() {
        map.insert("Format/Info".into(), format_long.into());
        append_key_value(report, "Format/Info", format_long);
    }

    if let Some(tag) = stream["codec_tag_string"].as_str() {
        map.insert("Codec ID".into(), tag.into());
        append_key_value(report, "Codec ID", tag);
    }

    let dur = stream["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(fallback_dur);
    if dur > 0.0 {
        map.insert("Duration".into(), format_duration(dur));
        append_key_value(report, "Duration", &format_duration(dur));
    }

    let bps = stream["bit_rate"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    if bps > 0.0 {
        map.insert("Bit rate".into(), format_bitrate(bps));
        append_key_value(report, "Bit rate", &format_bitrate(bps));
    }

    let channels = stream["channels"].as_u64().unwrap_or(0);
    if channels > 0 {
        let ch_str = if channels == 1 {
            "1 channel".into()
        } else {
            format!("{} channels", channels)
        };
        map.insert("Channel(s)".into(), ch_str.clone());
        append_key_value(report, "Channel(s)", &ch_str);
    }

    if let Some(layout) = stream["channel_layout"].as_str() {
        let layout_str = if layout == "stereo" { "L R" } else { layout };
        map.insert("Channel layout".into(), layout_str.into());
        append_key_value(report, "Channel layout", layout_str);
    }

    if let Some(sr) = stream["sample_rate"].as_str() {
        if let Ok(hz) = sr.parse::<u64>() {
            let sr_str = format!("{:.1} kHz", hz as f64 / 1000.0);
            map.insert("Sampling rate".into(), sr_str.clone());
            append_key_value(report, "Sampling rate", &sr_str);
        }
    }

    map.insert("Compression mode".into(), "Lossy".into());
    append_key_value(report, "Compression mode", "Lossy");
    report.push('\n');
}

fn append_key_value(report: &mut String, key: &str, val: &str) {
    report.push_str(&format!("{:<28}: {}\n", key, val));
}

fn format_bytes(bytes: u64) -> String {
    let mib = bytes as f64 / (1024.0 * 1024.0);
    if mib >= 1024.0 {
        format!("{:.2} GiB", mib / 1024.0)
    } else {
        format!("{:.1} MiB", mib)
    }
}

fn format_duration(sec: f64) -> String {
    let total_ms = (sec * 1000.0).round() as u64;
    let s = total_ms / 1000;
    let ms = total_ms % 1000;
    if s >= 60 {
        let m = s / 60;
        let rem_s = s % 60;
        format!("{} min {} s", m, rem_s)
    } else {
        format!("{} s {} ms", s, ms)
    }
}

fn format_bitrate(bps: f64) -> String {
    let kbps = bps / 1000.0;
    if kbps >= 1000.0 {
        format!("{:.1} Mb/s", kbps / 1000.0)
    } else {
        format!("{:.0} kb/s", kbps)
    }
}
