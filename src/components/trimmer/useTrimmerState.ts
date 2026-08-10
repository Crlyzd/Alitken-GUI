import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { FileItem } from '../Dropzone';
import { ConfigState } from '../ConfigPanel';
import { TrimConfig } from '../../types/media';
import { formatTimeWithMs } from '../TimelineSlider';
import {
  parseTimeToSeconds,
  parseAndClampSpeed,
  speedOptions,
} from '../../utils/trimmerUtils';

interface UseTrimmerStateParams {
  file: FileItem;
  videoConfig: ConfigState;
  onBack: (updatedFile: FileItem) => void;
  onStartTrim: (trimConfig: TrimConfig) => void;
}

export function useTrimmerState({
  file,
  videoConfig,
  onBack,
  onStartTrim,
}: UseTrimmerStateParams) {
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
  const [fastCopy, setFastCopy] = useState<boolean>(file.trimFastCopy ?? false);
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

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && videoRef.current.duration > 0 && !isNaN(videoRef.current.duration)) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!file.trimEndSec || file.trimEndSec > dur) {
        setEndSec(dur);
      }
    }
  }, [file.trimEndSec]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentSec(t);
      // Auto pause if reached endSec while playing
      if (t >= endSec && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [endSec, isPlaying]);

  const handleVideoError = useCallback(() => {
    if (isLoadingPreview) return;
    setIsNativeSupported(false);
    invoke<string>('get_video_frame_preview', { filePath: file.path, timestampSec: currentSec })
      .then((frame) => setFallbackFrameSrc(frame))
      .catch(() => {});
  }, [file.path, currentSec, isLoadingPreview]);

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

  const handleSeek = useCallback((time: number) => {
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
  }, [duration, file.path, isNativeSupported]);

  const nudgeTime = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(duration, currentSec + delta));
    handleSeek(target);
  }, [duration, currentSec, handleSeek]);

  const setInAtCurrent = useCallback(() => {
    const newStart = Math.min(currentSec, endSec - 0.1);
    setStartSec(Math.max(0, newStart));
  }, [currentSec, endSec]);

  const setOutAtCurrent = useCallback(() => {
    const newEnd = Math.max(currentSec, startSec + 0.1);
    setEndSec(Math.min(duration, newEnd));
  }, [currentSec, startSec, duration]);

  const resetMarkers = useCallback(() => {
    setStartSec(0);
    setEndSec(duration);
    handleSeek(0);
  }, [duration, handleSeek]);

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    setStartSec(newStart);
    setEndSec(newEnd);
  }, []);

  const handleStartBlur = useCallback(() => {
    const parsed = parseTimeToSeconds(inputStart);
    if (parsed !== null && parsed >= 0 && parsed < endSec) {
      setStartSec(parsed);
      handleSeek(parsed);
    } else {
      setInputStart(formatTimeWithMs(startSec));
    }
  }, [inputStart, endSec, startSec, handleSeek]);

  const handleEndBlur = useCallback(() => {
    const parsed = parseTimeToSeconds(inputEnd);
    if (parsed !== null && parsed > startSec && parsed <= duration) {
      setEndSec(parsed);
      handleSeek(parsed);
    } else {
      setInputEnd(formatTimeWithMs(endSec));
    }
  }, [inputEnd, startSec, duration, endSec, handleSeek]);

  const handleSpeedSelectValChange = useCallback((val: string) => {
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
  }, [playbackSpeed]);

  const handleCustomSpeedSubmitAction = useCallback(() => {
    const parsed = parseAndClampSpeed(customSpeedInput);
    setPlaybackSpeed(parsed);
    setSpeedSelectVal(String(parsed));
    setIsEditingCustomSpeed(false);
  }, [customSpeedInput]);

  const dynamicSpeedOptions = useMemo(() => {
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

  // Keyboard shortcut listener (Space = play/pause, [ = set In, ] = set Out, Arrow keys = nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [togglePlayPause, setInAtCurrent, setOutAtCurrent, nudgeTime]);

  const handleSaveAndBack = useCallback(() => {
    onBack({
      ...file,
      trimStartSec: startSec,
      trimEndSec: endSec,
      trimFastCopy: fastCopy,
    });
  }, [file, startSec, endSec, fastCopy, onBack]);

  const handleExport = useCallback(() => {
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
  }, [file.path, startSec, endSec, fastCopy, videoConfig, playbackSpeed, isMuted, slowMoMode, onStartTrim]);

  const activeMediaSrc = previewPath
    ? convertFileSrc(previewPath)
    : isLoadingPreview
    ? ''
    : convertFileSrc(file.path);

  return {
    videoRef,
    previewPath,
    isLoadingPreview,
    fallbackFrameSrc,
    isNativeSupported,
    duration,
    currentSec,
    startSec,
    endSec,
    isPlaying,
    fastCopy,
    isPanelCollapsed,
    playbackSpeed,
    speedSelectVal,
    isEditingCustomSpeed,
    customSpeedInput,
    slowMoMode,
    isMuted,
    inputStart,
    inputEnd,
    activeMediaSrc,
    dynamicSpeedOptions,
    setIsPlaying,
    setIsMuted,
    setSlowMoMode,
    setFastCopy,
    setIsPanelCollapsed,
    setInputStart,
    setInputEnd,
    setCustomSpeedInput,
    handleLoadedMetadata,
    handleTimeUpdate,
    handleVideoError,
    togglePlayPause,
    handleSeek,
    nudgeTime,
    setInAtCurrent,
    setOutAtCurrent,
    resetMarkers,
    handleRangeChange,
    handleStartBlur,
    handleEndBlur,
    handleSpeedSelectValChange,
    handleCustomSpeedSubmitAction,
    handleSaveAndBack,
    handleExport,
  };
}
