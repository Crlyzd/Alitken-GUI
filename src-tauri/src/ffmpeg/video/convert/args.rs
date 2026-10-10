use std::path::Path;

pub fn append_bitrate_flags(args: &mut Vec<String>, target_bitrate: &str, encoder: &str) {
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

pub fn append_audio_pipeline_args(
    args: &mut Vec<String>,
    custom_audio_path: Option<&str>,
    fade_in: bool,
    fade_out: bool,
    effective_duration: f64,
) {
    if let Some(audio_path) = custom_audio_path {
        if !audio_path.is_empty() && Path::new(audio_path).exists() {
            args.extend([
                "-map".to_string(),
                "0:v:0".to_string(),
                "-map".to_string(),
                "1:a:0".to_string(),
            ]);

            let mut af_filters = Vec::new();
            if fade_in {
                af_filters.push("afade=t=in:ss=0:d=1.5".to_string());
            }
            if fade_out && effective_duration > 1.5 {
                let st = (effective_duration - 1.5).max(0.0);
                af_filters.push(format!("afade=t=out:st={:.3}:d=1.5", st));
            }
            if !af_filters.is_empty() {
                args.extend(["-af".to_string(), af_filters.join(",")]);
            }

            args.extend([
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "192k".to_string(),
                "-shortest".to_string(),
            ]);
            return;
        }
    }

    // Default: map original audio if present and copy stream
    args.extend([
        "-map".to_string(),
        "0:v:0".to_string(),
        "-map".to_string(),
        "0:a?".to_string(),
        "-c:a".to_string(),
        "copy".to_string(),
    ]);
}
