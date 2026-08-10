import React from 'react';
import { Clock, RotateCcw, Lock, Unlock } from 'lucide-react';
import { timeInputStyle } from '../../utils/trimmerUtils';

interface TrimmerStatusBarProps {
  inputStart: string;
  inputEnd: string;
  inputDuration: string;
  isDurationLocked: boolean;
  setInputStart: (val: string) => void;
  setInputEnd: (val: string) => void;
  setInputDuration: (val: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onDurationBlur: () => void;
  onToggleDurationLock: () => void;
  onResetMarkers: () => void;
}

export const TrimmerStatusBar: React.FC<TrimmerStatusBarProps> = ({
  inputStart,
  inputEnd,
  inputDuration,
  isDurationLocked,
  setInputStart,
  setInputEnd,
  setInputDuration,
  onStartBlur,
  onEndBlur,
  onDurationBlur,
  onToggleDurationLock,
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

      {/* CENTER COLUMN: Editable Trimmed Duration Badge */}
      <div
        style={{
          justifySelf: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'var(--bg-glass-card)',
          border: isDurationLocked
            ? '1px solid rgba(6, 182, 212, 0.6)'
            : '1px solid var(--border-glass)',
          boxShadow: isDurationLocked
            ? '0 0 10px rgba(6, 182, 212, 0.25)'
            : 'none',
          fontSize: '11.5px',
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s ease',
        }}
      >
        <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
        <span>Duration:</span>
        <input
          type="text"
          value={inputDuration}
          onChange={(e) => setInputDuration(e.target.value)}
          onBlur={onDurationBlur}
          onKeyDown={(e) => e.key === 'Enter' && onDurationBlur()}
          style={{
            ...timeInputStyle,
            borderColor: isDurationLocked ? 'rgba(6, 182, 212, 0.6)' : 'rgba(255, 255, 255, 0.15)',
            color: 'var(--text-main)',
            fontWeight: 700,
            width: '90px',
          }}
          title="Editable Duration (HH:MM:SS.mmm or seconds). Editing locks clip length."
        />
        <button
          type="button"
          onClick={onToggleDurationLock}
          title={isDurationLocked ? 'Duration is locked (Click to unlock)' : 'Duration is unlocked (Click to lock)'}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: isDurationLocked ? 'var(--accent-cyan)' : 'var(--text-dim)',
            transition: 'color 0.15s ease',
          }}
        >
          {isDurationLocked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
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
