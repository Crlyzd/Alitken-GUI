import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatTimeWithMs } from './formatTime';

export interface HoverTimeTooltipProps {
  hoverPos: { x: number; time: number } | null;
  dragging: 'start' | 'end' | 'playhead' | 'range' | null;
  hoverThumbnailSrc?: string | null;
}

export const HoverTimeTooltip: React.FC<HoverTimeTooltipProps> = ({
  hoverPos,
  dragging,
  hoverThumbnailSrc,
}) => {
  if (!hoverPos || dragging) return null;

  return (
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
            <Loader2 size={12} className="animate-spin" style={{ color: '#ffffff' }} />
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
  );
};
