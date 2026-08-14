import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../components/Dropzone';
import { FileLoadingState } from '../components/FileLoadingOverlay';
import { TrimConfig, TrimPreset } from '../types/media';
import { getFileKind, validateSingleMediaBatch } from '../utils/mediaType';
import { normalizePath, canonicalPathKey } from '../utils/pathUtils';
import { updateImportFolderFromFilePath } from '../utils/folderHistory';
import { ProgressState } from '../components/ProgressModal';

export interface StorageModalState {
  isOpen: boolean;
  status: 'HardFailure' | 'LowStorageWarning' | 'LargeFileWarning' | null;
  freeBytes: number;
  requiredBytes: number;
  fileSizeBytes: number;
  pendingFile: FileItem | null;
}

export function useMediaQueue(
  checkDepsAndGpu: (codec: string) => Promise<{ ffmpeg: boolean; ffprobe: boolean; magick: boolean }>,
  setProgress: React.Dispatch<React.SetStateAction<ProgressState>>
) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [fileLoadingState, setFileLoadingState] = useState<FileLoadingState>({
    isLoading: false,
    loaded: 0,
    total: 0,
    currentFile: '',
  });
  const [activeView, setActiveView] = useState<'main' | 'trimmer'>('main');
  const [trimmerFile, setTrimmerFile] = useState<FileItem | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [storageModalState, setStorageModalState] = useState<StorageModalState>({
    isOpen: false,
    status: null,
    freeBytes: 0,
    requiredBytes: 0,
    fileSizeBytes: 0,
    pendingFile: null,
  });

  const pendingPathsRef = useRef(new Set<string>());
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const verifyFileAvailability = useCallback(async (targetFiles?: FileItem[]): Promise<boolean> => {
    const currentQueue = targetFiles || filesRef.current;
    if (currentQueue.length === 0) return true;

    try {
      const missingPaths = await invoke<string[]>('check_missing_files', {
        filePaths: currentQueue.map((f) => f.path),
      });

      const missingSet = new Set(missingPaths.map((p) => canonicalPathKey(p)));
      const hasAnyMissingNow = missingSet.size > 0;
      const stateHasMissing = currentQueue.some((f) => f.isMissing);

      if (!hasAnyMissingNow && !stateHasMissing) {
        return true;
      }

      setFiles((prev) => {
        let changed = false;
        const updated = prev.map((f) => {
          const isMissing = missingSet.has(canonicalPathKey(f.path));
          if (f.isMissing !== isMissing) {
            changed = true;
            return { ...f, isMissing };
          }
          return f;
        });
        return changed ? updated : prev;
      });

      return !hasAnyMissingNow;
    } catch (err) {
      console.error('Failed to verify file availability:', err);
      return true;
    }
  }, []);

  // Re-check queue file availability when app window regains focus
  useEffect(() => {
    let timer: number | null = null;
    const handleFocus = () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        verifyFileAvailability();
      }, 300);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [verifyFileAvailability]);

  const handleAddFiles = useCallback(async (paths: string[]) => {
    setValidationError(null);

    const validation = validateSingleMediaBatch(paths, filesRef.current);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Invalid file batch selection.');
      return;
    }

    if (paths.length > 0) {
      updateImportFolderFromFilePath(paths[0]);
    }

    const newPathsToProcess: string[] = [];
    for (const rawPath of paths) {
      const canonical = canonicalPathKey(rawPath);
      if (pendingPathsRef.current.has(canonical)) continue;
      if (filesRef.current.some((f) => canonicalPathKey(f.path) === canonical)) continue;
      pendingPathsRef.current.add(canonical);
      newPathsToProcess.push(rawPath);
    }

    if (newPathsToProcess.length === 0) return;

    const videoPaths: string[] = [];
    const imagePaths: string[] = [];
    for (const p of newPathsToProcess) {
      if (getFileKind(p) === 'video') {
        videoPaths.push(p);
      } else {
        imagePaths.push(p);
      }
    }

    const totalCount = videoPaths.length + imagePaths.length;
    const initialName = newPathsToProcess[0].split(/[\\/]/).pop() || newPathsToProcess[0];

    setFileLoadingState({
      isLoading: true,
      loaded: 0,
      total: totalCount,
      currentFile: initialName,
    });

    try {
      const newItems: FileItem[] = [];

      if (videoPaths.length > 0) {
        try {
          const batchMeta: any[] = await invoke('probe_video_batch', {
            ffprobePath: '',
            filePaths: videoPaths,
          });

          for (let i = 0; i < videoPaths.length; i++) {
            const p = videoPaths[i];
            const meta = batchMeta[i];
            if (meta) {
              let trimPreset: TrimPreset | null = null;
              try {
                trimPreset = await invoke<TrimPreset | null>('load_trim_preset', { filePath: p });
              } catch {}

              newItems.push({
                name: meta.file_name,
                path: normalizePath(meta.file_path || p),
                sizeMb: meta.file_size_mb,
                durationSec: meta.duration_sec,
                resolution: meta.height > 0 ? `${meta.width}x${meta.height}` : undefined,
                codec: meta.codec_name,
                mediaKind: 'video',
                trimStartSec: trimPreset?.start_sec,
                trimEndSec: trimPreset?.end_sec,
                trimFastCopy: trimPreset?.fast_copy,
              });
            } else {
              const name = p.split(/[\\/]/).pop() || p;
              newItems.push({ name, path: p, sizeMb: 0, mediaKind: 'video' });
            }
          }
        } catch (err) {
          console.error('Failed batch video probe, falling back:', err);
          for (const p of videoPaths) {
            const name = p.split(/[\\/]/).pop() || p;
            newItems.push({ name, path: p, sizeMb: 0, mediaKind: 'video' });
          }
        }
      }

      if (imagePaths.length > 0) {
        try {
          const batchMeta: any[] = await invoke('probe_image_batch', { filePaths: imagePaths });
          for (const meta of batchMeta) {
            newItems.push({
              name: meta.file_name,
              path: normalizePath(meta.file_path),
              sizeMb: meta.file_size_mb,
              mediaKind: 'image',
              resolution: meta.width > 0 && meta.height > 0 ? `${meta.width}x${meta.height}` : undefined,
            });
          }
        } catch (err) {
          for (const p of imagePaths) {
            const name = p.split(/[\\/]/).pop() || p;
            newItems.push({ name, path: p, sizeMb: 0, mediaKind: 'image' });
          }
        }
      }

      setFiles((prev) => {
        const currentKeys = new Set(prev.map((f) => canonicalPathKey(f.path)));
        const filteredNew = newItems.filter((item) => !currentKeys.has(canonicalPathKey(item.path)));
        if (prev.length === 0 && filteredNew.length > 0) {
          invoke('expand_to_working_window').catch((err) =>
            console.error('Failed to expand to working window:', err)
          );
        }
        return [...prev, ...filteredNew];
      });
    } finally {
      setFileLoadingState({ isLoading: false, loaded: 0, total: 0, currentFile: '' });
    }
  }, []);

  const handleClearFiles = useCallback(() => {
    pendingPathsRef.current.clear();
    setFiles([]);
    invoke('collapse_to_startup_window').catch((err) =>
      console.error('Failed to collapse to startup window:', err)
    );
  }, []);

  const performOpenTrimmer = useCallback((file: FileItem) => {
    invoke('expand_to_working_window').catch((err) =>
      console.error('Failed to expand to working window:', err)
    );
    setTrimmerFile(file);
    setActiveView('trimmer');
  }, []);

  const handleOpenTrimmer = useCallback(
    async (file: FileItem) => {
      try {
        const sizeBytes = Math.round((file.sizeMb || 0) * 1024 * 1024);
        const res = await invoke<{
          status: 'HardFailure' | 'LowStorageWarning' | 'LargeFileWarning' | 'CleanPass';
          free_space_bytes: number;
          required_space_bytes: number;
        }>('validate_trimmer_storage', {
          filePath: file.path,
          fileSizeBytes: sizeBytes,
        });

        if (res.status === 'CleanPass') {
          performOpenTrimmer(file);
        } else {
          setStorageModalState({
            isOpen: true,
            status: res.status,
            freeBytes: res.free_space_bytes,
            requiredBytes: res.required_space_bytes,
            fileSizeBytes: sizeBytes,
            pendingFile: file,
          });
        }
      } catch (err) {
        console.error('Failed to validate trimmer storage:', err);
        performOpenTrimmer(file);
      }
    },
    [performOpenTrimmer]
  );

  const handleOpenTrimmerFromWelcome = useCallback(
    async (filePath: string) => {
      try {
        const meta: any = await invoke('probe_media_file', {
          ffprobePath: '',
          filePath,
        });

        let trimPreset: TrimPreset | null = null;
        try {
          trimPreset = await invoke<TrimPreset | null>('load_trim_preset', { filePath });
        } catch {}

        const newItem: FileItem = {
          name: meta.file_name,
          path: normalizePath(meta.file_path || filePath),
          sizeMb: meta.file_size_mb,
          durationSec: meta.duration_sec,
          resolution: meta.height > 0 ? `${meta.width}x${meta.height}` : undefined,
          codec: meta.codec_name,
          mediaKind: 'video',
          trimStartSec: trimPreset?.start_sec,
          trimEndSec: trimPreset?.end_sec,
          trimFastCopy: trimPreset?.fast_copy,
        };

        setFiles((prev) => {
          const canonical = canonicalPathKey(newItem.path);
          if (prev.some((f) => canonicalPathKey(f.path) === canonical)) {
            return prev.map((f) => (canonicalPathKey(f.path) === canonical ? newItem : f));
          }
          return [...prev, newItem];
        });

        handleOpenTrimmer(newItem);
      } catch (err) {
        console.error('Failed to open trimmer from welcome:', err);
      }
    },
    [handleOpenTrimmer]
  );

  const handleBackFromTrimmer = useCallback((updatedFile: FileItem) => {
    setFiles((prev) =>
      prev.map((f) => (canonicalPathKey(f.path) === canonicalPathKey(updatedFile.path) ? updatedFile : f))
    );

    invoke('save_trim_preset', {
      filePath: updatedFile.path,
      startSec: updatedFile.trimStartSec || 0,
      endSec: updatedFile.trimEndSec || (updatedFile.durationSec || 60),
      fastCopy: updatedFile.trimFastCopy ?? true,
    }).catch(console.error);

    setActiveView('main');
    setTrimmerFile(null);
  }, []);

  const handleStartTrim = useCallback(
    async (trimConfig: TrimConfig) => {
      invoke('save_trim_preset', {
        filePath: trimConfig.input_file,
        startSec: trimConfig.start_sec,
        endSec: trimConfig.end_sec,
        fast_copy: trimConfig.fast_copy,
      }).catch(console.error);

      const currentDeps = await checkDepsAndGpu(trimConfig.codec_choice);
      if (!currentDeps.ffmpeg || !currentDeps.ffprobe) {
        setValidationError(
          'FFmpeg / FFprobe dependencies are missing or were removed. Please click "Install All Dependencies" to download.'
        );
        return;
      }

      setProgress({
        type: 'conversion',
        isProcessing: true,
        currentFile: trimmerFile?.name || 'video_clip',
        fileIndex: 1,
        totalFiles: 1,
        percent: 0,
        currentPart: 1,
        totalParts: 1,
        status: trimConfig.fast_copy
          ? 'Exporting Lossless Copy...'
          : 'Re-encoding Trimmed Clip with Hardware Acceleration...',
        completed: false,
      });

      try {
        await invoke('start_trim_video_pipeline', {
          config: trimConfig,
        });

        setProgress((prev) => ({
          ...prev,
          isProcessing: false,
          percent: 100,
          completed: true,
          status: 'Video trim export completed successfully!',
        }));
      } catch (err: any) {
        setProgress((prev) => ({
          ...prev,
          isProcessing: false,
          error: err.toString(),
        }));
      }
    },
    [checkDepsAndGpu, setProgress, trimmerFile]
  );

  const handleRemoveFile = useCallback((idx: number) => {
    setFiles((prev) => {
      const fileToRemove = prev[idx];
      if (fileToRemove) {
        pendingPathsRef.current.delete(canonicalPathKey(fileToRemove.path));
      }
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        invoke('collapse_to_startup_window').catch((err) =>
          console.error('Failed to collapse to startup window:', err)
        );
      }
      return next;
    });
  }, []);

  return {
    files,
    setFiles,
    fileLoadingState,
    setFileLoadingState,
    activeView,
    setActiveView,
    trimmerFile,
    setTrimmerFile,
    validationError,
    setValidationError,
    storageModalState,
    setStorageModalState,
    pendingPathsRef,
    filesRef,
    activeViewRef,
    verifyFileAvailability,
    handleAddFiles,
    handleClearFiles,
    performOpenTrimmer,
    handleOpenTrimmer,
    handleOpenTrimmerFromWelcome,
    handleBackFromTrimmer,
    handleStartTrim,
    handleRemoveFile,
  };
}
