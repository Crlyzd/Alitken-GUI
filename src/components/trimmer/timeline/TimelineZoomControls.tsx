import React from 'react';
import { ZoomIn, ZoomOut, Search } from 'lucide-react';

export interface TimelineZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const TimelineZoomControls: React.FC<TimelineZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const isZoomed = zoom > 1;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 4px',
        borderRadius: '6px',
        background: 'var(--bg-glass-card, rgba(255, 255, 255, 0.04))',
        border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
        boxShadow: isZoomed ? '0 0 8px rgba(6, 182, 212, 0.15)' : 'none',
        transition: 'all 0.2s ease',
      }}
      title="Timeline Zoom (Ctrl + Wheel to zoom, Ctrl + Drag to pan seekbar)"
    >
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 1}
        title="Zoom Out (Ctrl + Wheel Down)"
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          cursor: zoom <= 1 ? 'not-allowed' : 'pointer',
          color: zoom <= 1 ? 'var(--text-dim, rgba(255, 255, 255, 0.3))' : 'var(--text-muted, #94a3b8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          opacity: zoom <= 1 ? 0.4 : 1,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (zoom > 1) (e.currentTarget as HTMLElement).style.color = 'var(--accent-cyan, #06b6d4)';
        }}
        onMouseLeave={(e) => {
          if (zoom > 1) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted, #94a3b8)';
        }}
      >
        <ZoomOut size={12} />
      </button>

      {/* Zoom Badge / Reset Button */}
      <button
        type="button"
        onClick={onResetZoom}
        title={isZoomed ? 'Reset zoom to 1.0x (Ctrl + Drag seekbar to pan)' : 'Zoom level (Ctrl + Wheel to zoom)'}
        style={{
          background: isZoomed ? 'rgba(6, 182, 212, 0.15)' : 'none',
          border: isZoomed ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
          padding: '1px 5px',
          cursor: isZoomed ? 'pointer' : 'default',
          color: isZoomed ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-dim, rgba(255, 255, 255, 0.4))',
          fontSize: '10px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          transition: 'all 0.15s ease',
        }}
      >
        <Search size={10} style={{ opacity: isZoomed ? 1 : 0.6 }} />
        <span>{zoom.toFixed(1)}x</span>
      </button>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 10}
        title="Zoom In (Ctrl + Wheel Up)"
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          cursor: zoom >= 10 ? 'not-allowed' : 'pointer',
          color: zoom >= 10 ? 'var(--text-dim, rgba(255, 255, 255, 0.3))' : 'var(--text-muted, #94a3b8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          opacity: zoom >= 10 ? 0.4 : 1,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (zoom < 10) (e.currentTarget as HTMLElement).style.color = 'var(--accent-cyan, #06b6d4)';
        }}
        onMouseLeave={(e) => {
          if (zoom < 10) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted, #94a3b8)';
        }}
      >
        <ZoomIn size={12} />
      </button>
    </div>
  );
};
