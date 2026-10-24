import React from 'react';
import { useTimelineScrubber } from './useTimelineScrubber';
import { useTimelineZoom } from './useTimelineZoom';
import { TimelineZoomControls } from './TimelineZoomControls';
import { FilmstripTrack } from './FilmstripTrack';
import { RangeHandles } from './RangeHandles';
import { HoverTimeTooltip } from './HoverTimeTooltip';
import { formatTimeWithMs } from './formatTime';

export interface TimelineSliderProps {
  durationSec: number;
  startSec: number;
  endSec: number;
  currentSec: number;
  isPlaying?: boolean;
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
  isPlaying,
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

  const {
    zoom,
    isZoomed,
    isPanning,
    isCtrlPressed,
    scrollContainerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    centerOnTime,
    handleWheel,
    handlePanPointerDown,
    handlePanPointerMove,
    handlePanPointerUp,
    checkWasPanning,
  } = useTimelineZoom({
    effectiveDuration,
    currentSec,
    isPlaying,
  });

  const startPercent = Math.max(0, Math.min(100, (startSec / effectiveDuration) * 100)) || 0;
  const endPercent = Math.max(0, Math.min(100, (endSec / effectiveDuration) * 100)) || 0;
  const currentPercent = Math.max(0, Math.min(100, (currentSec / effectiveDuration) * 100)) || 0;

  const trackCursor = isPanning
    ? 'grabbing'
    : isCtrlPressed && isZoomed
    ? 'grab'
    : 'pointer';

  return (
    <div style={{ width: '100%', userSelect: 'none', padding: '12px 0 6px 0', position: 'relative' }}>
      {/* Time labels and zoom controls above track */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--text-dim)',
          marginBottom: '6px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>00:00.000</span>

        {/* Center: Live Current Playback Timestamp & Selected Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => isZoomed && centerOnTime(currentSec)}
            title={isZoomed ? 'Click to center seekbar on playhead' : undefined}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'inherit',
              font: 'inherit',
              cursor: isZoomed ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Current: <span style={{ color: 'var(--text-main)', fontWeight: 600, marginLeft: '4px' }}>{formatTimeWithMs(currentSec)}</span>
          </button>
          <span style={{ color: 'var(--border-glass)', opacity: 0.6 }}>•</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
            Selected: {formatTimeWithMs(Math.max(0, endSec - startSec))}
          </span>
        </div>

        {/* Right: Duration + Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TimelineZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetZoom={resetZoom}
          />
          <span>{formatTimeWithMs(effectiveDuration)}</span>
        </div>
      </div>

      {/* Floating Hover Tooltip Preview Card */}
      <HoverTimeTooltip
        hoverPos={hoverPos}
        dragging={dragging}
        hoverThumbnailSrc={hoverThumbnailSrc}
      />

      {/* Main Track Viewport Container (Zero scrollbar, horizontal scroll on zoom) */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="no-scrollbar"
        style={{
          width: '100%',
          overflowX: isZoomed ? 'auto' : 'hidden',
          overflowY: 'hidden',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          position: 'relative',
        }}
      >
        {/* Scalable Inner Track Container (Supports Ctrl+Drag to pan seekbar) */}
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            if ((e.ctrlKey || e.button === 1) && isZoomed) {
              handlePanPointerDown(e);
            }
          }}
          onClick={(e) => {
            if (e.ctrlKey || checkWasPanning()) return;
            handleTrackClick(e);
          }}
          onPointerMove={(e) => {
            if (isPanning) {
              handlePanPointerMove(e);
            } else {
              handlePointerMove(e);
            }
          }}
          onPointerUp={(e) => {
            if (isPanning) {
              handlePanPointerUp(e);
            } else {
              handlePointerUp(e);
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'relative',
            width: `${zoom * 100}%`,
            minWidth: '100%',
            height: '42px',
            cursor: trackCursor,
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
    </div>
  );
};
