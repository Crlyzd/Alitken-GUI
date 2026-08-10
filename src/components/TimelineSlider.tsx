import React, { useRef, useState, useCallback } from 'react';

interface TimelineSliderProps {
  durationSec: number;
  startSec: number;
  endSec: number;
  currentSec: number;
  onRangeChange: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export function formatTimeWithMs(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  durationSec,
  startSec,
  endSec,
  currentSec,
  onRangeChange,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  const effectiveDuration = durationSec > 0 ? durationSec : 1;
  const startPercent = Math.max(0, Math.min(100, (startSec / effectiveDuration) * 100));
  const endPercent = Math.max(0, Math.min(100, (endSec / effectiveDuration) * 100));
  const currentPercent = Math.max(0, Math.min(100, (currentSec / effectiveDuration) * 100));

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

  const handlePointerDown = (type: 'start' | 'end' | 'playhead', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(type);
    onScrubStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const time = getTimeFromEvent(e);

    if (dragging === 'start') {
      const clampedStart = Math.max(0, Math.min(endSec - 0.1, time));
      onRangeChange(clampedStart, endSec);
      onSeek(clampedStart);
    } else if (dragging === 'end') {
      const clampedEnd = Math.max(startSec + 0.1, Math.min(effectiveDuration, time));
      onRangeChange(startSec, clampedEnd);
      onSeek(clampedEnd);
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

  return (
    <div style={{ width: '100%', userSelect: 'none', padding: '12px 0 6px 0' }}>
      {/* Time labels above track */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-dim)',
          marginBottom: '6px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>00:00.000</span>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
          Selected: {formatTimeWithMs(Math.max(0, endSec - startSec))}
        </span>
        <span>{formatTimeWithMs(effectiveDuration)}</span>
      </div>

      {/* Main Track Container */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          cursor: 'pointer',
          touchAction: 'none',
          overflow: 'visible',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Unselected Left Area */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${startPercent}%`,
            height: '100%',
            background: 'rgba(0, 0, 0, 0.25)',
            borderTopLeftRadius: '9px',
            borderBottomLeftRadius: '9px',
          }}
        />

        {/* Selected Clip Highlight Track */}
        <div
          style={{
            position: 'absolute',
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
            borderTop: '2px solid var(--accent-cyan)',
            borderBottom: '2px solid var(--accent-cyan)',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.2)',
          }}
        />

        {/* Unselected Right Area */}
        <div
          style={{
            position: 'absolute',
            left: `${endPercent}%`,
            right: 0,
            height: '100%',
            background: 'rgba(0, 0, 0, 0.25)',
            borderTopRightRadius: '9px',
            borderBottomRightRadius: '9px',
          }}
        />

        {/* In-Point (Start) Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('start', e)}
          title={`In-Point: ${formatTimeWithMs(startSec)}`}
          style={{
            position: 'absolute',
            left: `calc(${startPercent}% - 8px)`,
            width: '16px',
            height: '46px',
            borderRadius: '6px',
            background: 'var(--accent-cyan)',
            border: '2px solid #ffffff',
            boxShadow: '0 0 10px rgba(6, 182, 212, 0.7)',
            cursor: 'ew-resize',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: dragging === 'start' ? 'none' : 'transform 0.1s ease',
            transform: dragging === 'start' ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <div style={{ width: '2px', height: '14px', background: 'rgba(0,0,0,0.5)', borderRadius: '1px' }} />
        </div>

        {/* Out-Point (End) Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('end', e)}
          title={`Out-Point: ${formatTimeWithMs(endSec)}`}
          style={{
            position: 'absolute',
            left: `calc(${endPercent}% - 8px)`,
            width: '16px',
            height: '46px',
            borderRadius: '6px',
            background: 'var(--accent-primary)',
            border: '2px solid #ffffff',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.7)',
            cursor: 'ew-resize',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: dragging === 'end' ? 'none' : 'transform 0.1s ease',
            transform: dragging === 'end' ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <div style={{ width: '2px', height: '14px', background: 'rgba(0,0,0,0.5)', borderRadius: '1px' }} />
        </div>

        {/* Playhead Needle */}
        <div
          onPointerDown={(e) => handlePointerDown('playhead', e)}
          title={`Playhead: ${formatTimeWithMs(currentSec)}`}
          style={{
            position: 'absolute',
            left: `calc(${currentPercent}% - 6px)`,
            width: '12px',
            height: '52px',
            cursor: 'ew-resize',
            zIndex: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {/* Top Diamond Bead */}
          <div
            style={{
              width: '10px',
              height: '10px',
              background: '#ffffff',
              borderRadius: '2px',
              transform: 'rotate(45deg)',
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
            }}
          />
          {/* Vertical Needle line */}
          <div
            style={{
              width: '2px',
              height: '42px',
              background: '#ffffff',
              boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
