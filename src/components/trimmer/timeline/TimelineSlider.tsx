import React from 'react';
import { useTimelineScrubber } from './useTimelineScrubber';
import { FilmstripTrack } from './FilmstripTrack';
import { RangeHandles } from './RangeHandles';
import { HoverTimeTooltip } from './HoverTimeTooltip';
import { formatTimeWithMs } from './formatTime';

export interface TimelineSliderProps {
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

export { formatTimeWithMs };

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
  const {
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
  } = useTimelineScrubber({
    durationSec,
    startSec,
    endSec,
    isDurationLocked,
    onRangeChange,
    onSeek,
    onScrubStart,
    onScrubEnd,
    onHoverTime,
  });

  const startPercent = Math.max(0, Math.min(100, (startSec / effectiveDuration) * 100)) || 0;
  const endPercent = Math.max(0, Math.min(100, (endSec / effectiveDuration) * 100)) || 0;
  const currentPercent = Math.max(0, Math.min(100, (currentSec / effectiveDuration) * 100)) || 0;

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
      <HoverTimeTooltip
        hoverPos={hoverPos}
        dragging={dragging}
        hoverThumbnailSrc={hoverThumbnailSrc}
      />

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
        <FilmstripTrack
          filmstrip={filmstrip}
          startPercent={startPercent}
          endPercent={endPercent}
        />

        <RangeHandles
          startPercent={startPercent}
          endPercent={endPercent}
          currentPercent={currentPercent}
          startSec={startSec}
          endSec={endSec}
          currentSec={currentSec}
          dragging={dragging}
          onPointerDown={handlePointerDown}
        />
      </div>
    </div>
  );
};
