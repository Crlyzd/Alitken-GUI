export interface ProgressState {
  type?: 'conversion' | 'download';
  mediaKind?: 'video' | 'image' | 'audio' | 'download';
  action?: 'CONVERT' | 'SPLIT' | 'COMBINE' | 'EXTRACT' | 'IMAGE';
  isProcessing: boolean;
  isSingleOutput?: boolean;
  currentFile: string;
  fileIndex: number;
  totalFiles: number;
  percent: number;
  currentPart: number;
  totalParts: number;
  status: string;
  error?: string;
  completed: boolean;
}
