import React from 'react';
import { GlassSelect } from '../ui/GlassSelect';
import { ConfigState } from '../../types/config';

export interface ResolutionSelectorProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  isEffectivelyBypassed: boolean;
  isCustomHeight: boolean;
  setIsCustomHeight: (val: boolean) => void;
  PRESET_HEIGHTS: string[];
}

export const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  config,
  onChange,
  isEffectivelyBypassed,
  isCustomHeight,
  setIsCustomHeight,
  PRESET_HEIGHTS,
}) => {
  const isGifMode =
    config.codecChoice === '4' && config.videoAction !== 'SPLIT' && config.videoAction !== 'COMBINE';
  const maxCustomHeight = isGifMode ? 720 : 8192;
  const fallbackCustomHeight = isGifMode ? '720' : '1080';

  const resolutionOptions = isGifMode
    ? [
        { value: '720', label: '720p HD' },
        { value: '480', label: '480p SD' },
        { value: 'CUSTOM', label: 'Custom Height (px)...' },
      ]
    : [
        { value: 'ORIGINAL', label: 'Original Resolution' },
        { value: '2160', label: '4K Ultra HD (2160p)' },
        { value: '1440', label: '2K QHD (1440p)' },
        { value: '1080', label: '1080p Full HD' },
        { value: '720', label: '720p HD' },
        { value: '480', label: '480p SD' },
        { value: 'CUSTOM', label: 'Custom Height (px)...' },
      ];

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
        Target Resolution
      </span>
      <GlassSelect
        value={isCustomHeight ? 'CUSTOM' : config.targetHeight}
        disabled={isEffectivelyBypassed}
        onChange={(val) => {
          if (val === 'CUSTOM') {
            setIsCustomHeight(true);
            const currentNum = parseInt(config.targetHeight, 10);
            if (
              PRESET_HEIGHTS.includes(config.targetHeight) ||
              isNaN(currentNum) ||
              currentNum > maxCustomHeight
            ) {
              onChange({ targetHeight: fallbackCustomHeight });
            }
          } else {
            setIsCustomHeight(false);
            onChange({ targetHeight: val });
          }
        }}
        options={resolutionOptions}
      />
      {isCustomHeight && (
        <div style={{ marginTop: '8px' }}>
          <input
            type="number"
            min="144"
            max={maxCustomHeight}
            disabled={isEffectivelyBypassed}
            placeholder={`Custom height (144 - ${maxCustomHeight} px)`}
            value={config.targetHeight === 'CUSTOM' ? fallbackCustomHeight : config.targetHeight}
            onChange={(e) => {
              const raw = e.target.value;
              const num = parseInt(raw, 10);
              if (!isNaN(num) && num > maxCustomHeight) {
                onChange({ targetHeight: String(maxCustomHeight) });
              } else {
                onChange({ targetHeight: raw });
              }
            }}
            onBlur={() => {
              const num = parseInt(config.targetHeight, 10);
              if (isNaN(num) || num < 144) {
                onChange({ targetHeight: '144' });
              } else if (num > maxCustomHeight) {
                onChange({ targetHeight: String(maxCustomHeight) });
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
