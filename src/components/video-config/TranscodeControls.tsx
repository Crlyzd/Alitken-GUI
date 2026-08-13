import React from 'react';
import { GlassSelect } from '../GlassSelect';
import { ConfigState } from '../ConfigPanel';

interface TranscodeControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  isFastCopyActive: boolean;
  isCustomHeight: boolean;
  setIsCustomHeight: (val: boolean) => void;
  isCustomBitrate: boolean;
  setIsCustomBitrate: (val: boolean) => void;
  PRESET_HEIGHTS: string[];
  PRESET_BITRATES: string[];
}

export const TranscodeControls: React.FC<TranscodeControlsProps> = ({
  config,
  onChange,
  isFastCopyActive,
  isCustomHeight,
  setIsCustomHeight,
  isCustomBitrate,
  setIsCustomBitrate,
  PRESET_HEIGHTS,
  PRESET_BITRATES,
}) => {
  return (
    <>
      {/* TARGET CODEC SECTION */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
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
            Target Codec
          </span>
          {isFastCopyActive && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--accent-cyan)',
                fontWeight: 600,
              }}
            >
              Bypassed (-c copy)
            </span>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            opacity: isFastCopyActive ? 0.4 : 1,
            pointerEvents: isFastCopyActive ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          {[
            { id: '1', title: 'H.264', subtitle: 'Universal' },
            { id: '2', title: 'H.265', subtitle: 'HEVC High Comp' },
            { id: '3', title: 'AV1', subtitle: 'Next-Gen Open' },
          ].map((codec) => {
            const isActive = config.codecChoice === codec.id;
            return (
              <button
                key={codec.id}
                type="button"
                disabled={isFastCopyActive}
                onClick={() => onChange({ codecChoice: codec.id })}
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
                  {codec.title}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-dim)',
                    marginTop: '2px',
                  }}
                >
                  {codec.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TARGET RESOLUTION SECTION */}
      <div
        style={{
          opacity: isFastCopyActive ? 0.4 : 1,
          pointerEvents: isFastCopyActive ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
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
          Target Resolution
        </span>
        <GlassSelect
          value={isCustomHeight ? 'CUSTOM' : config.targetHeight}
          disabled={isFastCopyActive}
          onChange={(val) => {
            if (val === 'CUSTOM') {
              setIsCustomHeight(true);
              if (PRESET_HEIGHTS.includes(config.targetHeight)) {
                onChange({ targetHeight: '1080' });
              }
            } else {
              setIsCustomHeight(false);
              onChange({ targetHeight: val });
            }
          }}
          options={[
            { value: 'ORIGINAL', label: 'Original Resolution' },
            { value: '2160', label: '4K Ultra HD (2160p)' },
            { value: '1440', label: '2K QHD (1440p)' },
            { value: '1080', label: '1080p Full HD' },
            { value: '720', label: '720p HD' },
            { value: '480', label: '480p SD' },
            { value: 'CUSTOM', label: 'Custom Height (px)...' },
          ]}
        />
        {isCustomHeight && (
          <div style={{ marginTop: '8px' }}>
            <input
              type="number"
              min="144"
              max="8192"
              disabled={isFastCopyActive}
              placeholder="Custom height (144 - 8192 px)"
              value={config.targetHeight === 'CUSTOM' ? '1080' : config.targetHeight}
              onChange={(e) => onChange({ targetHeight: e.target.value })}
              onBlur={() => {
                const num = parseInt(config.targetHeight, 10);
                if (isNaN(num) || num < 144) {
                  onChange({ targetHeight: '144' });
                } else if (num > 8192) {
                  onChange({ targetHeight: '8192' });
                }
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
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* TARGET BITRATE / QUALITY SECTION */}
      <div
        style={{
          opacity: isFastCopyActive ? 0.4 : 1,
          pointerEvents: isFastCopyActive ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
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
          Target Bitrate / Quality
        </span>
        <GlassSelect
          value={isCustomBitrate ? 'CUSTOM' : config.targetBitrate}
          disabled={isFastCopyActive}
          onChange={(val) => {
            if (val === 'CUSTOM') {
              setIsCustomBitrate(true);
              if (PRESET_BITRATES.includes(config.targetBitrate)) {
                onChange({ targetBitrate: '5000' });
              }
            } else {
              setIsCustomBitrate(false);
              onChange({ targetBitrate: val });
            }
          }}
          options={[
            { value: 'ORIGINAL', label: 'Auto / Quality Preserving (CRF 23)' },
            { value: '20000', label: 'Ultra High (20 Mbps)' },
            { value: '15000', label: 'Very High (15 Mbps)' },
            { value: '10000', label: 'High (10 Mbps)' },
            { value: '5000', label: 'Medium (5 Mbps)' },
            { value: '2000', label: 'Low (2 Mbps)' },
            { value: '1000', label: 'Min (1 Mbps)' },
            { value: 'CUSTOM', label: 'Custom Bitrate (kbps)...' },
          ]}
        />
        {isCustomBitrate && (
          <div style={{ marginTop: '8px' }}>
            <input
              type="number"
              min="100"
              max="500000"
              disabled={isFastCopyActive}
              placeholder="Custom bitrate (100 - 500000 kbps)"
              value={config.targetBitrate === 'CUSTOM' ? '5000' : config.targetBitrate}
              onChange={(e) => onChange({ targetBitrate: e.target.value })}
              onBlur={() => {
                const num = parseInt(config.targetBitrate, 10);
                if (isNaN(num) || num < 100) {
                  onChange({ targetBitrate: '100' });
                } else if (num > 500000) {
                  onChange({ targetBitrate: '500000' });
                }
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
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>
    </>
  );
};
