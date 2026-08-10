import React from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { formatTimeWithMs } from '../TimelineSlider';
import { timeInputStyle } from '../../utils/trimmerUtils';

interface TrimmerStatusBarProps {
  inputStart: string;
  inputEnd: string;
  startSec: number;
  endSec: number;
  setInputStart: (val: string) => void;
  setInputEnd: (val: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onResetMarkers: () => void;
}

export const TrimmerStatusBar: React.FC<TrimmerStatusBarProps> = ({
  inputStart,
  inputEnd,
  startSec,
  endSec,
  setInputStart,
  setInputEnd,
  onStartBlur,
  onEndBlur,
  onResetMarkers,
}) => {
  return (
    <div
      className="glass-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        width: '100%',
        padding: '8px 12px',
        borderRadius: '12px',
        background: 'var(--bg-glass-card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glass)',
        gap: '10px',
      }}
    >
      {/* LEFT COLUMN: Clean In & Out Time Inputs (No Emojis/Icons) */}
      <div
        style={{
          justifySelf: 'start',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Start Time Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
            In:
          </span>
          <input
            type="text"
            value={inputStart}
            onChange={(e) => setInputStart(e.target.value)}
            onBlur={onStartBlur}
            onKeyDown={(e) => e.key === 'Enter' && onStartBlur()}
            style={{
              ...timeInputStyle,
              borderColor: 'rgba(6, 182, 212, 0.4)',
              color: 'var(--accent-cyan)',
            }}
            title="In-Point (HH:MM:SS.mmm or seconds)"
          />
        </div>

        {/* End Time Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#818cf8' }}>
            Out:
          </span>
          <input
            type="text"
            value={inputEnd}
            onChange={(e) => setInputEnd(e.target.value)}
            onBlur={onEndBlur}
            onKeyDown={(e) => e.key === 'Enter' && onEndBlur()}
            style={{
              ...timeInputStyle,
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: '#818cf8',
            }}
            title="Out-Point (HH:MM:SS.mmm or seconds)"
          />
        </div>
      </div>

      {/* CENTER COLUMN: Centered Trimmed Duration Badge */}
      <div
        style={{
          justifySelf: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '20px',
          background: 'var(--bg-glass-card)',
          border: '1px solid var(--border-glass)',
          fontSize: '11.5px',
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
        }}
      >
        <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
        <span>Duration:</span>
        <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 700 }}>
          {formatTimeWithMs(Math.max(0, endSec - startSec))}
        </strong>
      </div>

      {/* RIGHT COLUMN: Reset Markers Action Button */}
      <div
        style={{
          justifySelf: 'end',
          whiteSpace: 'nowrap',
        }}
      >
        <button
          type="button"
          onClick={onResetMarkers}
          title="Reset In/Out markers to full video length"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '6px',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-cyan)';
            e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border-glass)';
          }}
        >
          <RotateCcw size={12} /> Reset Markers
        </button>
      </div>
    </div>
  );
};
