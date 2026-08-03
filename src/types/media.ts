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
  jpgQuality: number | null; // null = ORIGINAL or 1-100
  webQuality: number; // 1-100
  webScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  webHeight: number | null; // Custom height in px
  pdfQuality: number | null; // null = ORIGINAL or 1-100
  pdfScalePercent: number | null; // 30, 50, 80 or null for ORIGINAL
  pdfHeight: number | null; // Custom height in px
  mergePdf: boolean; // True if merging multiple images into single PDF
  
  // Image to Video options
  videoMode: ImageToVideoMode; // 'SLIDESHOW' (seconds/photo) or 'SEQUENCE' (1 photo = 1 frame for image sequences / animations)
  videoDurationSec: number; // Duration for single image (sec) or per image for slideshow
  videoFps: VideoFpsPreset;
  videoResolution: VideoResolutionPreset;
  audioPath: string | null; // Optional background audio file path
  
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
