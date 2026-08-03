import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Titlebar } from './components/Titlebar';
import { Dropzone, FileItem } from './components/Dropzone';
import { ConfigPanel, ConfigState } from './components/ConfigPanel';
import { ProgressModal, ProgressState } from './components/ProgressModal';
import { AboutModal } from './components/AboutModal';
import { Download, AlertCircle } from 'lucide-react';

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

  const [hardwareInfo, setHardwareInfo] = useState<{ name: string; encoder: string }>({
    name: 'Detecting GPU...',
    encoder: '',
  });

  const [depsStatus, setDepsStatus] = useState<{ ffmpeg: boolean; ffprobe: boolean }>({
    ffmpeg: true,
    ffprobe: true,
  });
  const [isDownloadingDeps, setIsDownloadingDeps] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const pendingPathsRef = useRef(new Set<string>());

  const [config, setConfig] = useState<ConfigState>({
    videoAction: 'CONVERT',
    splitMode: 'DURATION',
    splitValue: 60,
    splitFastCopy: false,
    targetHeight: 'ORIGINAL',
    targetBitrate: 'ORIGINAL',
    codecChoice: '1',
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
      unlistenDownload.then((fn) => fn());
    };
  }, []);

  const checkDepsAndGpu = async (codec: string) => {
    try {
      const deps: any = await invoke('check_app_dependencies');
      setDepsStatus({ ffmpeg: deps.ffmpeg_exists, ffprobe: deps.ffprobe_exists });

      if (deps.ffmpeg_exists) {
        const gpu: any = await invoke('detect_gpu_hardware', {
          codecChoice: codec,
          ffmpegPath: deps.ffmpeg_path,
        });
        setHardwareInfo({ name: gpu.hardware_name, encoder: gpu.encoder });
      } else {
        setHardwareInfo({ name: 'Dependencies Required', encoder: '' });
      }
    } catch (err) {
      console.error('Failed to check hardware:', err);
    }
  };

  const handleConfigChange = (updated: Partial<ConfigState>) => {
    const next = { ...config, ...updated };
    setConfig(next);
    if (updated.codecChoice) {
      checkDepsAndGpu(updated.codecChoice);
    }
  };

  const handleAddFiles = async (paths: string[]) => {
    const existingKeys = new Set(files.map((f) => canonicalPathKey(f.path)));

    // Synchronously lock new paths in pendingPathsRef before any async IPC work
    const newPathsToProcess: string[] = [];
    for (const rawPath of Array.from(new Set(paths))) {
      if (!rawPath) continue;
      const normPath = normalizePath(rawPath);
      const key = canonicalPathKey(normPath);

      if (!existingKeys.has(key) && !pendingPathsRef.current.has(key)) {
        pendingPathsRef.current.add(key);
        newPathsToProcess.push(normPath);
      }
    }

    if (newPathsToProcess.length === 0) return;

    const newItems: FileItem[] = [];
    for (const p of newPathsToProcess) {
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
        });
      } catch (err) {
        // Fallback for file without metadata
        const name = p.split(/[\\/]/).pop() || p;
        newItems.push({ name, path: p, sizeMb: 0 });
      }
    }

    setFiles((prev) => {
      const currentKeys = new Set(prev.map((f) => canonicalPathKey(f.path)));
      const filteredNew = newItems.filter((item) => !currentKeys.has(canonicalPathKey(item.path)));
      return [...prev, ...filteredNew];
    });
  };

  const handleDownloadDependencies = async () => {
    setIsDownloadingDeps(true);
    setProgress({
      isProcessing: true,
      currentFile: 'Fetching Portable FFmpeg Build...',
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
      await checkDepsAndGpu(config.codecChoice);
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

  const handleStartProcessing = async () => {
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
      typeof config.splitValue === 'number' && !isNaN(config.splitValue) && config.splitValue > 0
        ? config.splitValue
        : config.splitMode === 'PARTS'
        ? 2
        : 60;

    try {
      await invoke('start_video_pipeline', {
        config: {
          video_files: files.map((f) => f.path),
          video_action: config.videoAction,
          split_mode: config.splitMode,
          split_value: effectiveSplitValue,
          split_fast_copy: config.splitFastCopy,
          target_height: config.targetHeight || 'ORIGINAL',
          target_bitrate: config.targetBitrate || 'ORIGINAL',
          codec_choice: config.codecChoice,
          custom_output_dir: config.outputDir || null,
        },
      });

      setProgress((prev) => ({
        ...prev,
        isProcessing: false,
        percent: 100,
        completed: true,
        status: 'All media files processed successfully!',
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

      {/* Main Grid Workspace */}
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
          config={config}
          onChange={handleConfigChange}
          onStart={handleStartProcessing}
          disabled={files.length === 0 || !depsStatus.ffmpeg || progress.isProcessing}
        />
      </div>

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
