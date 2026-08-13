import React from 'react';
import { GlassSelect } from '../GlassSelect';
import { ConfigState } from '../ConfigPanel';

interface ExtractFramesControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  fileCount: number;
  estimatedFramesCount: number;
}

export const ExtractFramesControls: React.FC<ExtractFramesControlsProps> = ({
  config,
  onChange,
  fileCount,
  estimatedFramesCount,
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
        gap: '14px',
      }}
    >
      {/* Output Image Format Selection */}
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
          Image Format
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {(['PNG', 'JPEG', 'WEBP'] as const).map((fmt) => {
            const isActive = config.frameOutputFormat === fmt;
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => onChange({ frameOutputFormat: fmt })}
                style={{
                  padding: '10px 6px',
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
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  }}
                >
                  {fmt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality Slider for JPEG / WEBP */}
      {config.frameOutputFormat !== 'PNG' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              Quality: {config.frameQuality}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={config.frameQuality}
            onChange={(e) => onChange({ frameQuality: parseInt(e.target.value, 10) })}
            style={{
              width: '100%',
              accentColor: 'var(--accent-cyan)',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {/* Frame Rate Presets Dropdown */}
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
          Frame Rate / Sampling
        </span>
        <GlassSelect
          value={config.frameRate}
          onChange={(val) =>
            onChange({ frameRate: val as 'MAX' | '30' | '10' | '5' | '1' })
          }
          options={[
            { value: 'MAX', label: 'Every Frame (Full Native FPS)' },
            { value: '30', label: '30 fps' },
            { value: '10', label: '10 fps' },
            { value: '5', label: '5 fps' },
            { value: '1', label: '1 fps (1 frame per second)' },
          ]}
        />
      </div>

      {/* Estimated Frame Count Info / Warning Card */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background:
            estimatedFramesCount > 10000
              ? 'var(--warning-bg)'
              : 'rgba(6, 182, 212, 0.08)',
          border: `1px solid ${
            estimatedFramesCount > 10000
              ? 'var(--warning-border)'
              : 'rgba(6, 182, 212, 0.2)'
          }`,
          color: estimatedFramesCount > 10000 ? 'var(--warning-text)' : 'var(--accent-cyan)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}
      >
        {estimatedFramesCount > 10000 ? (
          <>
            ⚠️ <strong>Large extraction</strong>: ~{estimatedFramesCount.toLocaleString()} frames
            estimated. A storage pre-check will run before starting.
          </>
        ) : (
          <>
            ℹ ~{estimatedFramesCount.toLocaleString()} frames estimated across {fileCount} video(s).
            Each video will create a dedicated <code>_frames/</code> subfolder.
          </>
        )}
      </div>
    </div>
  );
};
