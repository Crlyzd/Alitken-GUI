import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseTimelineZoomOptions {
  effectiveDuration: number;
  currentSec: number;
  isPlaying?: boolean;
}

export function useTimelineZoom({ effectiveDuration, currentSec, isPlaying = false }: UseTimelineZoomOptions) {
  const [zoom, setZoomState] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const panStartRef = useRef<{
    startX: number;
    startScrollLeft: number;
    hasMoved: boolean;
    pointerId: number;
  } | null>(null);
  const wasPanningRef = useRef(false);
  const isUserPannedRef = useRef(false);

  // Track Ctrl key state globally to adjust cursor over the seekbar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    const handleWindowBlur = () => setIsCtrlPressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // When playback starts, re-enable auto-following the playhead
  useEffect(() => {
    if (isPlaying) {
      isUserPannedRef.current = false;
    }
  }, [isPlaying]);

  const clampZoom = useCallback((val: number) => {
    return Math.max(1, Math.min(10, Math.round(val * 10) / 10));
  }, []);

  const setZoom = useCallback(
    (newZoomVal: number | ((prev: number) => number)) => {
      setZoomState((prev) => {
        const next = typeof newZoomVal === 'function' ? newZoomVal(prev) : newZoomVal;
        const clamped = clampZoom(next);
        if (clamped <= 1 && scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0;
          isUserPannedRef.current = false;
        }
        return clamped;
      });
    },
    [clampZoom]
  );

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(10, prev + (prev < 2 ? 0.5 : 1)));
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(1, prev - (prev <= 2 ? 0.5 : 1)));
  }, [setZoom]);

  const resetZoom = useCallback(() => {
    setZoomState(1);
    isUserPannedRef.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, []);

  // Center viewport on a specific timestamp (e.g. current playhead or marker)
  const centerOnTime = useCallback(
    (timeSec: number) => {
      if (!scrollContainerRef.current || !effectiveDuration) return;
      const container = scrollContainerRef.current;
      const ratio = Math.max(0, Math.min(1, timeSec / effectiveDuration));
      const targetX = ratio * container.scrollWidth;
      container.scrollTo({
        left: Math.max(0, targetX - container.clientWidth / 2),
        behavior: 'smooth',
      });
      isUserPannedRef.current = false;
    },
    [effectiveDuration]
  );

  // Cursor-anchored wheel zoom handling
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!scrollContainerRef.current) return;

      // Zoom if Ctrl or Alt key is held, or if pinch-zooming
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        const container = scrollContainerRef.current;
        const rect = container.getBoundingClientRect();
        const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));

        const delta = e.deltaY < 0 ? 0.5 : -0.5;
        const currentZoom = zoom;
        const nextZoom = clampZoom(currentZoom + delta);

        if (nextZoom === currentZoom) return;

        // Calculate cursor-anchored target scroll position
        const scrollLeft = container.scrollLeft;
        const trackX = scrollLeft + mouseX;
        const targetScrollLeft = (trackX * (nextZoom / currentZoom)) - mouseX;

        setZoomState(nextZoom);

        // Apply new scroll position on next microtask
        requestAnimationFrame(() => {
          if (container) {
            container.scrollLeft = Math.max(0, targetScrollLeft);
          }
        });
      }
    },
    [zoom, clampZoom]
  );

  // Ctrl+Drag / Middle-click Pan handlers
  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    if (!scrollContainerRef.current) return false;
    e.preventDefault();
    e.stopPropagation();

    panStartRef.current = {
      startX: e.clientX,
      startScrollLeft: scrollContainerRef.current.scrollLeft,
      hasMoved: false,
      pointerId: e.pointerId,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setIsPanning(true);
    wasPanningRef.current = false;
    return true;
  }, []);

  const handlePanPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panStartRef.current || !scrollContainerRef.current) return false;
    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - panStartRef.current.startX;
    if (Math.abs(dx) > 3) {
      panStartRef.current.hasMoved = true;
      wasPanningRef.current = true;
      isUserPannedRef.current = true;
    }

    const maxScroll = Math.max(0, scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth);
    const targetLeft = Math.max(0, Math.min(maxScroll, panStartRef.current.startScrollLeft - dx));
    scrollContainerRef.current.scrollLeft = targetLeft;
    return true;
  }, []);

  const handlePanPointerUp = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(panStartRef.current.pointerId);
      } catch {}
      const hadMoved = panStartRef.current.hasMoved;
      panStartRef.current = null;
      setIsPanning(false);
      return hadMoved;
    }
    return false;
  }, []);

  const checkWasPanning = useCallback(() => {
    if (wasPanningRef.current) {
      wasPanningRef.current = false;
      return true;
    }
    return false;
  }, []);

  // Auto-scroll ONLY during active playback and when user hasn't explicitly panned away
  useEffect(() => {
    if (
      !isPlaying ||
      zoom <= 1 ||
      !scrollContainerRef.current ||
      !effectiveDuration ||
      isPanning ||
      isUserPannedRef.current
    ) {
      return;
    }

    const container = scrollContainerRef.current;
    const clientWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    const playheadRatio = Math.max(0, Math.min(1, currentSec / effectiveDuration));
    const playheadX = playheadRatio * scrollWidth;

    const currentScroll = container.scrollLeft;
    const visibleRight = currentScroll + clientWidth;

    // Only scroll if playhead advances near right boundary or outside view
    if (playheadX > visibleRight - 40 || playheadX < currentScroll) {
      container.scrollTo({
        left: Math.max(0, playheadX - 60),
        behavior: 'smooth',
      });
    }
  }, [currentSec, zoom, effectiveDuration, isPlaying, isPanning]);

  return {
    zoom,
    isZoomed: zoom > 1,
    isPanning,
    isCtrlPressed,
    scrollContainerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    centerOnTime,
    handleWheel,
    handlePanPointerDown,
    handlePanPointerMove,
    handlePanPointerUp,
    checkWasPanning,
  };
}
