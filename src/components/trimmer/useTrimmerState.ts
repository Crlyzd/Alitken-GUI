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

// In-memory session cache for extracted seeker filmstrips (file.path -> base64 image array)
const filmstripCache = new Map<string, string[]>();

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
  const initialFilmstrip = useMemo(() => {
    if (file.filmstrip && file.filmstrip.length > 0) {
      return file.filmstrip;
    }
    return filmstripCache.get(file.path) || [];
  }, [file.path, file.filmstrip]);

  const [filmstrip, setFilmstrip] = useState<string[]>(initialFilmstrip);
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(file.aspectRatio || 'ORIGINAL');
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>(file.cropOffset || { x: 0.5, y: 0.5 });
  const [cropScale, setCropScale] = useState<number>(file.cropScale || 1.0);
  const [isCropApplied, setIsCropApplied] = useState<boolean>(
    file.isCropApplied ?? (file.aspectRatio ? file.aspectRatio !== 'ORIGINAL' : false)
  );

  const applyCrop = useCallback(() => {
    setIsCropApplied(true);
  }, []);

  const cancelCrop = useCallback(() => {
    setAspectRatio('ORIGINAL');
    setCropOffset({ x: 0.5, y: 0.5 });
    setCropScale(1.0);
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

    // Check if cached filmstrip exists
    const cached = file.filmstrip && file.filmstrip.length > 0 ? file.filmstrip : filmstripCache.get(file.path);
    if (cached && cached.length > 0) {
      setFilmstrip(cached);
    } else {
      setFilmstrip([]);
    }

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

    if (!cached || cached.length === 0) {
      invoke<string[]>('get_wmf_filmstrip', { filePath: file.path, count: 16 })
        .then((strip) => {
          if (!isCancelled && strip.length > 0) {
            filmstripCache.set(file.path, strip);
            setFilmstrip(strip);
          }
        })
        .catch(() => {});
    }

    // Launch prepare_video_preview in parallel for web player preview stream
    invoke<string>('prepare_video_preview', { filePath: file.path })
      .then((resolvedPath) => {
        if (!isCancelled) {
          setPreviewPath(resolvedPath);
          setIsNativeSupported(true);
          setIsLoadingPreview(false);

          // Secondary fallback if filmstrip was not populated yet for non-standard formats
          if (!filmstripCache.has(file.path) && (!file.filmstrip || file.filmstrip.length === 0)) {
            invoke<string[]>('get_wmf_filmstrip', { filePath: resolvedPath, count: 16 })
              .then((strip) => {
                if (!isCancelled && strip.length > 0) {
                  filmstripCache.set(file.path, strip);
                  setFilmstrip((prev) => (prev.length === 0 ? strip : prev));
                }
              })
              .catch(() => {});
          }
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
      }, 120);
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

  const getCropParams = useCallback(() => {
    if (aspectRatio === 'ORIGINAL') return null;
    let vw = videoRef.current?.videoWidth;
    let vh = videoRef.current?.videoHeight;
    if ((!vw || !vh) && file.resolution) {
      const parts = file.resolution.replace('×', 'x').split('x').map((n) => parseInt(n, 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        vw = parts[0];
        vh = parts[1];
      }
    }
    if (!vw || !vh) {
      if (file.crop_w && file.crop_h) {
        return {
          crop_w: file.crop_w,
          crop_h: file.crop_h,
          crop_x: file.crop_x ?? 0,
          crop_y: file.crop_y ?? 0,
          crop_filter: file.crop_filter,
        };
      }
      return null;
    }

    let targetRatio = 16 / 9;
    if (aspectRatio === '16:9') targetRatio = 16 / 9;
    else if (aspectRatio === '9:16') targetRatio = 9 / 16;
    else if (aspectRatio === '1:1') targetRatio = 1 / 1;
    else if (aspectRatio === '4:5') targetRatio = 4 / 5;
    else if (aspectRatio === '4:3') targetRatio = 4 / 3;
    else if (aspectRatio === '21:9') targetRatio = 21 / 9;

    const sourceRatio = vw / vh;
    const canvasAspect = targetRatio;

    // Calculate canvas size in source resolution space
    let canvasW = vw;
    let canvasH = vh;
    if (sourceRatio >= canvasAspect) {
      canvasH = vh;
      canvasW = Math.round(vh * canvasAspect);
    } else {
      canvasW = vw;
      canvasH = Math.round(vw / canvasAspect);
    }

    // Base inner video dimensions inside canvas before scale
    const isVideoWider = sourceRatio >= canvasAspect;
    let baseVW = isVideoWider ? canvasW : Math.round(canvasH * sourceRatio);
    let baseVH = isVideoWider ? Math.round(canvasW / sourceRatio) : canvasH;

    const scale = cropScale || 1.0;
    let scaledVW = Math.round(baseVW * scale);
    let scaledVH = Math.round(baseVH * scale);

    scaledVW = Math.max(2, scaledVW);
    scaledVH = Math.max(2, scaledVH);

    // Delta X/Y from cropOffset relative to center
    const deltaX = (cropOffset.x - 0.5) * baseVW;
    const deltaY = (cropOffset.y - 0.5) * baseVH;

    // Top-Left corner position of video inside canvas
    let px = Math.round((canvasW - scaledVW) / 2 + deltaX);
    let py = Math.round((canvasH - scaledVH) / 2 + deltaY);

    // Ensure even dimensions for FFmpeg libx264 compatibility
    canvasW = canvasW - (canvasW % 2);
    canvasH = canvasH - (canvasH % 2);
    scaledVW = scaledVW - (scaledVW % 2);
    scaledVH = scaledVH - (scaledVH % 2);

    let cropW = scaledVW;
    let cropH = scaledVH;
    let cropX = 0;
    let cropY = 0;

    if (px < 0) {
      cropX = Math.abs(px);
      cropW = Math.min(scaledVW - cropX, canvasW);
      px = 0;
    }
    if (py < 0) {
      cropY = Math.abs(py);
      cropH = Math.min(scaledVH - cropY, canvasH);
      py = 0;
    }

    cropW = Math.max(2, cropW - (cropW % 2));
    cropH = Math.max(2, cropH - (cropH % 2));
    cropX = Math.max(0, cropX - (cropX % 2));
    cropY = Math.max(0, cropY - (cropY % 2));
    px = Math.max(0, px - (px % 2));
    py = Math.max(0, py - (py % 2));

    // Construct filter string: scale -> (crop if overflow) -> pad
    let filter = `scale=${scaledVW}:${scaledVH}`;
    if (cropX > 0 || cropY > 0 || cropW < scaledVW || cropH < scaledVH) {
      filter += `,crop=${cropW}:${cropH}:${cropX}:${cropY}`;
    }
    filter += `,pad=${canvasW}:${canvasH}:${px}:${py}:black`;

    return {
      crop_w: canvasW,
      crop_h: canvasH,
      crop_x: px,
      crop_y: py,
      crop_filter: filter,
    };
  }, [aspectRatio, cropOffset, cropScale, file.resolution, file.crop_w, file.crop_h, file.crop_filter]);

  const handleSaveAndBack = useCallback(() => {
    const crop = (isCropApplied || aspectRatio !== 'ORIGINAL') ? getCropParams() : null;
    onBack({
      ...file,
      trimStartSec: startSec,
      trimEndSec: endSec,
      trimFastCopy: crop ? false : fastCopy,
      filmstrip: filmstrip.length > 0 ? filmstrip : file.filmstrip,
      aspectRatio,
      cropOffset,
      cropScale,
      isCropApplied: !!crop,
      crop_x: crop?.crop_x,
      crop_y: crop?.crop_y,
      crop_w: crop?.crop_w,
      crop_h: crop?.crop_h,
      crop_filter: crop?.crop_filter,
    });
  }, [file, startSec, endSec, fastCopy, filmstrip, aspectRatio, cropOffset, cropScale, isCropApplied, getCropParams, onBack]);

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
      crop_filter: crop?.crop_filter,
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
    cropScale,
    setCropScale,
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
