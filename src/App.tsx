import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Titlebar } from './components/Titlebar';
import { WelcomeDropzone } from './components/WelcomeDropzone';
import { Dropzone, FileItem } from './components/Dropzone';
import { ConfigPanel, ConfigState } from './components/ConfigPanel';
import { ProgressModal, ProgressState } from './components/ProgressModal';
import { AboutModal, UpdateInfo, UpdateProgressPayload } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';
import { ImageConfig } from './types/media';
import { getFileKind, validateSingleMediaBatch } from './utils/mediaType';
import { Download, AlertCircle, X } from 'lucide-react';

export function normalizePath(p: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function canonicalPathKey(p: string): string {
  return normalizePath(p).toLowerCase();
}

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('alitken_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('alitken_theme', next);
  };

  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-Update State Management
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressPayload | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [hardwareInfo, setHardwareInfo] = useState<{ name: string; encoder: string; details?: string }>({
    name: 'Detecting GPU...',
    encoder: '',
  });

  const [depsStatus, setDepsStatus] = useState<{ ffmpeg: boolean; ffprobe: boolean; magick: boolean }>({
    ffmpeg: true,
    ffprobe: true,
    magick: true,
  });
  const [isDownloadingDeps, setIsDownloadingDeps] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const pendingPathsRef = useRef(new Set<string>());

  const [videoConfig, setVideoConfig] = useState<ConfigState>({
    videoAction: 'CONVERT',
    splitMode: 'DURATION',
    splitValue: 60,
    splitFastCopy: false,
    targetHeight: 'ORIGINAL',
    targetBitrate: 'ORIGINAL',
    codecChoice: '1',
    outputDir: null,
  });

  const [imageConfig, setImageConfig] = useState<ImageConfig>({
    outputFormat: 'JPG',
    jpgQuality: 80,
    jpgScalePercent: null,
    jpgHeight: null,
    webQuality: 80,
    webScalePercent: null,
    webHeight: null,
    pdfQuality: 80,
    pdfScalePercent: null,
    pdfHeight: null,
    mergePdf: false,
    pngScalePercent: null,
    pngHeight: null,
    videoMode: 'SLIDESHOW',
    videoDurationSec: 5,
    videoFps: 30,
    videoResolution: '1080p',
    audioPath: null,
    outputDir: null,
  });

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

  const currentMediaType: 'video' | 'image' =
    files.length > 0 && getFileKind(files[0].path) === 'image' ? 'image' : 'video';

  const videoConfigRef = useRef(videoConfig);
  useEffect(() => {
    videoConfigRef.current = videoConfig;
  }, [videoConfig]);

  // Disable right-click context menu in production builds only.
  // This MUST be its own useEffect — if merged with the listener useEffect below,
  // the `return` inside `if (import.meta.env.PROD)` would cause an early exit
  // that skips all three listen() calls, breaking all progress telemetry in release builds.
  useEffect(() => {
    if (import.meta.env.PROD) {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Initial setup: Check dependencies, GPU acceleration, and register all IPC event listeners.
  useEffect(() => {
    checkDepsAndGpu('1');



    // Read command line startup arguments (e.g. from Windows "Send to" menu)
    invoke<string[]>('get_initial_files')
      .then((initialPaths) => {
        if (initialPaths && initialPaths.length > 0) {
          handleAddFiles(initialPaths);
        }
      })
      .catch((err) => console.error('Failed to get initial files:', err));

    // Register IPC event listeners for Rust backend telemetry.
    // These must be registered unconditionally — in both dev and production builds.
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
        status: payload.speed_mbps > 0
          ? `${payload.downloaded_mb.toFixed(1)} MB / ${
              payload.total_mb > 0 ? payload.total_mb.toFixed(1) + ' MB' : '?? MB'
            } (${payload.speed_mbps.toFixed(1)} MB/s)`
          : payload.status,
      }));
    });

    const unlistenUpdateProgress = listen('update-progress', (event: any) => {
      setUpdateProgress(event.payload as UpdateProgressPayload);
    });

    // Automatic background update check on app launch
    invoke<UpdateInfo>('check_app_update')
      .then((info) => setUpdateInfo(info))
      .catch((err) => console.error('Initial background update check failed:', err));

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenImageProgress.then((fn) => fn());
      unlistenDownload.then((fn) => fn());
      unlistenUpdateProgress.then((fn) => fn());
    };
  }, []);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      const info = await invoke<UpdateInfo>('check_app_update');
      setUpdateInfo(info);
    } catch (err: any) {
      console.error('Update check failed:', err);
      setUpdateError(typeof err === 'string' ? err : 'Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async (downloadUrl: string) => {
    if (!downloadUrl) return;
    setIsAboutOpen(false);
    handleDownloadDependencies('app', downloadUrl);
  };

  const checkDepsAndGpu = async (codec: string) => {
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
  };

  const handleConfigChange = (updated: Partial<ConfigState>) => {
    setVideoConfig((prev) => {
      const next = { ...prev, ...updated };
      if (updated.codecChoice && updated.codecChoice !== prev.codecChoice) {
        checkDepsAndGpu(updated.codecChoice);
      }
      return next;
    });
  };

  const handleAddFiles = async (paths: string[]) => {
    setValidationError(null);

    // Validate single media type rule
    const validation = validateSingleMediaBatch(paths, files);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Invalid file batch selection.');
      return;
    }

    const newPathsToProcess: string[] = [];
    for (const rawPath of paths) {
      const canonical = canonicalPathKey(rawPath);
      if (pendingPathsRef.current.has(canonical)) continue;
      if (files.some((f) => canonicalPathKey(f.path) === canonical)) continue;
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

    const newItems: FileItem[] = [];

    // Probe videos via ffprobe
    for (const p of videoPaths) {
      try {
        const meta: any = await invoke('probe_media_file', {
          ffprobePath: '',
          filePath: p,
        });
        newItems.push({
          name: meta.file_name,
          path: normalizePath(meta.file_path || p),
          sizeMb: meta.file_size_mb,
          durationSec: meta.duration_sec,
          resolution: meta.height > 0 ? `${meta.width}x${meta.height}` : undefined,
          codec: meta.codec_name,
          mediaKind: 'video',
        });
      } catch (err) {
        const name = p.split(/[\\/]/).pop() || p;
        newItems.push({ name, path: p, sizeMb: 0, mediaKind: 'video' });
      }
    }

    // Probe image batch instantly via native Rust stat (< 5ms for 3,000 files)
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
      // Expand from the fixed startup window (560×440) to the full working
      // window (980×700) exactly once — when the very first file is added.
      if (prev.length === 0 && filteredNew.length > 0) {
        invoke('expand_to_working_window').catch((err) =>
          console.error('Failed to expand to working window:', err)
        );
      }
      return [...prev, ...filteredNew];
    });
  };

  const handleDownloadDependencies = async (
    mode: 'all' | 'ffmpeg' | 'magick' | 'app' = 'all',
    downloadUrl?: string
  ) => {
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
        downloadUrl: downloadUrl || updateInfo?.download_url || null,
      });
      await checkDepsAndGpu(videoConfig.codecChoice);
      setProgress((prev) => ({
        ...prev,
        type: 'download',
        isProcessing: false,
        completed: true,
        percent: 100, // Guarantee the bar fills to 100% on completion
        status: mode === 'app' ? 'App Update Installed Successfully! Restarting...' : 'Portable binaries installed successfully!',
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
  };

  const handleStartVideoProcessing = async () => {
    if (files.length === 0) return;

    // Pre-flight check: Ensure binaries exist before launching
    const currentDeps = await checkDepsAndGpu(videoConfig.codecChoice);
    if (!currentDeps.ffmpeg || !currentDeps.ffprobe) {
      setValidationError('FFmpeg / FFprobe dependencies are missing or were removed. Please click "Install All Dependencies" to download.');
      return;
    }

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
  };

  const handleStartImageProcessing = async () => {
    if (files.length === 0) return;

    // Pre-flight check: Ensure binaries exist before launching
    const currentDeps = await checkDepsAndGpu(videoConfig.codecChoice);
    const requiresMagick = imageConfig.outputFormat !== 'VIDEO';
    const requiresFFmpeg = imageConfig.outputFormat === 'VIDEO';

    if (requiresMagick && !currentDeps.magick) {
      setValidationError('ImageMagick binary (magick.exe) is missing or was removed. Please click "Install All Dependencies" to download.');
      return;
    }
    if (requiresFFmpeg && (!currentDeps.ffmpeg || !currentDeps.ffprobe)) {
      setValidationError('FFmpeg / FFprobe dependencies are missing or were removed. Please click "Install All Dependencies" to download.');
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
  };

  const handleAbortProcessing = async () => {
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
  };

  const handleClearFiles = () => {
    pendingPathsRef.current.clear();
    setFiles([]);
    // Collapse back to the fixed startup window (560×440, non-resizable)
    // whenever the queue is emptied via the "Clear All" button.
    invoke('collapse_to_startup_window').catch((err) =>
      console.error('Failed to collapse to startup window:', err)
    );
  };

  const handleOpenDestination = async () => {
    let targetDir = currentMediaType === 'video' ? videoConfig.outputDir : imageConfig.outputDir;
    if (!targetDir && files.length > 0) {
      const firstPath = files[0].path;
      const lastSlash = Math.max(firstPath.lastIndexOf('/'), firstPath.lastIndexOf('\\'));
      if (lastSlash !== -1) {
        targetDir = firstPath.substring(0, lastSlash);
      }
    }
    if (targetDir) {
      try {
        await invoke('open_folder', { folderPath: targetDir });
      } catch (err) {
        console.error('Failed to open destination folder:', err);
      }
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-app)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        color: 'var(--text-main)',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Custom Titlebar */}
      <Titlebar
        hardwareName={hardwareInfo.name}
        encoderName={hardwareInfo.encoder}
        hardwareDetails={hardwareInfo.details}
        hasUpdate={!!updateInfo?.available}
        latestVersion={updateInfo?.latest_version}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenSettings={() => {
          checkDepsAndGpu(videoConfig.codecChoice);
          setIsSettingsOpen(true);
        }}
      />

      {/* Validation Error Banner (Single Media Rule Violation) */}
      {validationError && (
        <div
          style={{
            background:
              theme === 'light'
                ? 'rgba(254, 226, 226, 0.95)'
                : 'rgba(239, 68, 68, 0.25)',
            borderBottom:
              theme === 'light'
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.4)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            fontWeight: 600,
            color: theme === 'light' ? '#991b1b' : '#fca5a5',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color={theme === 'light' ? '#b91c1c' : '#fca5a5'} />
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme === 'light' ? '#991b1b' : '#fca5a5',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sleek Floating Frosted Glass Dependency Warning Banner */}
      {(!depsStatus.ffmpeg || !depsStatus.ffprobe || !depsStatus.magick) && (
        <div
          style={{
            margin: '8px 12px 0 12px',
            padding: '7px 14px',
            borderRadius: '10px',
            background:
              theme === 'light'
                ? 'rgba(255, 241, 242, 0.92)'
                : 'rgba(244, 63, 94, 0.12)',
            border:
              theme === 'light'
                ? '1px solid rgba(244, 63, 94, 0.25)'
                : '1px solid rgba(244, 63, 94, 0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow:
              theme === 'light'
                ? '0 4px 12px rgba(244, 63, 94, 0.08)'
                : '0 4px 16px rgba(0, 0, 0, 0.2)',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              flex: 1,
            }}
          >
            <AlertCircle
              size={15}
              color={theme === 'light' ? '#be123c' : '#fb7185'}
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: theme === 'light' ? '#9f1239' : '#fda4af',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {!depsStatus.ffmpeg && !depsStatus.magick
                ? 'Media dependencies missing (FFmpeg & ImageMagick)'
                : !depsStatus.ffmpeg || !depsStatus.ffprobe
                ? 'FFmpeg portable binaries missing'
                : 'ImageMagick binary (magick.exe) missing'}
            </span>
          </div>

          <button
            onClick={() =>
              handleDownloadDependencies(
                !depsStatus.ffmpeg && !depsStatus.magick
                  ? 'all'
                  : !depsStatus.ffmpeg || !depsStatus.ffprobe
                  ? 'ffmpeg'
                  : 'magick'
              )
            }
            disabled={isDownloadingDeps}
            style={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isDownloadingDeps ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(244, 63, 94, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <Download size={12} />
            {!depsStatus.ffmpeg && !depsStatus.magick
              ? 'Auto-Download All'
              : !depsStatus.ffmpeg || !depsStatus.ffprobe
              ? 'Auto-Download FFmpeg'
              : 'Auto-Download ImageMagick'}
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      {files.length === 0 ? (
        /* STATE A: Full-Page Welcome Landing Dropzone */
        <WelcomeDropzone onAddFiles={handleAddFiles} />
      ) : (
        /* STATE B & C: Active Workspace Split View */
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: '16px',
            padding: '16px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <Dropzone
            files={files}
            onAddFiles={handleAddFiles}
            onRemoveFile={(idx) => {
              const fileToRemove = files[idx];
              if (fileToRemove) {
                pendingPathsRef.current.delete(canonicalPathKey(fileToRemove.path));
              }
              setFiles((prev) => {
                const next = prev.filter((_, i) => i !== idx);
                // Collapse back to startup window when the last file is removed.
                if (next.length === 0) {
                  invoke('collapse_to_startup_window').catch((err) =>
                    console.error('Failed to collapse to startup window:', err)
                  );
                }
                return next;
              });
            }}
            onClearFiles={handleClearFiles}
            onReorderFiles={(sortedFiles) => setFiles(sortedFiles)}
          />

          <ConfigPanel
            mediaType={currentMediaType}
            config={videoConfig}
            onChange={handleConfigChange}
            onStart={handleStartVideoProcessing}
            imageConfig={imageConfig}
            onImageConfigChange={setImageConfig}
            onStartImage={handleStartImageProcessing}
            disabled={files.length === 0 || progress.isProcessing}
            fileCount={files.length}
            onOpenDestination={handleOpenDestination}
          />
        </div>
      )}

      {/* Real-time Telemetry Modal */}
      <ProgressModal
        progress={progress}
        onClose={() => setProgress((prev) => ({ ...prev, completed: false, error: undefined }))}
        onOpenDestination={handleOpenDestination}
        onAbort={handleAbortProcessing}
      />

      {/* About ALITKEN v0.4 Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        hardwareInfo={hardwareInfo}
        updateInfo={updateInfo}
        onCheckUpdate={handleCheckUpdate}
        onInstallUpdate={handleInstallUpdate}
        isCheckingUpdate={isCheckingUpdate}
        updateProgress={updateProgress}
        updateError={updateError}
      />

      {/* Settings & System Integrations Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onUpdateEngine={(engine) => {
          setIsSettingsOpen(false);
          handleDownloadDependencies(engine);
        }}
      />
    </div>
  );
}
