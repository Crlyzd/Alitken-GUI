use crate::utils::create_hidden_cmd;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuCapability {
    pub hardware_name: String,
    pub encoder: String,
    pub encoder_args: String,
    pub extension: String,
}

/// Tests if a given FFmpeg encoder initializes cleanly on the current hardware
fn test_encoder_support(ffmpeg_path: &str, encoder: &str) -> bool {
    let output = create_hidden_cmd(ffmpeg_path)
        .args([
            "-hide_banner",
            "-f",
            "lavfi",
            "-i",
            "color=s=256x256",
            "-c:v",
            encoder,
            "-frames:v",
            "1",
            "-f",
            "null",
            "-",
        ])
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

/// Queries graphics hardware and maps requested video codec ("1"=H.264, "2"=HEVC, "3"=AV1)
/// to the optimal hardware-accelerated FFmpeg encoder, falling back to CPU software.
pub fn get_gpu_encoder(codec_choice: &str, ffmpeg_path: &str) -> GpuCapability {
    // 1. Determine CPU Default Fallbacks
    let (mut encoder, mut enc_args, mut ext) = match codec_choice {
        "2" => ("libx265".to_string(), "-preset fast".to_string(), "mp4".to_string()),
        "3" => ("libaom-av1".to_string(), "-cpu-used 6".to_string(), "mkv".to_string()),
        _ => ("libx264".to_string(), "-preset fast".to_string(), "mp4".to_string()),
    };
    let mut hw_name = "CPU (Software Fallback)".to_string();

    // 2. Query Windows Video Controllers via System Information / WMIC / PowerShell fallbacks
    let gpu_string = query_system_gpu_name();

    let mut cand_hw_name = "";
    let mut cand_encoder = "";
    let mut cand_args = "";
    let mut cand_ext = "";

    if gpu_string.contains("NVIDIA") {
        cand_hw_name = "NVIDIA NVENC";
        match codec_choice {
            "2" => { cand_encoder = "hevc_nvenc"; cand_args = "-preset p4 -tune hq"; cand_ext = "mp4"; }
            "3" => { cand_encoder = "av1_nvenc"; cand_args = "-preset p4 -tune hq"; cand_ext = "mkv"; }
            _   => { cand_encoder = "h264_nvenc"; cand_args = "-preset p4 -tune hq"; cand_ext = "mp4"; }
        }
    } else if gpu_string.contains("AMD") || gpu_string.contains("Radeon") {
        cand_hw_name = "AMD AMF";
        match codec_choice {
            "2" => { cand_encoder = "hevc_amf"; cand_args = "-quality quality"; cand_ext = "mp4"; }
            "3" => { cand_encoder = "av1_amf"; cand_args = "-quality quality"; cand_ext = "mkv"; }
            _   => { cand_encoder = "h264_amf"; cand_args = "-quality quality"; cand_ext = "mp4"; }
        }
    } else if gpu_string.contains("Intel") {
        cand_hw_name = "Intel QuickSync";
        match codec_choice {
            "2" => { cand_encoder = "hevc_qsv"; cand_args = "-preset medium"; cand_ext = "mp4"; }
            "3" => { cand_encoder = "av1_qsv"; cand_args = "-preset medium"; cand_ext = "mkv"; }
            _   => { cand_encoder = "h264_qsv"; cand_args = "-preset medium"; cand_ext = "mp4"; }
        }
    }

    // 3. Verify if Candidate Hardware Encoder dry-runs successfully
    if !cand_encoder.is_empty() {
        if test_encoder_support(ffmpeg_path, cand_encoder) {
            hw_name = cand_hw_name.to_string();
            encoder = cand_encoder.to_string();
            enc_args = cand_args.to_string();
            ext = cand_ext.to_string();
        } else {
            hw_name = format!("CPU (Software Fallback - GPU lacks {} support)", cand_encoder);
        }
    }

    GpuCapability {
        hardware_name: hw_name,
        encoder,
        encoder_args: enc_args,
        extension: ext,
    }
}

/// Helper function to query GPU vendor strings on Windows
fn query_system_gpu_name() -> String {
    let output = create_hidden_cmd("wmic")
        .args(["path", "win32_videocontroller", "get", "name"])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout).to_string();
        if !text.is_empty() {
            return text;
        }
    }

    // PowerShell fallback
    let ps_output = create_hidden_cmd("powershell")
        .args(["-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"])
        .output();

    if let Ok(out) = ps_output {
        return String::from_utf8_lossy(&out.stdout).to_string();
    }

    "Generic GPU".to_string()
}
