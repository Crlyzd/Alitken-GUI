use crate::utils::create_hidden_cmd;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuCapability {
    pub hardware_name: String,
    pub encoder: String,
    pub encoder_args: String,
    pub extension: String,
    pub details: Option<String>,
}

static GPU_NAME_CACHE: OnceLock<String> = OnceLock::new();
static ENCODER_TEST_CACHE: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

fn get_encoder_cache() -> &'static Mutex<HashMap<String, bool>> {
    ENCODER_TEST_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Tests if a given FFmpeg encoder initializes cleanly on the current hardware (cached in RAM)
fn test_encoder_support_cached(ffmpeg_path: &str, encoder: &str) -> bool {
    let key = format!("{}:{}", ffmpeg_path, encoder);
    if let Ok(cache) = get_encoder_cache().lock() {
        if let Some(&result) = cache.get(&key) {
            return result;
        }
    }

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

    let result = match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    if let Ok(mut cache) = get_encoder_cache().lock() {
        cache.insert(key, result);
    }

    result
}

struct VendorCandidate {
    vendor_name: &'static str,
    hw_name: &'static str,
    encoder: &'static str,
    args: &'static str,
    ext: &'static str,
}

/// Queries graphics hardware and maps requested video codec ("1"=H.264, "2"=HEVC, "3"=AV1)
/// to the optimal hardware-accelerated FFmpeg encoder, falling back to CPU software.
pub fn get_gpu_encoder(codec_choice: &str, ffmpeg_path: &str) -> GpuCapability {
    // 1. Determine CPU Default Fallbacks
    let (encoder, enc_args, ext) = match codec_choice {
        "2" => ("libx265".to_string(), "-preset fast".to_string(), "mp4".to_string()),
        "3" => ("libaom-av1".to_string(), "-cpu-used 6".to_string(), "mkv".to_string()),
        _ => ("libx264".to_string(), "-preset fast".to_string(), "mp4".to_string()),
    };

    // 2. Query Windows Video Controllers via System Information / WMIC / PowerShell fallbacks
    let gpu_string = query_system_gpu_name();

    let mut candidates: Vec<VendorCandidate> = Vec::new();

    if gpu_string.contains("NVIDIA") {
        let (cand_encoder, cand_args, cand_ext) = match codec_choice {
            "2" => ("hevc_nvenc", "-preset p4 -tune hq", "mp4"),
            "3" => ("av1_nvenc", "-preset p4 -tune hq", "mkv"),
            _   => ("h264_nvenc", "-preset p4 -tune hq", "mp4"),
        };
        candidates.push(VendorCandidate {
            vendor_name: "NVIDIA",
            hw_name: "NVIDIA NVENC",
            encoder: cand_encoder,
            args: cand_args,
            ext: cand_ext,
        });
    }

    if gpu_string.contains("AMD") || gpu_string.contains("Radeon") {
        let (cand_encoder, cand_args, cand_ext) = match codec_choice {
            "2" => ("hevc_amf", "-quality quality", "mp4"),
            "3" => ("av1_amf", "-quality quality", "mkv"),
            _   => ("h264_amf", "-quality quality", "mp4"),
        };
        candidates.push(VendorCandidate {
            vendor_name: "AMD",
            hw_name: "AMD AMF",
            encoder: cand_encoder,
            args: cand_args,
            ext: cand_ext,
        });
    }

    if gpu_string.contains("Intel") {
        let (cand_encoder, cand_args, cand_ext) = match codec_choice {
            "2" => ("hevc_qsv", "-preset medium", "mp4"),
            "3" => ("av1_qsv", "-preset medium", "mkv"),
            _   => ("h264_qsv", "-preset medium", "mp4"),
        };
        candidates.push(VendorCandidate {
            vendor_name: "Intel",
            hw_name: "Intel QuickSync",
            encoder: cand_encoder,
            args: cand_args,
            ext: cand_ext,
        });
    }

    // 3. Test candidates in order using cached encoder support test. If one succeeds, use it!
    let mut failed_notes: Vec<String> = Vec::new();

    for cand in candidates {
        if test_encoder_support_cached(ffmpeg_path, cand.encoder) {
            return GpuCapability {
                hardware_name: cand.hw_name.to_string(),
                encoder: cand.encoder.to_string(),
                encoder_args: cand.args.to_string(),
                extension: cand.ext.to_string(),
                details: None,
            };
        } else {
            failed_notes.push(format!("{} GPU lacks {} support", cand.vendor_name, cand.encoder));
        }
    }

    // 4. Fallback to CPU Software
    let details_note = if !failed_notes.is_empty() {
        Some(format!("CPU Fallback ({}", failed_notes.join(", ")))
    } else {
        Some("CPU Software Encoder".to_string())
    };

    GpuCapability {
        hardware_name: "CPU (Software)".to_string(),
        encoder,
        encoder_args: enc_args,
        extension: ext,
        details: details_note,
    }
}

/// Helper function to query GPU vendor strings on Windows (cached in RAM via OnceLock)
fn query_system_gpu_name() -> String {
    GPU_NAME_CACHE
        .get_or_init(|| {
            let output = create_hidden_cmd("wmic")
                .args(["path", "win32_videocontroller", "get", "name"])
                .output();

            if let Ok(out) = output {
                let text = String::from_utf8_lossy(&out.stdout).to_string();
                if !text.trim().is_empty() {
                    return text;
                }
            }

            // PowerShell fallback
            let ps_output = create_hidden_cmd("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name",
                ])
                .output();

            if let Ok(out) = ps_output {
                return String::from_utf8_lossy(&out.stdout).to_string();
            }

            "Generic GPU".to_string()
        })
        .clone()
}

