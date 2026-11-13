import React from 'react';
import { Repeat } from 'lucide-react';
import { GlassSelect } from '../ui/GlassSelect';
import { ConfigState } from '../../types/config';

export interface GifExportControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
}

/**
 * Controls rendered in Video Transcode & Trimmer views when GIF (`codecChoice === '4'`) is active.
 * Replaces Target Bitrate and Audio Track controls with GIF FPS, Palette Quality, and Infinite Loop.
 */
export const GifExportControls: React.FC<GifExportControlsProps> = ({ config, onChange }) => {
  const activeQuality = config.gifQuality || 'HIGH';
  const isLoopEnabled = config.gifLoop ?? true;

  return (
    <>
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.8px',
            display: 'block',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          GIF Frame Rate
        </span>
        <GlassSelect
          value={config.gifFps || '15'}
          onChange={(val) => onChange({ gifFps: val as ConfigState['gifFps'] })}
          options={[
            { value: '15', label: '15 FPS (Balanced Smoothness)' },
            { value: '10', label: '10 FPS (Compact File Size)' },
            { value: '24', label: '24 FPS (Cinema Smooth)' },
            { value: '30', label: '30 FPS (High Motion)' },
            { value: 'ORIGINAL', label: 'Original Source FPS' },
          ]}
        />
      </div>

      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.8px',
            display: 'block',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          Palette Quality
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {[
            { id: 'HIGH' as const, title: 'High Detail', subtitle: 'Diff Palette + Dither' },
            { id: 'BALANCED' as const, title: 'Compact Size', subtitle: 'Fast Smaller GIF' },
          ].map((preset) => {
            const isActive = activeQuality === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-tauri-drag-region={false}
                onClick={() => onChange({ gifQuality: preset.id })}
                style={{
                  padding: '9px 8px',
                  borderRadius: '10px',
                  border: isActive
                    ? '1px solid var(--accent-cyan)'
                    : '1px solid var(--border-glass)',
                  background: isActive ? 'var(--accent-primary-alpha)' : 'var(--input-bg)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  }}
                >
                  {preset.title}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-dim)',
                    marginTop: '2px',
                  }}
                >
                  {preset.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => onChange({ gifLoop: !isLoopEnabled })}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: '10px',
          border: isLoopEnabled
            ? '1px solid var(--accent-cyan)'
            : '1px solid var(--border-glass)',
          background: isLoopEnabled ? 'var(--accent-primary-alpha)' : 'var(--input-bg)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <Repeat size={14} style={{ color: isLoopEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
          Infinite Loop
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: isLoopEnabled ? 'var(--accent-cyan)' : 'var(--text-dim)',
          }}
        >
          {isLoopEnabled ? 'ON' : 'ONCE'}
        </span>
      </button>
    </>
  );
};

