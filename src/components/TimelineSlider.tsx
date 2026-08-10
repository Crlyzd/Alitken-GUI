import React, { useRef, useState, useCallback } from 'react';

interface TimelineSliderProps {
  durationSec: number;
  startSec: number;
  endSec: number;
  currentSec: number;
  isDurationLocked?: boolean;
  onRangeChange: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  filmstrip?: string[];
  onHoverTime?: (timeSec: number | null) => void;
  hoverThumbnailSrc?: string | null;
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
  isDurationLocked = false,
  onRangeChange,
  onSeek,
  onScrubStart,
  onScrubEnd,
  filmstrip = [],
  onHoverTime,
  hoverThumbnailSrc,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const rangeOffsetRef = useRef<number>(0);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | 'range' | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; time: number } | null>(null);

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

  const handlePointerDown = (type: 'start' | 'end' | 'playhead' | 'range', e: React.PointerEvent) => {
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
    if (!trackRef.current || dragging) {
      setHoverPos(null);
      onHoverTime?.(null);
      return;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const clampedX = Math.max(75, Math.min(rect.width - 75, rawX));
    const time = (rawX / rect.width) * effectiveDuration;
    setHoverPos({ x: clampedX, time });
    onHoverTime?.(time);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    onHoverTime?.(null);
  };

  return (
    <div style={{ width: '100%', userSelect: 'none', padding: '12px 0 6px 0', position: 'relative' }}>
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

      {/* Floating Hover Tooltip Preview Card */}
      {hoverPos && !dragging && (
        <div
          style={{
            position: 'absolute',
            left: `${hoverPos.x}px`,
            bottom: '52px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '140px',
              height: '80px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              background: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hoverThumbnailSrc ? (
              <img
                src={hoverThumbnailSrc}
                alt="Hover Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div
                  className="spinner"
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                  }}
                />
                Seeking...
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#ffffff',
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontVariantNumeric: 'tabular-nums',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
            }}
          >
            {formatTimeWithMs(hoverPos.time)}
          </div>
        </div>
      )}

      {/* Main Track Container */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: '100%',
          height: '42px',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          cursor: 'pointer',
          touchAction: 'none',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Background Filmstrip Track Tiles */}
        {filmstrip.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              opacity: 0.45,
              pointerEvents: 'none',
            }}
          >
            {filmstrip.map((thumb, idx) => (
              <img
                key={idx}
                src={thumb}
                alt={`Filmstrip ${idx}`}
                style={{
                  flex: 1,
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.8) contrast(1.1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Unselected Left Area */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${startPercent}%`,
            height: '100%',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'brightness(0.6)',
            borderTopLeftRadius: '9px',
            borderBottomLeftRadius: '9px',
          }}
        />

        {/* Selected Clip Highlight Track */}
        <div
          onPointerDown={(e) => handlePointerDown('range', e)}
          title="Selected export area (Drag to move range)"
          style={{
            position: 'absolute',
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
            borderTop: '2px solid var(--accent-cyan)',
            borderBottom: '2px solid var(--accent-cyan)',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.2)',
            cursor: dragging === 'range' ? 'grabbing' : 'grab',
            zIndex: 5,
          }}
        />

        {/* Unselected Right Area */}
        <div
          style={{
            position: 'absolute',
            left: `${endPercent}%`,
            right: 0,
            height: '100%',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'brightness(0.6)',
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
