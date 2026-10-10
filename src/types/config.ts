export interface ConfigState {
  videoAction: 'CONVERT' | 'SPLIT' | 'COMBINE' | 'EXTRACT_FRAMES';
  splitMode: 'DURATION' | 'PARTS';
  splitValue: number | '';
  splitFastCopy: boolean;
  combineFastCopy: boolean;
  combineOutputName: string;
  frameOutputFormat: 'PNG' | 'JPEG' | 'WEBP';
  frameRate: 'MAX' | '30' | '10' | '5' | '1';
  frameQuality: number;
  targetHeight: string;
  targetBitrate: string;
  codecChoice: string; // "1"=H264, "2"=HEVC, "3"=AV1
  outputDir: string | null;
  audioPath: string | null;
  audioFadeIn: boolean;
  audioFadeOut: boolean;
}

export const PRESET_HEIGHTS = ['ORIGINAL', '2160', '1440', '1080', '720', '480'];
export const PRESET_BITRATES = ['ORIGINAL', '20000', '15000', '10000', '5000', '2000', '1000'];
