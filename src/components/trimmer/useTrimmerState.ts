import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { FileItem } from '../Dropzone';
import { ConfigState } from '../ConfigPanel';
import { TrimConfig, AspectRatioOption } from '../../types/media';
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
  const hoverThrottleRef = useRef<number | null>(null);

  const [previewPath, setPreviewPath] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);
  const [fallbackFrameSrc, setFallbackFrameSrc] = useState<string | null>(null);
  const [isNativeSupported, setIsNativeSupported] = useState<boolean>(true);

  // WMF Dual-Thumbnail State
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const [hoverThumbnailSrc, setHoverThumbnailSrc] = useState<string | null>(null);
  const [isWmfSupported, setIsWmfSupported] = useState<boolean>(true);

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

  // Aspect Ratio & Crop Positioning State
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('ORIGINAL');
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isCropApplied, setIsCropApplied] = useState<boolean>(false);

  const applyCrop = useCallback(() => {
    setIsCropApplied(true);
  }, []);

  const cancelCrop = useCallback(() => {
    setAspectRatio('ORIGINAL');
    setCropOffset({ x: 0.5, y: 0.5 });
    setIsCropApplied(false);
  }, []);

  const [inputStart, setInputStart] = useState<string>(formatTimeWithMs(file.trimStartSec || 0));
  const [inputEnd, setInputEnd] = useState<string>(
    formatTimeWithMs(file.trimEndSec || file.durationSec || 60)
  );
  const [isDurationLocked, setIsDurationLocked] = useState<boolean>(false);
  const [inputDuration, setInputDuration] = useState<string>(
    formatTimeWithMs(
      Math.max(0, (file.trimEndSec || file.durationSec || 60) - (file.trimStartSec || 0))
    )
  );

  // Initialize preview stream / remux & WMF filmstrip on mount or when file changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingPreview(true);
    setIsNativeSupported(true);
    setFallbackFrameSrc(null);
    setFilmstrip([]);

    // Fetch WMF support and filmstrip immediately on mount using the source file.path
    // WMF native COM API is zero-lag (<20ms) and populates seek bar thumbnails instantly
    invoke<boolean>('check_wmf_support', { filePath: file.path })
      .then((supported) => {
        if (!isCancelled) {
          setIsWmfSupported(supported);
        }
      })
      .catch(() => {
        if (!isCancelled) setIsWmfSupported(false);
      });

    invoke<string[]>('get_wmf_filmstrip', { filePath: file.path, count: 16 })
      .then((strip) => {
        if (!isCancelled && strip.length > 0) setFilmstrip(strip);
      })
      .catch(() => {});

    // Launch prepare_video_preview in parallel for web player preview stream
    invoke<string>('prepare_video_preview', { filePath: file.path })
      .then((resolvedPath) => {
        if (!isCancelled) {
          setPreviewPath(resolvedPath);
          setIsNativeSupported(true);
          setIsLoadingPreview(false);

          // Secondary fallback if filmstrip was not populated yet for non-standard formats
          invoke<string[]>('get_wmf_filmstrip', { filePath: resolvedPath, count: 16 })
            .then((strip) => {
              if (!isCancelled && strip.length > 0) {
                setFilmstrip((prev) => (prev.length === 0 ? strip : prev));
              }
            })
            .catch(() => {});
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
      invoke('cancel_preview_video', { filePath: file.path }).catch(() => {});
      invoke('unregister_preview_video', { filePath: file.path }).catch(() => {});
      if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
      if (hoverThrottleRef.current) clearTimeout(hoverThrottleRef.current);
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

  useEffect(() => {
    setInputDuration(formatTimeWithMs(Math.max(0, endSec - startSec)));
  }, [startSec, endSec]);

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

  const handleHoverTime = useCallback(
    (timeSec: number | null) => {
      if (timeSec === null) {
        setHoverThumbnailSrc(null);
        if (hoverThrottleRef.current) clearTimeout(hoverThrottleRef.current);
        return;
      }

      if (hoverThrottleRef.current) clearTimeout(hoverThrottleRef.current);
      hoverThrottleRef.current = window.setTimeout(() => {
        if (isWmfSupported) {
          invoke<string>('get_wmf_frame_preview', {
            filePath: file.path,
            timestampSec: timeSec,
            maxWidth: 160,
          })
            .then((frame) => setHoverThumbnailSrc(frame))
            .catch(() => {
              invoke<string>('get_video_frame_preview', {
                filePath: file.path,
                timestampSec: timeSec,
              })
                .then((f) => setHoverThumbnailSrc(f))
                .catch(() => {});
            });
        } else {
          invoke<string>('get_video_frame_preview', {
            filePath: file.path,
            timestampSec: timeSec,
          })
            .then((f) => setHoverThumbnailSrc(f))
            .catch(() => {});
        }
      }, 30);
    },
    [file.path, isWmfSupported]
  );

  const handleVideoError = useCallback(() => {
    if (isLoadingPreview) return;
    setIsNativeSupported(false);
    if (isWmfSupported) {
      invoke<string>('get_wmf_frame_preview', {
        filePath: file.path,
        timestampSec: currentSec,
      })
        .then((frame) => setFallbackFrameSrc(frame))
        .catch(() => {
          invoke<string>('get_video_frame_preview', {
            filePath: file.path,
            timestampSec: currentSec,
          })
            .then((f) => setFallbackFrameSrc(f))
            .catch(() => {});
        });
    } else {
      invoke<string>('get_video_frame_preview', {
        filePath: file.path,
        timestampSec: currentSec,
      })
        .then((frame) => setFallbackFrameSrc(frame))
        .catch(() => {});
    }
  }, [file.path, currentSec, isLoadingPreview, isWmfSupported]);

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
      } else if (isWmfSupported) {
        invoke<string>('get_wmf_frame_preview', {
          filePath: file.path,
          timestampSec: clamped,
        })
          .then((frame) => setFallbackFrameSrc(frame))
          .catch(() => {
            invoke<string>('get_video_frame_preview', {
              filePath: file.path,
              timestampSec: clamped,
            })
              .then((f) => setFallbackFrameSrc(f))
              .catch(() => {});
          });
      } else {
        invoke<string>('get_video_frame_preview', {
          filePath: file.path,
          timestampSec: clamped,
        })
          .then((frame) => setFallbackFrameSrc(frame))
          .catch(() => {});
      }
    });
  }, [duration, file.path, isNativeSupported, isWmfSupported]);

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
    setIsDurationLocked(false);
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
    if (parsed !== null && parsed >= 0 && parsed < duration) {
      if (isDurationLocked) {
        const clipLength = Math.max(0.1, endSec - startSec);
        const clampedStart = Math.max(0, Math.min(duration - clipLength, parsed));
        const clampedEnd = Math.min(duration, clampedStart + clipLength);
        setStartSec(clampedStart);
        setEndSec(clampedEnd);
        handleSeek(clampedStart);
      } else if (parsed < endSec) {
        setStartSec(parsed);
        handleSeek(parsed);
      } else {
        setInputStart(formatTimeWithMs(startSec));
      }
    } else {
      setInputStart(formatTimeWithMs(startSec));
    }
  }, [inputStart, endSec, startSec, duration, isDurationLocked, handleSeek]);

  const handleEndBlur = useCallback(() => {
    const parsed = parseTimeToSeconds(inputEnd);
    if (parsed !== null && parsed > 0 && parsed <= duration) {
      if (isDurationLocked) {
        const clipLength = Math.max(0.1, endSec - startSec);
        const clampedEnd = Math.max(clipLength, Math.min(duration, parsed));
        const clampedStart = Math.max(0, clampedEnd - clipLength);
        setStartSec(clampedStart);
        setEndSec(clampedEnd);
        handleSeek(clampedEnd);
      } else if (parsed > startSec) {
        setEndSec(parsed);
        handleSeek(parsed);
      } else {
        setInputEnd(formatTimeWithMs(endSec));
      }
    } else {
      setInputEnd(formatTimeWithMs(endSec));
    }
  }, [inputEnd, startSec, duration, endSec, isDurationLocked, handleSeek]);

  const handleDurationBlur = useCallback(() => {
    const parsedDur = parseTimeToSeconds(inputDuration);
    if (parsedDur !== null && parsedDur > 0 && parsedDur <= duration) {
      let newStart = startSec;
      let newEnd = startSec + parsedDur;
      if (newEnd > duration) {
        newEnd = duration;
        newStart = Math.max(0, duration - parsedDur);
      }
      setStartSec(newStart);
      setEndSec(newEnd);
      setIsDurationLocked(true);
      handleSeek(newStart);
    } else {
      setInputDuration(formatTimeWithMs(Math.max(0, endSec - startSec)));
    }
  }, [inputDuration, duration, startSec, endSec, handleSeek]);

  const toggleDurationLock = useCallback(() => {
    setIsDurationLocked((prev) => !prev);
  }, []);

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

  const getCropParams = useCallback(() => {
    if (aspectRatio === 'ORIGINAL' || !videoRef.current) return null;
    const v = videoRef.current;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return null;

    let targetRatio = 16 / 9;
    if (aspectRatio === '16:9') targetRatio = 16 / 9;
    else if (aspectRatio === '9:16') targetRatio = 9 / 16;
    else if (aspectRatio === '1:1') targetRatio = 1 / 1;
    else if (aspectRatio === '4:5') targetRatio = 4 / 5;
    else if (aspectRatio === '4:3') targetRatio = 4 / 3;
    else if (aspectRatio === '21:9') targetRatio = 21 / 9;

    const sourceRatio = vw / vh;
    let cropW = vw;
    let cropH = vh;

    if (targetRatio < sourceRatio) {
      cropH = vh;
      cropW = Math.round(vh * targetRatio);
    } else {
      cropW = vw;
      cropH = Math.round(vw / targetRatio);
    }

    const maxX = Math.max(0, vw - cropW);
    const maxY = Math.max(0, vh - cropH);

    const cropX = Math.round(cropOffset.x * maxX);
    const cropY = Math.round(cropOffset.y * maxY);

    return {
      crop_w: Math.max(2, cropW - (cropW % 2)),
      crop_h: Math.max(2, cropH - (cropH % 2)),
      crop_x: Math.max(0, cropX - (cropX % 2)),
      crop_y: Math.max(0, cropY - (cropY % 2)),
    };
  }, [aspectRatio, cropOffset]);

  const handleExport = useCallback(() => {
    const crop = getCropParams();
    const trimConfig: TrimConfig = {
      input_file: file.path,
      start_sec: startSec,
      end_sec: endSec,
      fast_copy: crop ? false : fastCopy,
      codec_choice: videoConfig.codecChoice,
      target_height: videoConfig.targetHeight,
      target_bitrate: videoConfig.targetBitrate,
      custom_output_dir: videoConfig.outputDir,
      playback_speed: playbackSpeed,
      mute_audio: isMuted,
      slow_mo_mode: slowMoMode,
      crop_w: crop?.crop_w,
      crop_h: crop?.crop_h,
      crop_x: crop?.crop_x,
      crop_y: crop?.crop_y,
    };
    onStartTrim(trimConfig);
  }, [file.path, startSec, endSec, fastCopy, videoConfig, playbackSpeed, isMuted, slowMoMode, getCropParams, onStartTrim]);

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
    aspectRatio,
    setAspectRatio,
    cropOffset,
    setCropOffset,
    isCropApplied,
    setIsCropApplied,
    applyCrop,
    cancelCrop,
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
    isDurationLocked,
    inputDuration,
    setInputDuration,
    handleDurationBlur,
    toggleDurationLock,
    filmstrip,
    hoverThumbnailSrc,
    handleHoverTime,
  };
}
