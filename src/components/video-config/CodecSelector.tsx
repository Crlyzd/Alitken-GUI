import React from 'react';
import { Zap } from 'lucide-react';
import { ConfigState } from '../../types/config';

export interface CodecSelectorProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  isEffectivelyBypassed: boolean;
  isFastCopyActive: boolean;
  isSplitMode: boolean;
  croppedFilesCount: number;
}

export const CodecSelector: React.FC<CodecSelectorProps> = ({
  config,
  onChange,
  isEffectivelyBypassed,
  isFastCopyActive,
  isSplitMode,
  croppedFilesCount,
}) => {
  const showGifCard = !isSplitMode && config.videoAction !== 'COMBINE';
  const codecs = [
    { id: '1', title: 'H.264', subtitle: 'Universal' },
    { id: '2', title: 'H.265', subtitle: 'HEVC High Comp' },
    { id: '3', title: 'AV1', subtitle: 'Next-Gen Open' },
    ...(showGifCard ? [{ id: '4', title: 'GIF', subtitle: 'Animated Loop' }] : []),
  ];

  return (
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Target Codec
        </span>
        {isFastCopyActive && isSplitMode && croppedFilesCount > 0 && (
          <span
            style={{
              fontSize: '10px',
              color: '#c084fc',
              fontWeight: 600,
              background: 'rgba(168, 85, 247, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Zap size={10} /> Active for {croppedFilesCount} Cropped Clip{croppedFilesCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${codecs.length}, 1fr)`,
          gap: '8px',
          opacity: isEffectivelyBypassed ? 0.4 : 1,
          pointerEvents: isEffectivelyBypassed ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        {codecs.map((codec) => {
          const isActive = config.codecChoice === codec.id;
          return (
            <button
              key={codec.id}
              type="button"
              data-tauri-drag-region={false}
              disabled={isEffectivelyBypassed}
              onClick={() => {
                const parsedHeight = parseInt(config.targetHeight, 10);
                if (
                  codec.id === '4' &&
                  (config.targetHeight === 'ORIGINAL' || (!isNaN(parsedHeight) && parsedHeight > 720))
                ) {
                  onChange({ codecChoice: '4', targetHeight: '720' });
                } else {
                  onChange({ codecChoice: codec.id });
                }
              }}
              style={{
                padding: codecs.length === 4 ? '10px 4px' : '10px 6px',
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
  );
};
