import { AspectRatioOption } from './media';

export type SortOption =
  | 'DEFAULT'
  | 'CUSTOM'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'SIZE_ASC'
  | 'SIZE_DESC'
  | 'DURATION_ASC'
  | 'DURATION_DESC';

export interface FileItem {
  name: string;
  path: string;
  sizeMb: number;
  durationSec?: number;
  bitrateKbps?: number;
  resolution?: string;
  codec?: string;
  mediaKind?: 'video' | 'image';
  isMissing?: boolean;
  isCorrupted?: boolean;
  corruptReason?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  trimFastCopy?: boolean;
  filmstrip?: string[];
  aspectRatio?: AspectRatioOption;
  cropOffset?: { x: number; y: number };
  cropScale?: number;
  isCropApplied?: boolean;
  crop_x?: number;
  crop_y?: number;
  crop_w?: number;
  crop_h?: number;
  crop_filter?: string;
  fps?: number;
  pixelFormat?: string;
  profile?: string;
  colorSpace?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  audioBitrateKbps?: number;
  formatName?: string;
  encoder?: string;
}

export function formatBitrate(kbps?: number): string {
  if (!kbps || kbps <= 0) return '';
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    const formatted = mbps >= 100 ? Math.round(mbps).toString() : (mbps % 1 === 0 ? mbps.toFixed(0) : mbps.toFixed(1));
    return `${formatted} Mbps`;
  }
  return `${Math.round(kbps)} kbps`;
}
