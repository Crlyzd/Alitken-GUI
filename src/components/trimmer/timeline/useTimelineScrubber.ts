import { useRef, useState, useCallback } from 'react';

interface UseTimelineScrubberProps {
  durationSec: number;
  startSec: number;
  endSec: number;
  isDurationLocked: boolean;
  onRangeChange: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  onHoverTime?: (timeSec: number | null) => void;
}

export function useTimelineScrubber({
  durationSec,
  startSec,
  endSec,
  isDurationLocked,
  onRangeChange,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onHoverTime,
}: UseTimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rangeOffsetRef = useRef<number>(0);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | 'range' | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; time: number } | null>(null);

  const effectiveDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1;

  const getTimeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      return ratio * effectiveDuration;
    },
    [effectiveDuration]
  );

  const handlePointerDown = (type: 'start' | 'end' | 'playhead' | 'range', e: React.PointerEvent) => {
    if (e.ctrlKey || e.button === 1) return;

    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (type === 'range') {
      const clickTime = getTimeFromEvent(e);
      rangeOffsetRef.current = clickTime - startSec;
    }
    setDragging(type);
    onScrubStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const time = getTimeFromEvent(e);
    const clipLength = Math.max(0.1, endSec - startSec);

    if (dragging === 'start') {
      if (isDurationLocked) {
        const clampedStart = Math.max(0, Math.min(effectiveDuration - clipLength, time));
        const clampedEnd = clampedStart + clipLength;
        onRangeChange(clampedStart, clampedEnd);
        onSeek(clampedStart);
      } else {
        const clampedStart = Math.max(0, Math.min(endSec - 0.1, time));
        onRangeChange(clampedStart, endSec);
        onSeek(clampedStart);
      }
    } else if (dragging === 'end') {
      if (isDurationLocked) {
        const clampedEnd = Math.max(clipLength, Math.min(effectiveDuration, time));
        const clampedStart = clampedEnd - clipLength;
        onRangeChange(clampedStart, clampedEnd);
        onSeek(clampedEnd);
      } else {
        const clampedEnd = Math.max(startSec + 0.1, Math.min(effectiveDuration, time));
        onRangeChange(startSec, clampedEnd);
        onSeek(clampedEnd);
      }
    } else if (dragging === 'range') {
      const targetStart = time - rangeOffsetRef.current;
      const clampedStart = Math.max(0, Math.min(effectiveDuration - clipLength, targetStart));
      const clampedEnd = clampedStart + clipLength;
      onRangeChange(clampedStart, clampedEnd);
      onSeek(clampedStart);
    } else if (dragging === 'playhead') {
      const clampedTime = Math.max(0, Math.min(effectiveDuration, time));
      onSeek(clampedTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDragging(null);
      onScrubEnd?.();
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const time = getTimeFromEvent(e);
    onSeek(Math.max(0, Math.min(effectiveDuration, time)));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!trackRef.current || dragging || e.ctrlKey) {
      setHoverPos(null);
      onHoverTime?.(null);
      return;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const parentRect = trackRef.current.parentElement?.getBoundingClientRect() || rect;
    const rawX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const viewportX = Math.max(0, Math.min(parentRect.width, e.clientX - parentRect.left));
    const clampedX = Math.max(75, Math.min(parentRect.width - 75, viewportX));
    const time = (rawX / rect.width) * effectiveDuration;
    setHoverPos({ x: clampedX, time });
    onHoverTime?.(time);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    onHoverTime?.(null);
  };

  return {
    trackRef,
    dragging,
    hoverPos,
    effectiveDuration,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTrackClick,
    handleMouseMove,
    handleMouseLeave,
  };
}
