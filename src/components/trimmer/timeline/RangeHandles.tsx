import React from 'react';
import { formatTimeWithMs } from './formatTime';

export interface RangeHandlesProps {
  startPercent: number;
  endPercent: number;
  currentPercent: number;
  startSec: number;
  endSec: number;
  currentSec: number;
  dragging: 'start' | 'end' | 'playhead' | 'range' | null;
  isShiftPressed?: boolean;
  onPointerDown: (type: 'start' | 'end' | 'playhead' | 'range', e: React.PointerEvent) => void;
}

export const RangeHandles: React.FC<RangeHandlesProps> = ({
  startPercent,
  endPercent,
  currentPercent,
  startSec,
  endSec,
  currentSec,
  dragging,
  isShiftPressed = false,
  onPointerDown,
}) => {
  return (
    <>
      {/* Selected Clip Highlight Track */}
      <div
        onPointerDown={(e) => onPointerDown('range', e)}
        title="Selected Range (Click to seek • Shift + Drag to move range)"
        style={{
          position: 'absolute',
          left: `${startPercent}%`,
          width: `${Math.max(0, endPercent - startPercent)}%`,
          height: '100%',
          background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.28) 0%, rgba(99, 102, 241, 0.28) 100%)',
          borderTop: '2px solid var(--accent-cyan)',
          borderBottom: '2px solid var(--accent-cyan)',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.35)',
          cursor: dragging === 'range' ? 'grabbing' : isShiftPressed ? 'grab' : 'pointer',
          zIndex: 5,
        }}
      />

      {/* In-Point (Start) Handle */}
      <div
        onPointerDown={(e) => onPointerDown('start', e)}
        title={`In-Point: ${formatTimeWithMs(startSec)} (Drag to trim start)`}
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
        onPointerDown={(e) => onPointerDown('end', e)}
        title={`Out-Point: ${formatTimeWithMs(endSec)} (Drag to trim end)`}
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
        onPointerDown={(e) => onPointerDown('playhead', e)}
        title={`Playhead: ${formatTimeWithMs(currentSec)} (Drag to scrub)`}
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
    </>
  );
};
