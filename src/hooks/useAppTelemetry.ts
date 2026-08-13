import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ProgressState } from '../components/ProgressModal';
import { FileLoadingState } from '../components/FileLoadingOverlay';

export interface HardwareInfo {
  name: string;
  encoder: string;
  details?: string;
}

export interface DepsStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  magick: boolean;
}

export function useAppTelemetry(setFileLoadingState: React.Dispatch<React.SetStateAction<FileLoadingState>>) {
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo>({
    name: 'Detecting GPU...',
    encoder: '',
  });

  const [depsStatus, setDepsStatus] = useState<DepsStatus>({
    ffmpeg: true,
    ffprobe: true,
    magick: true,
  });

  const [isDownloadingDeps, setIsDownloadingDeps] = useState(false);

  const [progress, setProgress] = useState<ProgressState>({
    isProcessing: false,
    currentFile: '',
    fileIndex: 0,
    totalFiles: 0,
    percent: 0,
    currentPart: 1,
    totalParts: 1,
    status: '',
    completed: false,
  });

  const checkDepsAndGpu = useCallback(async (codec: string) => {
    try {
      const deps: any = await invoke('check_app_dependencies');
      const status = {
        ffmpeg: deps.ffmpeg_exists,
        ffprobe: deps.ffprobe_exists,
        magick: deps.magick_exists,
      };
      setDepsStatus(status);

      if (deps.ffmpeg_exists) {
        const gpu: any = await invoke('detect_gpu_hardware', {
          codecChoice: codec,
          ffmpegPath: deps.ffmpeg_path,
        });
        setHardwareInfo({ name: gpu.hardware_name, encoder: gpu.encoder, details: gpu.details });
      }
      return status;
    } catch (err) {
      console.error('Failed to check dependencies or GPU:', err);
      return { ffmpeg: false, ffprobe: false, magick: false };
    }
  }, []);

  const handleDownloadDependencies = useCallback(
    async (mode: 'all' | 'ffmpeg' | 'magick' | 'app' = 'all', downloadUrl?: string) => {
      setIsDownloadingDeps(true);
      setProgress({
        type: 'download',
        isProcessing: true,
        currentFile:
          mode === 'all'
            ? 'Fetching FFmpeg & ImageMagick Dependencies...'
            : mode === 'magick'
            ? 'Fetching ImageMagick Portable Binary...'
            : mode === 'app'
            ? 'Downloading ALITKEN App Update...'
            : 'Fetching FFmpeg Portable Binaries...',
        fileIndex: 1,
        totalFiles: 1,
        percent: 0,
        currentPart: 1,
        totalParts: 1,
        status: 'Connecting...',
        completed: false,
      });

      try {
        await invoke('update_engine', {
          target: mode,
          downloadUrl: downloadUrl || null,
        });
        await checkDepsAndGpu('1');
        setProgress((prev) => ({
          ...prev,
          type: 'download',
          isProcessing: false,
          completed: true,
          percent: 100,
          status:
            mode === 'app'
              ? 'App Update Installed Successfully! Restarting...'
              : 'Portable binaries installed successfully!',
        }));
      } catch (err: any) {
        setProgress((prev) => ({
          ...prev,
          type: 'download',
          isProcessing: false,
          error: err.toString(),
        }));
      } finally {
        setIsDownloadingDeps(false);
      }
    },
    [checkDepsAndGpu]
  );

  useEffect(() => {
    checkDepsAndGpu('1');

    const unlistenProgress = listen('ffmpeg-progress', (event: any) => {
      const payload = event.payload;
      setProgress((prev) => ({
        ...prev,
        type: 'conversion',
        isProcessing: true,
        currentFile: payload.current_file,
        fileIndex: payload.file_index,
        totalFiles: payload.total_files,
        percent: payload.percent,
        currentPart: payload.current_part,
        totalParts: payload.total_parts,
        status: payload.status,
      }));
    });

    const unlistenImageProgress = listen('image-progress', (event: any) => {
      const payload = event.payload;
      setProgress((prev) => ({
        ...prev,
        type: 'conversion',
        isProcessing: true,
        currentFile: payload.current_file,
        fileIndex: payload.file_index,
        totalFiles: payload.total_files,
        percent: payload.percent,
        currentPart: 1,
        totalParts: 1,
        status: payload.status || payload.phase,
      }));
    });

    const unlistenDownload = listen('download-progress', (event: any) => {
      const payload = event.payload;
      setProgress((prev) => ({
        ...prev,
        type: 'download',
        isProcessing: true,
        currentFile: payload.status,
        fileIndex: payload.current_step || 1,
        totalFiles: payload.total_steps || 1,
        percent: payload.percent,
        currentPart: 1,
        totalParts: 1,
        status:
          payload.speed_mbps > 0
            ? `${payload.downloaded_mb.toFixed(1)} MB / ${
                payload.total_mb > 0 ? payload.total_mb.toFixed(1) + ' MB' : '?? MB'
              } (${payload.speed_mbps.toFixed(1)} MB/s)`
            : payload.status,
      }));
    });

    const unlistenProbeProgress = listen('file-probe-progress', (event: any) => {
      const payload = event.payload;
      setFileLoadingState((prev) => ({
        ...prev,
        loaded: payload.loaded,
        total: payload.total,
        currentFile: payload.current_file,
      }));
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenImageProgress.then((fn) => fn());
      unlistenDownload.then((fn) => fn());
      unlistenProbeProgress.then((fn) => fn());
    };
  }, [checkDepsAndGpu, setFileLoadingState]);

  return {
    hardwareInfo,
    depsStatus,
    isDownloadingDeps,
    progress,
    setProgress,
    checkDepsAndGpu,
    handleDownloadDependencies,
  };
}
