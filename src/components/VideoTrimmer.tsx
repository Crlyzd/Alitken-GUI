import React, { useState, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Film,
  Clock,
  HardDrive,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  Gauge,
  Zap,
  ChevronsRight,
  ChevronsLeft,
  Check,
} from 'lucide-react';
import { FileItem } from './Dropzone';
import { ConfigPanel, ConfigState } from './ConfigPanel';
import { ImageConfig, TrimConfig } from '../types/media';
import { TimelineSlider, formatTimeWithMs } from './TimelineSlider';
import { GlassSelect, GlassSelectOption } from './GlassSelect';

const speedOptions: GlassSelectOption[] = [
  { value: '0.25', label: '0.25x' },
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1.0', label: '1.0x (Normal)' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '2.0', label: '2.0x' },
  { value: '5.0', label: '5.0x' },
  { value: 'CUSTOM', label: 'Custom...' },
];

const slowMoOptions: GlassSelectOption[] = [
  { value: 'FRAME_DUP', label: 'Standard (Fast)' },
  { value: 'OPTICAL_SMOOTH', label: 'AI Motion (Smooth)' },
];

interface VideoTrimmerProps {
  file: FileItem;
  onBack: (updatedFile: FileItem) => void;
  onStartTrim: (trimConfig: TrimConfig) => void;
  videoConfig: ConfigState;
  onVideoConfigChange: (updated: Partial<ConfigState>) => void;
  imageConfig: ImageConfig;
  onImageConfigChange: (updated: ImageConfig) => void;
  disabled: boolean;
}

export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length === 1) {
    const num = parseFloat(parts[0]);
    return isNaN(num) ? null : num;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    if (isNaN(hrs) || isNaN(mins) || isNaN(secs)) return null;
    return hrs * 3600 + mins * 60 + secs;
  }
  return null;
}

