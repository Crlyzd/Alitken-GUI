/// Helper to configure audio stream mapping, fade filters, and encoding for combined outputs.
pub fn append_combine_audio_args(
    args: &mut Vec<String>,
    has_custom_audio: bool,
    fade_in: bool,
    fade_out: bool,
    total_duration_sec: f64,
    default_c_a_copy: bool,
) {
    if has_custom_audio {
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
        if fade_out && total_duration_sec > 1.5 {
            let st = (total_duration_sec - 1.5).max(0.0);
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
    } else {
        args.extend([
            "-map".to_string(),
            "0:v:0".to_string(),
            "-map".to_string(),
            "0:a?".to_string(),
            "-c:a".to_string(),
            if default_c_a_copy { "copy".to_string() } else { "aac".to_string() },
        ]);
        if !default_c_a_copy {
            args.extend(["-b:a".to_string(), "192k".to_string()]);
        }
    }
}
