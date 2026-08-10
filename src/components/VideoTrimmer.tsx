import React from 'react';
import { FileItem } from './Dropzone';
import { ConfigPanel, ConfigState } from './ConfigPanel';
import { ImageConfig, TrimConfig } from '../types/media';
import { TimelineSlider } from './TimelineSlider';
import { TrimmerHeader } from './trimmer/TrimmerHeader';
import { VideoPlayerViewport } from './trimmer/VideoPlayerViewport';
import { TrimmerPlaybackControls } from './trimmer/TrimmerPlaybackControls';
import { TrimmerStatusBar } from './trimmer/TrimmerStatusBar';
import { useTrimmerState } from './trimmer/useTrimmerState';

// Re-export pure utility functions for backward compatibility
export { parseTimeToSeconds, parseAndClampSpeed } from '../utils/trimmerUtils';

export interface VideoTrimmerProps {
  file: FileItem;
  onBack: (updatedFile: FileItem) => void;
  onStartTrim: (trimConfig: TrimConfig) => void;
  videoConfig: ConfigState;
  onVideoConfigChange: (updated: Partial<ConfigState>) => void;
  imageConfig: ImageConfig;
  onImageConfigChange: (updated: ImageConfig) => void;
  disabled: boolean;
  isDragOver?: boolean;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  file,
  onBack,
  onStartTrim,
  videoConfig,
  onVideoConfigChange,
  imageConfig,
  onImageConfigChange,
  disabled,
  isDragOver = false,
}) => {
  const trimmer = useTrimmerState({
    file,
    videoConfig,
    onBack,
    onStartTrim,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        gap: '12px',
      }}
    >
      {/* Top Header Bar */}
      <TrimmerHeader file={file} onSaveAndBack={trimmer.handleSaveAndBack} />

      {/* Main Content Layout: Left Player + Right ConfigPanel */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: '12px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left Main Viewport (Player & Timeline) */}
        <div
          className="glass-panel"
          style={{
            flex: 1,
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
            overflowY: 'hidden',
          }}
        >
          {/* HTML5 Video Player Container / Fallback Viewport */}
          <VideoPlayerViewport
            videoRef={trimmer.videoRef}
            activeMediaSrc={trimmer.activeMediaSrc}
            isLoadingPreview={trimmer.isLoadingPreview}
            isNativeSupported={trimmer.isNativeSupported}
            fallbackFrameSrc={trimmer.fallbackFrameSrc}
            onLoadedMetadata={trimmer.handleLoadedMetadata}
            onTimeUpdate={trimmer.handleTimeUpdate}
            onError={trimmer.handleVideoError}
            onPlay={() => trimmer.setIsPlaying(true)}
            onPause={() => trimmer.setIsPlaying(false)}
            onEnded={() => trimmer.setIsPlaying(false)}
            onVideoClick={trimmer.togglePlayPause}
            isDragOver={isDragOver}
            aspectRatio={trimmer.aspectRatio}
            onSelectAspectRatio={trimmer.setAspectRatio}
            cropOffset={trimmer.cropOffset}
            onCropOffsetChange={trimmer.setCropOffset}
            isCropApplied={trimmer.isCropApplied}
            onApplyCrop={trimmer.applyCrop}
            onCancelCrop={trimmer.cancelCrop}
          />

          {/* Media Playback Controls Toolbar */}
          <TrimmerPlaybackControls
            isEditingCustomSpeed={trimmer.isEditingCustomSpeed}
            customSpeedInput={trimmer.customSpeedInput}
            setCustomSpeedInput={trimmer.setCustomSpeedInput}
            onCustomSpeedSubmit={trimmer.handleCustomSpeedSubmitAction}
            dynamicSpeedOptions={trimmer.dynamicSpeedOptions}
            speedSelectVal={trimmer.speedSelectVal}
            onSpeedSelectChange={trimmer.handleSpeedSelectValChange}
            onSetIn={trimmer.setInAtCurrent}
            onTogglePlayPause={trimmer.togglePlayPause}
            isNativeSupported={trimmer.isNativeSupported}
            isPlaying={trimmer.isPlaying}
            onSetOut={trimmer.setOutAtCurrent}
            isMuted={trimmer.isMuted}
            onToggleMute={() => trimmer.setIsMuted(!trimmer.isMuted)}
            playbackSpeed={trimmer.playbackSpeed}
            slowMoMode={trimmer.slowMoMode}
            onSlowMoModeChange={trimmer.setSlowMoMode}
          />

          {/* Dual-Handle Timeline Slider */}
          <TimelineSlider
            durationSec={trimmer.duration}
            startSec={trimmer.startSec}
            endSec={trimmer.endSec}
            currentSec={trimmer.currentSec}
            isDurationLocked={trimmer.isDurationLocked}
            onRangeChange={trimmer.handleRangeChange}
            onSeek={trimmer.handleSeek}
            filmstrip={trimmer.filmstrip}
            hoverThumbnailSrc={trimmer.hoverThumbnailSrc}
            onHoverTime={trimmer.handleHoverTime}
            onScrubStart={() => {
              if (trimmer.videoRef.current) trimmer.videoRef.current.muted = true;
            }}
            onScrubEnd={() => {
              if (trimmer.videoRef.current) trimmer.videoRef.current.muted = false;
            }}
          />

          {/* Precision Time Status Bar */}
          <TrimmerStatusBar
            inputStart={trimmer.inputStart}
            inputEnd={trimmer.inputEnd}
            inputDuration={trimmer.inputDuration}
            isDurationLocked={trimmer.isDurationLocked}
            setInputStart={trimmer.setInputStart}
            setInputEnd={trimmer.setInputEnd}
            setInputDuration={trimmer.setInputDuration}
            onStartBlur={trimmer.handleStartBlur}
            onEndBlur={trimmer.handleEndBlur}
            onDurationBlur={trimmer.handleDurationBlur}
            onToggleDurationLock={trimmer.toggleDurationLock}
            onResetMarkers={trimmer.resetMarkers}
          />
        </div>

        {/* Right Viewport (Collapsible Export ConfigPanel) */}
        <div
          style={{
            width: trimmer.isPanelCollapsed ? '44px' : '360px',
            minWidth: trimmer.isPanelCollapsed ? '44px' : '320px',
            maxWidth: trimmer.isPanelCollapsed ? '44px' : '400px',
            transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
            height: '100%',
            flexShrink: 0,
          }}
        >
          <ConfigPanel
            mediaType="video"
            config={videoConfig}
            onChange={onVideoConfigChange}
            onStart={trimmer.handleExport}
            imageConfig={imageConfig}
            onImageConfigChange={onImageConfigChange}
            onStartImage={() => {}}
            disabled={disabled}
            fileCount={1}
            isTrimmerMode={true}
            isCollapsed={trimmer.isPanelCollapsed}
            onToggleCollapse={() => trimmer.setIsPanelCollapsed(!trimmer.isPanelCollapsed)}
            onStartTrim={trimmer.handleExport}
            fastCopyTrim={trimmer.fastCopy}
            onFastCopyTrimChange={trimmer.setFastCopy}
          />
        </div>
      </div>
    </div>
  );
};
