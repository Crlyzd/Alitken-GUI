export type MediaType = 'video' | 'image' | 'none';

export type ImageOutputFormat = 'JPG' | 'PDF' | 'PNG' | 'WEBP' | 'VIDEO';

export type JpgQualityPreset = 'ORIGINAL' | '20%' | '40%' | '60%' | '80%' | 'CUSTOM';
export type PdfQualityPreset = 'ORIGINAL' | '50%' | '60%' | '80%' | '90%' | 'CUSTOM';
export type PdfScalePreset = 'ORIGINAL' | '30%' | '50%' | '80%' | 'CUSTOM';
export type WebQualityPreset = '50%' | '60%' | '80%' | '90%' | 'CUSTOM';
export type WebScalePreset = 'ORIGINAL' | '30%' | '50%' | '80%' | 'CUSTOM';

export type VideoFpsPreset = number;
export type VideoResolutionPreset = '1080p' | '4k' | '720p' | 'ORIGINAL';

export type ImageToVideoMode = 'SLIDESHOW' | 'SEQUENCE';

export interface ImageConfig {
  outputFormat: ImageOutputFormat;

  // JPG settings
  jpgQuality: number;         // 10-100, default 80 (slider)
  jpgScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  jpgHeight: number | null;

  // WEBP settings
  webQuality: number;         // 10-100, default 80 (slider)
  webScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  webHeight: number | null;

  // PDF settings
  pdfQuality: number;         // 10-100, default 80 (slider)
  pdfScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  pdfHeight: number | null;
  mergePdf: boolean;          // True if merging multiple images into single PDF

  // PNG settings
  pngScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  pngHeight: number | null;

  // Image to Video options
  videoMode: ImageToVideoMode; // 'SLIDESHOW' (seconds/photo) or 'SEQUENCE' (1 photo = 1 frame)
  videoDurationSec: number;    // Duration for single image (sec) or per image for slideshow
  videoFps: VideoFpsPreset;
  videoResolution: VideoResolutionPreset;
  audioPath: string | null;    // Optional background audio file path

  outputDir: string | null;
}

export interface MediaFileItem {
  name: string;
  path: string;
  sizeMb: number;
  mediaType: 'video' | 'image';
  durationSec?: number;
  resolution?: string;
  codec?: string;
}

export interface IntegrationStatus {
  sendto_active: boolean;
  executable_path: string;
}

export interface DependencyStatus {
  ffmpeg_exists: boolean;
  ffprobe_exists: boolean;
  magick_exists: boolean;
  ffmpeg_valid: boolean;
  magick_valid: boolean;
  ffmpeg_version: string;
  ffprobe_version: string;
  magick_version: string;
  has_update: boolean;
  magick_has_update?: boolean;
  ffmpeg_latest_version?: string;
  magick_latest_version?: string;
  appdata_path: string;
  ffmpeg_path: string;
  ffprobe_path: string;
  magick_path: string;
}

export interface TrimPreset {
  start_sec: number;
  end_sec: number;
  fast_copy: boolean;
  updated_at: number;
}

export interface TrimConfig {
  input_file: string;
  start_sec: number;
  end_sec: number;
  fast_copy: boolean;
  codec_choice: string;
  target_height: string;
  target_bitrate: string;
  custom_output_dir: string | null;
  playback_speed?: number;
  mute_audio?: boolean;
  slow_mo_mode?: 'FRAME_DUP' | 'OPTICAL_SMOOTH';
}

export interface CacheInfo {
  path: string;
  size_bytes: number;
  is_custom: boolean;
}


