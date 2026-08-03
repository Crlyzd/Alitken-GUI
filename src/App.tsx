import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Titlebar } from './components/Titlebar';
import { WelcomeDropzone } from './components/WelcomeDropzone';
import { Dropzone, FileItem } from './components/Dropzone';
import { ConfigPanel, ConfigState } from './components/ConfigPanel';
import { ProgressModal, ProgressState } from './components/ProgressModal';
import { AboutModal } from './components/AboutModal';
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
  const [validationError, setValidationError] = useState<string | null>(null);

  const [hardwareInfo, setHardwareInfo] = useState<{ name: string; encoder: string }>({
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

  // Initial setup: Check dependencies and GPU acceleration
  useEffect(() => {
    checkDepsAndGpu('1');

    const unlistenProgress = listen('ffmpeg-progress', (event: any) => {
      const payload = event.payload;
      setProgress((prev) => ({
        ...prev,
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
        isProcessing: true,
        currentFile: 'Downloading Portable Dependencies...',
        fileIndex: 1,
        totalFiles: 1,
        percent: payload.percent,
        currentPart: 1,
        totalParts: 1,
        status: payload.status,
      }));
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenImageProgress.then((fn) => fn());
      unlistenDownload.then((fn) => fn());
    };
  }, []);

  const checkDepsAndGpu = async (codec: string) => {
    try {
      const deps: any = await invoke('check_app_dependencies');
      setDepsStatus({
        ffmpeg: deps.ffmpeg_exists,
        ffprobe: deps.ffprobe_exists,
        magick: deps.magick_exists,
      });

      if (deps.ffmpeg_exists) {
        const gpu: any = await invoke('detect_gpu_hardware', {
          codecChoice: codec,
          ffmpegPath: deps.ffmpeg_path,
        });
        setHardwareInfo({ name: gpu.hardware_name, encoder: gpu.encoder });
      }
    } catch (err) {
      console.error('Failed to check dependencies or GPU:', err);
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

    const newItems: FileItem[] = [];
    for (const p of newPathsToProcess) {
      const kind = getFileKind(p);
      if (kind === 'video') {
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
      } else {
        const name = p.split(/[\\/]/).pop() || p;
        newItems.push({ name, path: p, sizeMb: 0, mediaKind: 'image' });
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

  const handleDownloadDependencies = async () => {
    setIsDownloadingDeps(true);
    setProgress({
      isProcessing: true,
      currentFile: 'Fetching Portable Dependencies...',
      fileIndex: 1,
      totalFiles: 1,
      percent: 0,
      currentPart: 1,
      totalParts: 1,
      status: 'Connecting...',
      completed: false,
    });

    try {
      await invoke('install_dependencies');
      await checkDepsAndGpu(videoConfig.codecChoice);
      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        completed: true,
        status: 'Portable binaries installed successfully!',
      }));
    } catch (err: any) {
      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.toString(),
      }));
    } finally {
      setIsDownloadingDeps(false);
    }
  };

  const handleStartVideoProcessing = async () => {
    if (files.length === 0) return;

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

    setProgress({
      isProcessing: true,
      currentFile: files[0].name,
      fileIndex: 1,
      totalFiles: files.length,
      percent: 0,
      currentPart: 1,
      totalParts: 1,
      status:
        imageConfig.outputFormat === 'VIDEO'
          ? 'Converting Image(s) to MP4 Video...'
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
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      {/* Validation Error Banner (Single Media Rule Violation) */}
      {validationError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#fca5a5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Dependency Warning Bar if FFmpeg is missing */}
      {(!depsStatus.ffmpeg || !depsStatus.ffprobe) && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            borderBottom: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#fb7185',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>Portable FFmpeg dependencies are missing in your local bin/ folder.</span>
          </div>
          <button
            onClick={handleDownloadDependencies}
            disabled={isDownloadingDeps}
            style={{
              background: '#f43f5e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={13} /> Auto-Download FFmpeg
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
              setFiles((prev) => prev.filter((_, i) => i !== idx));
            }}
            onClearFiles={() => {
              pendingPathsRef.current.clear();
              setFiles([]);
            }}
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
          />
        </div>
      )}

      {/* Real-time Telemetry Modal */}
      <ProgressModal
        progress={progress}
        onClose={() => setProgress((prev) => ({ ...prev, completed: false, error: undefined }))}
      />

      {/* About ALITKEN v0.4 Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        hardwareInfo={hardwareInfo}
      />
    </div>
  );
}
