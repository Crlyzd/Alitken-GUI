import React from 'react';
import { Zap, Info } from 'lucide-react';
import { ConfigState } from '../ConfigPanel';

interface SplitControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  croppedFilesCount?: number;
}

export const SplitControls: React.FC<SplitControlsProps> = ({
  config,
  onChange,
  croppedFilesCount = 0,
}) => {
  return (
    <div
      style={{
        padding: '14px',
        borderRadius: '12px',
        background: 'var(--bg-glass-card)',
        border: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap
            size={16}
            style={{
              color: config.splitFastCopy ? 'var(--accent-cyan)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
              Lossless Copy
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              0% quality loss, 100x rendering speed with zero encoding overhead.
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={config.splitFastCopy}
          onChange={(e) => onChange({ splitFastCopy: e.target.checked })}
          style={{
            width: '16px',
            height: '16px',
            accentColor: 'var(--accent-cyan)',
            cursor: 'pointer',
          }}
        />
      </label>

      {config.splitFastCopy && croppedFilesCount > 0 && (
        <div
          style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={14} color="#c084fc" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: '1.3' }}>
            <strong style={{ color: '#c084fc' }}>{croppedFilesCount} cropped clip{croppedFilesCount > 1 ? 's' : ''}</strong> will use GPU transcode below.
          </span>
        </div>
      )}

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <button
          type="button"
          onClick={() => onChange({ splitMode: 'DURATION' })}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            background:
              config.splitMode === 'DURATION' ? 'var(--accent-primary)' : 'transparent',
            color: config.splitMode === 'DURATION' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          By Duration (Sec)
        </button>
        <button
          type="button"
          onClick={() => onChange({ splitMode: 'PARTS' })}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            background:
              config.splitMode === 'PARTS' ? 'var(--accent-primary)' : 'transparent',
            color: config.splitMode === 'PARTS' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          By Equal Parts
        </button>
      </div>

      <div>
        <label
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          {config.splitMode === 'DURATION'
            ? 'Segment Length (Seconds):'
            : 'Number of Equal Parts:'}
        </label>
        <input
          type="number"
          min="1"
          value={config.splitValue}
          onChange={(e) => {
            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
            onChange({ splitValue: val });
          }}
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-main)',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
};
