use serde::{Deserialize, Serialize};

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
