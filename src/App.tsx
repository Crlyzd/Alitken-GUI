import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Titlebar } from './components/Titlebar';
import { WelcomeDropzone } from './components/WelcomeDropzone';
import { Dropzone } from './components/Dropzone';
import { ConfigPanel, ConfigState } from './components/ConfigPanel';
import { ProgressModal } from './components/ProgressModal';
import { AboutModal } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';
import { ImageConfig, StreamCompatibilityResult } from './types/media';
import { VideoTrimmer } from './components/VideoTrimmer';
import { StorageValidationModal } from './components/trimmer/StorageValidationModal';
import { FileLoadingOverlay } from './components/FileLoadingOverlay';
import { getFileKind } from './utils/mediaType';
import { openDestinationFolder } from './utils/folderUtils';

import { useAppTelemetry } from './hooks/useAppTelemetry';
import { useAppUpdates } from './hooks/useAppUpdates';
import { useMediaQueue } from './hooks/useMediaQueue';
import { useNativeDragDrop } from './hooks/useNativeDragDrop';
import { useMediaPipelines } from './hooks/useMediaPipelines';

import { ValidationErrorBanner } from './components/banners/ValidationErrorBanner';
import { DependencyBanner } from './components/banners/DependencyBanner';
import { LargeFrameWarningModal } from './components/modals/LargeFrameWarningModal';

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

  // Configuration States
  const [videoConfig, setVideoConfig] = useState<ConfigState>({
    videoAction: 'CONVERT',
    splitMode: 'DURATION',
    splitValue: 0,
    splitFastCopy: false,
    combineFastCopy: false,
    combineOutputName: 'combined_output',
    frameOutputFormat: 'PNG',
    frameRate: 'MAX',
    frameQuality: 85,
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

  const [streamCompatibility, setStreamCompatibility] = useState<StreamCompatibilityResult | null>(null);
  const [isCheckingCompatibility, setIsCheckingCompatibility] = useState(false);

  // Hook 1: Media Queue & Window Management
  const {
    files,
    setFiles,
    fileLoadingState,
    setFileLoadingState,
    activeView,
    trimmerFile,
    validationError,
    setValidationError,
    storageModalState,
    setStorageModalState,
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
  } = useMediaQueue((codec) => checkDepsAndGpu(codec), (val) => setProgress(val));

  // Hook 2: Telemetry, Hardware & Binary Dependencies
  const {
    hardwareInfo,
    depsStatus,
    isDownloadingDeps,
    progress,
    setProgress,
    checkDepsAndGpu,
    handleDownloadDependencies,
  } = useAppTelemetry(setFileLoadingState);

  // Hook 3: Background Updates & Installer
  const {
    updateInfo,
    isCheckingUpdate,
    updateProgress,
    updateError,
    handleCheckUpdate,
    handleInstallUpdate,
  } = useAppUpdates(setIsAboutOpen, handleDownloadDependencies);

  // Hook 4: Native Drag and Drop Zone Orchestration
  const { isDragOver, dragTargetZone, welcomeZoneRef } = useNativeDragDrop(
    activeViewRef,
    handleAddFiles,
    handleOpenTrimmerFromWelcome,
    setValidationError
  );

  const currentMediaType: 'video' | 'image' =
    files.length > 0 && getFileKind(files[0].path) === 'image' ? 'image' : 'video';

  // Estimated frames count across queue
  const estimatedFramesCount = useMemo(() => {
    if (currentMediaType !== 'video' || files.length === 0) return 0;
    const effectiveFps =
      videoConfig.frameRate === 'MAX' ? 30 : parseInt(videoConfig.frameRate, 10) || 30;
    return files.reduce((sum, f) => {
      const dur = f.durationSec || 0;
      return sum + Math.round(dur * effectiveFps);
    }, 0);
  }, [currentMediaType, files, videoConfig.frameRate]);

  // Hook 5: Media Pipelines Execution
  const {
    largeFrameWarningOpen,
    setLargeFrameWarningOpen,
    pendingFrameExtract,
    setPendingFrameExtract,
    handleStartVideoProcessing,
    handleStartImageProcessing,
    handleAbortProcessing,
  } = useMediaPipelines(
    files,
    videoConfig,
    imageConfig,
    currentMediaType,
    streamCompatibility,
    estimatedFramesCount,
    verifyFileAvailability,
    checkDepsAndGpu,
    setValidationError,
    setProgress,
    setStorageModalState
  );

  // Stream compatibility check for Combine mode (Lossless)
  useEffect(() => {
    if (
      currentMediaType === 'video' &&
      videoConfig.videoAction === 'COMBINE' &&
      videoConfig.combineFastCopy &&
      files.length >= 2
    ) {
      let cancelled = false;
      setIsCheckingCompatibility(true);
      const filePaths = files.map((f) => f.path);
      invoke<StreamCompatibilityResult>('check_stream_compatibility', { filePaths })
        .then((res) => {
          if (!cancelled) {
            setStreamCompatibility(res);
            setIsCheckingCompatibility(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to check stream compatibility:', err);
            setStreamCompatibility({
              is_compatible: false,
              reason: `Stream compatibility error: ${err}`,
            });
            setIsCheckingCompatibility(false);
          }
        });

      return () => {
        cancelled = true;
      };
    } else {
      setStreamCompatibility(null);
      setIsCheckingCompatibility(false);
    }
  }, [currentMediaType, videoConfig.videoAction, videoConfig.combineFastCopy, files]);

  // Disable right-click context menu in production builds only.
  useEffect(() => {
    if (import.meta.env.PROD) {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  // Read command line startup arguments
  useEffect(() => {
    invoke<string[]>('get_initial_files')
      .then((initialPaths) => {
        if (initialPaths && initialPaths.length > 0) {
          handleAddFiles(initialPaths);
        }
      })
      .catch((err) => console.error('Failed to get initial files:', err));
  }, [handleAddFiles]);

  const handleConfigChange = (updated: Partial<ConfigState>) => {
    setVideoConfig((prev) => {
      const next = { ...prev, ...updated };
      if (updated.codecChoice && updated.codecChoice !== prev.codecChoice) {
        checkDepsAndGpu(updated.codecChoice);
      }
      return next;
    });
  };

  const handleOpenDestination = useCallback(() => {
    const targetDir = currentMediaType === 'video' ? videoConfig.outputDir : imageConfig.outputDir;
    openDestinationFolder(targetDir, files);
  }, [currentMediaType, videoConfig.outputDir, imageConfig.outputDir, files]);

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

      {/* Visual File Loading / Probing Overlay Banner */}
      <FileLoadingOverlay loadingState={fileLoadingState} hasExistingFiles={files.length > 0} />

      {/* Validation Error Banner (Single Media Rule Violation) */}
      {validationError && (
        <ValidationErrorBanner
          validationError={validationError}
          theme={theme}
          onDismiss={() => setValidationError(null)}
        />
      )}

      {/* Sleek Floating Frosted Glass Dependency Warning Banner */}
      <DependencyBanner
        depsStatus={depsStatus}
        theme={theme}
        isDownloadingDeps={isDownloadingDeps}
        onDownload={handleDownloadDependencies}
      />

      {/* Main Workspace Area */}
      {activeView === 'trimmer' && trimmerFile ? (
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
          }}
        >
          <VideoTrimmer
            file={trimmerFile}
            onBack={handleBackFromTrimmer}
            onStartTrim={handleStartTrim}
            videoConfig={videoConfig}
            onVideoConfigChange={handleConfigChange}
            imageConfig={imageConfig}
            onImageConfigChange={setImageConfig}
            disabled={progress.isProcessing}
            isDragOver={isDragOver}
          />
        </div>
      ) : files.length === 0 ? (
        <WelcomeDropzone
          onAddFiles={handleAddFiles}
          onOpenTrimmerFile={handleOpenTrimmerFromWelcome}
          isDragOver={isDragOver}
          dragTargetZone={dragTargetZone}
          onZoneChange={(zone) => {
            welcomeZoneRef.current = zone;
          }}
        />
      ) : (
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
            isDragOver={isDragOver}
            onRemoveFile={handleRemoveFile}
            onClearFiles={handleClearFiles}
            onReorderFiles={(sortedFiles) => setFiles(sortedFiles)}
            onOpenTrimmer={handleOpenTrimmer}
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
            streamCompatibility={streamCompatibility}
            isCheckingCompatibility={isCheckingCompatibility}
            estimatedFramesCount={estimatedFramesCount}
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

      {/* About Modal */}
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

      {/* Settings Modal */}
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

      {/* Storage Validation Safety Modal */}
      <StorageValidationModal
        isOpen={storageModalState.isOpen}
        status={storageModalState.status}
        freeBytes={storageModalState.freeBytes}
        requiredBytes={storageModalState.requiredBytes}
        fileSizeBytes={storageModalState.fileSizeBytes}
        theme={theme}
        onProceed={() => {
          if (storageModalState.pendingFile) {
            performOpenTrimmer(storageModalState.pendingFile);
          }
          setStorageModalState((prev) => ({ ...prev, isOpen: false, pendingFile: null }));
        }}
        onCancel={() => {
          setStorageModalState((prev) => ({ ...prev, isOpen: false, pendingFile: null }));
        }}
      />

      {/* Large Frame Extraction Confirmation Modal */}
      <LargeFrameWarningModal
        isOpen={largeFrameWarningOpen}
        estimatedFramesCount={estimatedFramesCount}
        fileCount={files.length}
        onConfirm={() => {
          setLargeFrameWarningOpen(false);
          if (pendingFrameExtract) {
            pendingFrameExtract();
            setPendingFrameExtract(null);
          }
        }}
        onCancel={() => {
          setLargeFrameWarningOpen(false);
          setPendingFrameExtract(null);
        }}
      />
    </div>
  );
}
