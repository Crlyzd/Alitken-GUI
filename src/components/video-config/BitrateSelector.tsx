import React from 'react';
import { GlassSelect } from '../ui/GlassSelect';
import { ConfigState } from '../../types/config';

export interface BitrateSelectorProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  isEffectivelyBypassed: boolean;
  isCustomBitrate: boolean;
  setIsCustomBitrate: (val: boolean) => void;
  PRESET_BITRATES: string[];
}

export const BitrateSelector: React.FC<BitrateSelectorProps> = ({
  config,
  onChange,
  isEffectivelyBypassed,
  isCustomBitrate,
  setIsCustomBitrate,
  PRESET_BITRATES,
}) => {
  return (
    <div
      style={{
        opacity: isEffectivelyBypassed ? 0.4 : 1,
        pointerEvents: isEffectivelyBypassed ? 'none' : 'auto',
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
        disabled={isEffectivelyBypassed}
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
            disabled={isEffectivelyBypassed}
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
  );
};
