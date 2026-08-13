import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../components/Dropzone';
import { ConfigState } from '../components/ConfigPanel';
import { ImageConfig, StreamCompatibilityResult } from '../types/media';
import { ProgressState } from '../components/ProgressModal';

export function useMediaPipelines(
  files: FileItem[],
  videoConfig: ConfigState,
  imageConfig: ImageConfig,
  currentMediaType: 'video' | 'image',
  streamCompatibility: StreamCompatibilityResult | null,
  estimatedFramesCount: number,
  verifyFileAvailability: (targetFiles?: FileItem[]) => Promise<boolean>,
  checkDepsAndGpu: (codec: string) => Promise<{ ffmpeg: boolean; ffprobe: boolean; magick: boolean }>,
  setValidationError: (err: string | null) => void,
  setProgress: React.Dispatch<React.SetStateAction<ProgressState>>,
  setStorageModalState: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      status: 'HardFailure' | 'LowStorageWarning' | 'LargeFileWarning' | null;
      freeBytes: number;
      requiredBytes: number;
      fileSizeBytes: number;
      pendingFile: FileItem | null;
    }>
  >
) {
  const [largeFrameWarningOpen, setLargeFrameWarningOpen] = useState(false);
  const [pendingFrameExtract, setPendingFrameExtract] = useState<(() => Promise<void>) | null>(null);

  const handleStartVideoProcessing = useCallback(async () => {
    if (files.length === 0) return;

    const isAllAvailable = await verifyFileAvailability();
    if (!isAllAvailable) {
      setValidationError(
        'One or more files in the queue are missing or no longer accessible on disk. Please remove missing files before starting.'
      );
      return;
    }

    const currentDeps = await checkDepsAndGpu(videoConfig.codecChoice);
    if (!currentDeps.ffmpeg || !currentDeps.ffprobe) {
      setValidationError(
        'FFmpeg / FFprobe dependencies are missing or were removed. Please click "Install All Dependencies" to download.'
      );
      return;
    }

    if (
      currentMediaType === 'video' &&
      videoConfig.videoAction === 'COMBINE' &&
      videoConfig.combineFastCopy &&
      streamCompatibility &&
      !streamCompatibility.is_compatible
    ) {
      setValidationError(
        'Cannot combine files losslessly due to stream mismatch. Please switch off "Lossless Copy" or fix input files.'
      );
      return;
    }

    // Branch 1: COMBINE QUEUE VIDEOS
    if (videoConfig.videoAction === 'COMBINE') {
      if (files.length < 2) {
        setValidationError('At least 2 video files are required to combine.');
        return;
      }

      setProgress({
        isProcessing: true,
        isSingleOutput: true,
        currentFile: `${videoConfig.combineOutputName || 'combined_output'}.mp4`,
        fileIndex: 1,
        totalFiles: 1,
        percent: 0,
        currentPart: 1,
        totalParts: 1,
        status: videoConfig.combineFastCopy
          ? 'Combining videos via lossless stream copy...'
          : 'Combining and re-encoding videos with hardware acceleration...',
        completed: false,
      });

      try {
        await invoke('start_combine_video_pipeline', {
          config: {
            video_files: files.map((f) => f.path),
            video_items: null,
            video_action: 'COMBINE',
            split_mode: 'DURATION',
            split_value: 0,
            split_fast_copy: false,
            combine_output_name: videoConfig.combineOutputName || 'combined_output',
            combine_fast_copy: videoConfig.combineFastCopy,
            target_height: videoConfig.targetHeight || 'ORIGINAL',
            target_bitrate: videoConfig.targetBitrate || 'ORIGINAL',
            codec_choice: videoConfig.codecChoice,
            custom_output_dir: videoConfig.outputDir || null,
          },
        });

        setProgress((prev) => ({
          ...prev,
          isProcessing: false,
          percent: 100,
          completed: true,
          status: 'All queued videos combined successfully!',
        }));
      } catch (err: any) {
        setProgress((prev) => ({
          ...prev,
          isProcessing: false,
          error: err.toString(),
        }));
      }
      return;
    }

    // Branch 2: EXTRACT ALL FRAMES
    if (videoConfig.videoAction === 'EXTRACT_FRAMES') {
      const executeFrameExtraction = async () => {
        const bytesPerFrame =
          videoConfig.frameOutputFormat === 'PNG'
            ? 1500000
            : videoConfig.frameOutputFormat === 'WEBP'
            ? 300000
            : 200000;

        try {
          const res = await invoke<{
            status: 'HardFailure' | 'LowStorageWarning' | 'CleanPass';
            free_space_bytes: number;
            required_space_bytes: number;
          }>('validate_extraction_storage', {
            outputDir: videoConfig.outputDir || null,
            estimatedFrameCount: estimatedFramesCount,
            bytesPerFrame,
          });

          if (res.status === 'HardFailure') {
            setStorageModalState({
              isOpen: true,
              status: 'HardFailure',
              freeBytes: res.free_space_bytes,
              requiredBytes: res.required_space_bytes,
              fileSizeBytes: res.required_space_bytes,
              pendingFile: null,
            });
            return;
          }
        } catch (e) {
          console.warn('Storage pre-check skipped:', e);
        }

        setProgress({
          isProcessing: true,
          isSingleOutput: false,
          currentFile: files[0].name,
          fileIndex: 1,
          totalFiles: files.length,
          percent: 0,
          currentPart: 1,
          totalParts: 1,
          status: `Extracting frames from ${files.length} video(s)...`,
          completed: false,
        });

        try {
          await invoke('start_extract_frames_pipeline', {
            config: {
              video_files: files.map((f) => f.path),
              output_format: videoConfig.frameOutputFormat,
              frame_rate: videoConfig.frameRate,
              quality:
                videoConfig.frameOutputFormat !== 'PNG' ? videoConfig.frameQuality : null,
              custom_output_dir: videoConfig.outputDir || null,
            },
          });

          setProgress((prev) => ({
            ...prev,
            isProcessing: false,
            percent: 100,
            completed: true,
            status: 'Frame extraction completed successfully! Check the _frames/ subfolders.',
          }));
        } catch (err: any) {
          setProgress((prev) => ({
            ...prev,
            isProcessing: false,
            error: err.toString(),
          }));
        }
      };

      if (estimatedFramesCount > 10000) {
        setPendingFrameExtract(() => executeFrameExtraction);
        setLargeFrameWarningOpen(true);
        return;
      }

      await executeFrameExtraction();
      return;
    }

    // Branch 3: STANDARD TRANSCODE & SPLIT
    setProgress({
      isProcessing: true,
      currentFile: files[0].name,
      fileIndex: 1,
      totalFiles: files.length,
      percent: 0,
      currentPart: 1,
      totalParts: 1,
      status: 'Starting FFmpeg transcode pipeline...',
      completed: false,
    });

    const effectiveSplitValue =
      typeof videoConfig.splitValue === 'number' &&
      !isNaN(videoConfig.splitValue) &&
      videoConfig.splitValue > 0
        ? videoConfig.splitValue
        : videoConfig.splitMode === 'PARTS'
        ? 2
        : 60;

    try {
      await invoke('start_video_pipeline', {
        config: {
          video_files: files.map((f) => f.path),
          video_items: files.map((f) => ({
            path: f.path,
            trim_start_sec: f.trimStartSec ?? null,
            trim_end_sec: f.trimEndSec ?? null,
          })),
          video_action: videoConfig.videoAction,
          split_mode: videoConfig.splitMode,
          split_value: effectiveSplitValue,
          split_fast_copy: videoConfig.splitFastCopy,
          target_height: videoConfig.targetHeight || 'ORIGINAL',
          target_bitrate: videoConfig.targetBitrate || 'ORIGINAL',
          codec_choice: videoConfig.codecChoice,
          custom_output_dir: videoConfig.outputDir || null,
        },
      });

      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        percent: 100,
        completed: true,
        status: 'All video files processed successfully!',
      }));
    } catch (err: any) {
      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.toString(),
      }));
    }
  }, [
    files,
    videoConfig,
    currentMediaType,
    streamCompatibility,
    estimatedFramesCount,
    verifyFileAvailability,
    checkDepsAndGpu,
    setValidationError,
    setProgress,
    setStorageModalState,
  ]);

  const handleStartImageProcessing = useCallback(async () => {
    if (files.length === 0) return;

    const isAllAvailable = await verifyFileAvailability();
    if (!isAllAvailable) {
      setValidationError(
        'One or more files in the queue are missing or no longer accessible on disk. Please remove missing files before starting.'
      );
      return;
    }

    const currentDeps = await checkDepsAndGpu(videoConfig.codecChoice);
    const requiresMagick = imageConfig.outputFormat !== 'VIDEO';
    const requiresFFmpeg = imageConfig.outputFormat === 'VIDEO';

    if (requiresMagick && !currentDeps.magick) {
      setValidationError(
        'ImageMagick binary (magick.exe) is missing or was removed. Please click "Install All Dependencies" to download.'
      );
      return;
    }
    if (requiresFFmpeg && (!currentDeps.ffmpeg || !currentDeps.ffprobe)) {
      setValidationError(
        'FFmpeg / FFprobe dependencies are missing or were removed. Please click "Install All Dependencies" to download.'
      );
      return;
    }

    const isSingleOutput =
      imageConfig.outputFormat === 'VIDEO' ||
      (imageConfig.outputFormat === 'PDF' && imageConfig.mergePdf && files.length > 1);

    setProgress({
      isProcessing: true,
      isSingleOutput,
      currentFile: files[0].name,
      fileIndex: 1,
      totalFiles: files.length,
      percent: 0,
      currentPart: 1,
      totalParts: 1,
      status:
        imageConfig.outputFormat === 'VIDEO'
          ? 'Converting Image(s) to MP4 Video...'
          : imageConfig.outputFormat === 'PDF' && imageConfig.mergePdf
          ? 'Combining Image(s) into PDF document...'
          : 'Processing image conversion pipeline...',
      completed: false,
    });

    try {
      if (imageConfig.outputFormat === 'VIDEO') {
        await invoke('start_image_to_video_pipeline', {
          config: {
            input_files: files.map((f) => f.path),
            mode: imageConfig.videoMode,
            duration_sec: imageConfig.videoDurationSec,
            fps: imageConfig.videoFps,
            resolution: imageConfig.videoResolution,
            audio_path: imageConfig.audioPath || null,
            codec_choice: videoConfig.codecChoice,
            output_dir: imageConfig.outputDir || null,
          },
        });
      } else {
        await invoke('start_image_pipeline', {
          config: {
            input_files: files.map((f) => f.path),
            output_format: imageConfig.outputFormat,
            jpg_quality: imageConfig.jpgQuality,
            jpg_scale_percent: imageConfig.jpgScalePercent,
            jpg_height: imageConfig.jpgHeight,
            web_quality: imageConfig.webQuality,
            web_scale_percent: imageConfig.webScalePercent,
            web_height: imageConfig.webHeight,
            pdf_quality: imageConfig.pdfQuality,
            pdf_scale_percent: imageConfig.pdfScalePercent,
            pdf_height: imageConfig.pdfHeight,
            png_scale_percent: imageConfig.pngScalePercent,
            png_height: imageConfig.pngHeight,
            merge_pdf: imageConfig.mergePdf,
            custom_output_dir: imageConfig.outputDir || null,
          },
        });
      }

      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        percent: 100,
        completed: true,
        status: 'Image processing task completed successfully!',
      }));
    } catch (err: any) {
      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.toString(),
      }));
    }
  }, [
    files,
    imageConfig,
    videoConfig.codecChoice,
    verifyFileAvailability,
    checkDepsAndGpu,
    setValidationError,
    setProgress,
  ]);

  const handleAbortProcessing = useCallback(async () => {
    try {
      await invoke('abort_processing');
      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        completed: false,
        error: 'Processing aborted by user.',
      }));
    } catch (err: any) {
      console.error('Failed to abort processing:', err);
    }
  }, [setProgress]);

  return {
    largeFrameWarningOpen,
    setLargeFrameWarningOpen,
    pendingFrameExtract,
    setPendingFrameExtract,
    handleStartVideoProcessing,
    handleStartImageProcessing,
    handleAbortProcessing,
  };
}