export function parseAndClampSpeed(raw: string): number {
  if (!raw || !raw.trim()) return 1.0;
  const clean = raw.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const val = parseFloat(clean);
  if (isNaN(val) || val <= 0) return 0.1;
  const clamped = Math.max(0.1, Math.min(50.0, val));
  return Math.round(clamped * 100) / 100;
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
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafSeekRef = useRef<number | null>(null);

  const [previewPath, setPreviewPath] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);
  const [fallbackFrameSrc, setFallbackFrameSrc] = useState<string | null>(null);
  const [isNativeSupported, setIsNativeSupported] = useState<boolean>(true);

  const [duration, setDuration] = useState<number>(file.durationSec || 60);
  const [currentSec, setCurrentSec] = useState<number>(file.trimStartSec || 0);
  const [startSec, setStartSec] = useState<number>(file.trimStartSec || 0);
  const [endSec, setEndSec] = useState<number>(() => {
    if (file.trimEndSec && file.trimEndSec > (file.trimStartSec || 0)) {
      return file.trimEndSec;
    }
    return file.durationSec || 60;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fastCopy, setFastCopy] = useState<boolean>(file.trimFastCopy ?? true);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // Speed & Audio State
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [speedSelectVal, setSpeedSelectVal] = useState<string>('1.0');
  const [isEditingCustomSpeed, setIsEditingCustomSpeed] = useState<boolean>(false);
  const [customSpeedInput, setCustomSpeedInput] = useState<string>('1.0');
  const [slowMoMode, setSlowMoMode] = useState<'FRAME_DUP' | 'OPTICAL_SMOOTH'>('FRAME_DUP');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [inputStart, setInputStart] = useState<string>(formatTimeWithMs(file.trimStartSec || 0));
  const [inputEnd, setInputEnd] = useState<string>(
    formatTimeWithMs(file.trimEndSec || file.durationSec || 60)
  );

  // Initialize preview stream / remux on mount or when file changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingPreview(true);
    setIsNativeSupported(true);
    setFallbackFrameSrc(null);

    invoke<string>('prepare_video_preview', { filePath: file.path })
      .then((resolvedPath) => {
        if (!isCancelled) {
          setPreviewPath(resolvedPath);
          setIsLoadingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Failed to prepare preview, falling back to original path:', err);
        if (!isCancelled) {
          setPreviewPath(file.path);
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isCancelled = true;
      if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
    };
  }, [file.path]);

  // Sync playbackRate and mute status to video element
  useEffect(() => {
    if (videoRef.current) {
      // Browsers support playbackRate up to 16.0
      videoRef.current.playbackRate = Math.min(16.0, playbackSpeed);
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Update text fields whenever startSec/endSec change
  useEffect(() => {
    setInputStart(formatTimeWithMs(startSec));
  }, [startSec]);

  useEffect(() => {
    setInputEnd(formatTimeWithMs(endSec));
  }, [endSec]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration > 0 && !isNaN(videoRef.current.duration)) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!file.trimEndSec || file.trimEndSec > dur) {
        setEndSec(dur);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentSec(t);
      // Auto pause if reached endSec while playing
      if (t >= endSec && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleVideoError = () => {
    setIsNativeSupported(false);
    invoke<string>('get_video_frame_preview', { filePath: file.path, timestampSec: currentSec })
      .then((frame) => setFallbackFrameSrc(frame))
      .catch(() => {});
  };

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current || !isNativeSupported) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime >= endSec) {
        videoRef.current.currentTime = startSec;
      }
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, startSec, endSec, isNativeSupported]);

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    setCurrentSec(clamped);

    if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
    rafSeekRef.current = requestAnimationFrame(() => {
      if (videoRef.current && isNativeSupported) {
        videoRef.current.currentTime = clamped;
      } else {
        invoke<string>('get_video_frame_preview', { filePath: file.path, timestampSec: clamped })
          .then((frame) => setFallbackFrameSrc(frame))
          .catch(() => {});
      }
    });
  };

  const nudgeTime = (delta: number) => {
    const target = Math.max(0, Math.min(duration, currentSec + delta));
    handleSeek(target);
  };

  const setInAtCurrent = () => {
    const newStart = Math.min(currentSec, endSec - 0.1);
    setStartSec(Math.max(0, newStart));
  };

  const setOutAtCurrent = () => {
    const newEnd = Math.max(currentSec, startSec + 0.1);
    setEndSec(Math.min(duration, newEnd));
  };

  const resetMarkers = () => {
    setStartSec(0);
    setEndSec(duration);
    handleSeek(0);
  };

  const handleRangeChange = (newStart: number, newEnd: number) => {
    setStartSec(newStart);
    setEndSec(newEnd);
  };

  const handleStartBlur = () => {
    const parsed = parseTimeToSeconds(inputStart);
    if (parsed !== null && parsed >= 0 && parsed < endSec) {
      setStartSec(parsed);
      handleSeek(parsed);
    } else {
      setInputStart(formatTimeWithMs(startSec));
    }
  };

  const handleEndBlur = () => {
    const parsed = parseTimeToSeconds(inputEnd);
    if (parsed !== null && parsed > startSec && parsed <= duration) {
      setEndSec(parsed);
      handleSeek(parsed);
    } else {
      setInputEnd(formatTimeWithMs(endSec));
    }
  };

  const handleSpeedSelectValChange = (val: string) => {
    if (val === 'CUSTOM') {
      setCustomSpeedInput(String(playbackSpeed));
      setIsEditingCustomSpeed(true);
    } else {
      setIsEditingCustomSpeed(false);
      setSpeedSelectVal(val);
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPlaybackSpeed(num);
      }
    }
  };

  const handleCustomSpeedSubmitAction = () => {
    const parsed = parseAndClampSpeed(customSpeedInput);
    setPlaybackSpeed(parsed);
    setSpeedSelectVal(String(parsed));
    setIsEditingCustomSpeed(false);
  };

  const dynamicSpeedOptions = React.useMemo(() => {
    const valStr = String(playbackSpeed);
    const exists = speedOptions.some((opt) => opt.value === valStr);
    if (!exists && valStr !== 'CUSTOM') {
      return [
        ...speedOptions.slice(0, speedOptions.length - 1),
        { value: valStr, label: `${valStr}x` },
        speedOptions[speedOptions.length - 1],
      ];
    }
    return speedOptions;
  }, [playbackSpeed]);

  // Keyboard shortcut listener (Space = play/pause, [ = set In, ] = set Out)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if active element is an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === '[') {
        e.preventDefault();
        setInAtCurrent();
      } else if (e.key === ']') {
        e.preventDefault();
        setOutAtCurrent();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        nudgeTime(e.shiftKey ? -5 : -1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        nudgeTime(e.shiftKey ? 5 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, currentSec, startSec, endSec, duration]);

  const handleSaveAndBack = () => {
    onBack({
      ...file,
      trimStartSec: startSec,
      trimEndSec: endSec,
      trimFastCopy: fastCopy,
    });
  };

  const handleExport = () => {
    const trimConfig: TrimConfig = {
      input_file: file.path,
      start_sec: startSec,
      end_sec: endSec,
      fast_copy: fastCopy,
      codec_choice: videoConfig.codecChoice,
      target_height: videoConfig.targetHeight,
      target_bitrate: videoConfig.targetBitrate,
      custom_output_dir: videoConfig.outputDir,
      playback_speed: playbackSpeed,
      mute_audio: isMuted,
      slow_mo_mode: slowMoMode,
    };
    onStartTrim(trimConfig);
  };

  const activeMediaSrc = previewPath ? convertFileSrc(previewPath) : convertFileSrc(file.path);

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
      <div
        className="glass-card"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderRadius: '14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            type="button"
            onClick={handleSaveAndBack}
            title="Return to File Queue (Saves Trim Markers)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              e.currentTarget.style.color = 'var(--accent-cyan)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-glass)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
          >
            <ArrowLeft size={14} /> Back to Queue
          </button>

          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={file.name}
            >
              {file.name}
            </h3>
          </div>
        </div>

        {/* Metadata Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
            }}
          >
            <Sparkles size={11} /> 60 FPS Live Preview
          </span>

          {file.resolution && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                color: 'var(--text-dim)',
              }}
            >
              <Film size={11} /> {file.resolution}
            </span>
          )}
          {file.durationSec && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                color: 'var(--text-dim)',
              }}
            >
              <Clock size={11} /> {formatTimeWithMs(file.durationSec)}
            </span>
          )}
          {file.sizeMb > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                color: 'var(--text-dim)',
              }}
            >
              <HardDrive size={11} /> {file.sizeMb.toFixed(1)} MB
            </span>
          )}
        </div>
      </div>

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
          {/* HTML5 Video Player Container */}
          <div
            style={{
              flex: 1,
              minHeight: '200px',
              maxHeight: '440px',
              borderRadius: '12px',
              background: '#000000',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {isLoadingPreview && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(10px)',
                  zIndex: 20,
                  gap: '10px',
                  color: '#ffffff',
                }}
              >
                <Loader2 size={32} className="spinning-loader" style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Preparing 60 FPS Live Preview...</span>
              </div>
            )}

            {isNativeSupported ? (
              <video
                ref={videoRef}
                src={activeMediaSrc}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onError={handleVideoError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlayPause}
                playsInline
                preload="auto"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  cursor: 'pointer',
                }}
              />
            ) : fallbackFrameSrc ? (
              <img
                src={fallbackFrameSrc}
                alt="Extracted Preview Frame"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Loader2 size={24} className="spinning-loader" />
                <span>Extracting GPU Preview Frame...</span>
              </div>
            )}
          </div>

          {/* Media Playback Controls Toolbar - 3-Column Grid with Centered Play & Option 2 Mini-Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              width: '100%',
              padding: '6px 0',
              gap: '12px',
            }}
          >
            {/* LEFT COLUMN: Speed Glass Dropdown / In-Place Custom Speed Input */}
            <div
              style={{
                justifySelf: 'end',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isEditingCustomSpeed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    value={customSpeedInput}
                    onChange={(e) => setCustomSpeedInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSpeedSubmitAction()}
                    placeholder="1.0"
                    autoFocus
                    style={{
                      width: '48px',
                      padding: '4px 6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCustomSpeedSubmitAction}
                    title="Set Speed"
                    style={{
                      padding: '5px 7px',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    background: 'var(--input-bg, rgba(255, 255, 255, 0.08))',
                    border: '1px solid var(--border-glass)',
                    minWidth: '78px',
                  }}
                >
                  <Gauge size={13} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                  <GlassSelect
                    options={dynamicSpeedOptions}
                    value={speedSelectVal}
                    onChange={handleSpeedSelectValChange}
                    placement="top"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* CENTER COLUMN: Central Core Playback Cluster [ Set In ] ( Play ) [ Set Out ] */}
            <div
              style={{
                justifySelf: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {/* Set In Button */}
              <button
                type="button"
                onClick={setInAtCurrent}
                title="Set In-Point at Playhead (Hotkey: [ )"
                style={{
                  ...controlButtonStyle,
                  background: 'rgba(6, 182, 212, 0.15)',
                  borderColor: 'rgba(6, 182, 212, 0.4)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(6, 182, 212, 0.2)',
                }}
              >
                <ChevronsRight size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>Set In [</span>
              </button>

              {/* Main Play/Pause Button */}
              <button
                type="button"
                onClick={togglePlayPause}
                disabled={!isNativeSupported}
                title={isNativeSupported ? 'Play/Pause (Space)' : 'Direct playback unavailable for this raw codec'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: isNativeSupported
                    ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)'
                    : 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isNativeSupported ? 'pointer' : 'not-allowed',
                  boxShadow: isNativeSupported ? '0 4px 18px rgba(99, 102, 241, 0.45)' : 'none',
                  opacity: isNativeSupported ? 1 : 0.6,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
              </button>

              {/* Set Out Button */}
              <button
                type="button"
                onClick={setOutAtCurrent}
                title="Set Out-Point at Playhead (Hotkey: ] )"
                style={{
                  ...controlButtonStyle,
                  background: 'rgba(99, 102, 241, 0.15)',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  color: '#818cf8',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                }}
              >
                <span>Set Out ]</span>
                <ChevronsLeft size={14} style={{ color: '#818cf8' }} />
              </button>
            </div>

            {/* RIGHT COLUMN: Audio Toggle & Right-Aligned Slow-Mo Engine */}
            <div
              style={{
                justifySelf: 'start',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                title={
                  isMuted
                    ? 'Audio Muted in Preview & Export (Click to Unmute)'
                    : 'Audio Included in Preview & Export (Click to Mute)'
                }
                style={{
                  ...controlButtonStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isMuted ? 'rgba(239, 68, 68, 0.18)' : 'var(--input-bg, rgba(255, 255, 255, 0.08))',
                  borderColor: isMuted ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-glass)',
                  color: isMuted ? '#f87171' : 'var(--text-main)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {isMuted ? 'Muted' : 'Audio'}
              </button>

              {/* Slow-Mo Engine Dropdown (Appears on the right ONLY when speed < 1.0) */}
              {playbackSpeed < 1.0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    minWidth: '145px',
                  }}
                >
                  {slowMoMode === 'OPTICAL_SMOOTH' ? (
                    <Sparkles size={13} style={{ color: '#a855f7', flexShrink: 0 }} />
                  ) : (
                    <Zap size={13} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                  )}
                  <GlassSelect
                    options={slowMoOptions}
                    value={slowMoMode}
                    onChange={(val) => setSlowMoMode(val as 'FRAME_DUP' | 'OPTICAL_SMOOTH')}
                    placement="top"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dual-Handle Timeline Slider */}
          <TimelineSlider
            durationSec={duration}
            startSec={startSec}
            endSec={endSec}
            currentSec={currentSec}
            onRangeChange={handleRangeChange}
            onSeek={handleSeek}
            onScrubStart={() => {
              if (videoRef.current) videoRef.current.muted = true;
            }}
            onScrubEnd={() => {
              if (videoRef.current) videoRef.current.muted = false;
            }}
          />

          {/* Precision Time Status Bar - Theme-Consistent Frosted Glass Card */}
          <div
            className="glass-card"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '12px',
              background: 'var(--bg-glass-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-glass)',
              gap: '10px',
            }}
          >
            {/* LEFT COLUMN: Clean In & Out Time Inputs (No Emojis/Icons) */}
            <div
              style={{
                justifySelf: 'start',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Start Time Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  In:
                </span>
                <input
                  type="text"
                  value={inputStart}
                  onChange={(e) => setInputStart(e.target.value)}
                  onBlur={handleStartBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartBlur()}
                  style={{
                    ...timeInputStyle,
                    borderColor: 'rgba(6, 182, 212, 0.4)',
                    color: 'var(--accent-cyan)',
                  }}
                  title="In-Point (HH:MM:SS.mmm or seconds)"
                />
              </div>

              {/* End Time Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#818cf8' }}>
                  Out:
                </span>
                <input
                  type="text"
                  value={inputEnd}
                  onChange={(e) => setInputEnd(e.target.value)}
                  onBlur={handleEndBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleEndBlur()}
                  style={{
                    ...timeInputStyle,
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    color: '#818cf8',
                  }}
                  title="Out-Point (HH:MM:SS.mmm or seconds)"
                />
              </div>
            </div>

            {/* CENTER COLUMN: Centered Trimmed Duration Badge */}
            <div
              style={{
                justifySelf: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-glass)',
                fontSize: '11.5px',
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
              }}
            >
              <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
              <span>Duration:</span>
              <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 700 }}>
                {formatTimeWithMs(Math.max(0, endSec - startSec))}
              </strong>
            </div>

            {/* RIGHT COLUMN: Reset Markers Action Button */}
            <div
              style={{
                justifySelf: 'end',
                whiteSpace: 'nowrap',
              }}
            >
              <button
                type="button"
                onClick={resetMarkers}
                title="Reset In/Out markers to full video length"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-cyan)';
                  e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                }}
              >
                <RotateCcw size={12} /> Reset Markers
              </button>
            </div>
          </div>
        </div>

        {/* Right Viewport (Collapsible Export ConfigPanel) */}
        <div
          style={{
            width: isPanelCollapsed ? '44px' : '360px',
            minWidth: isPanelCollapsed ? '44px' : '320px',
            maxWidth: isPanelCollapsed ? '44px' : '400px',
            transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
            height: '100%',
            flexShrink: 0,
          }}
        >
          <ConfigPanel
            mediaType="video"
            config={videoConfig}
            onChange={onVideoConfigChange}
            onStart={handleExport}
            imageConfig={imageConfig}
            onImageConfigChange={onImageConfigChange}
            onStartImage={() => {}}
            disabled={disabled}
            fileCount={1}
            isTrimmerMode={true}
            isCollapsed={isPanelCollapsed}
            onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
            onStartTrim={handleExport}
            fastCopyTrim={fastCopy}
            onFastCopyTrimChange={setFastCopy}
          />
        </div>
      </div>
    </div>
  );
};

const controlButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'var(--input-bg, rgba(255, 255, 255, 0.08))',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-main)',
  fontSize: '11.5px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.15s ease',
};

const timeInputStyle: React.CSSProperties = {
  width: '88px',
  padding: '3px 6px',
  borderRadius: '6px',
  background: 'var(--input-bg, rgba(0, 0, 0, 0.25))',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-main)',
  fontSize: '11.5px',
  fontFamily: 'monospace',
  textAlign: 'center',
  outline: 'none',
};
