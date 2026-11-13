import React from 'react';
import { Repeat, Sparkles } from 'lucide-react';
import { ImageConfig } from '../../types/media';

export interface VideoGifOptionsProps {
  config: ImageConfig;
  onChange: (updated: ImageConfig) => void;
}

/**
 * Animated GIF loop and transparency toggles rendered inside VideoControls when
 * videoOutputFormat === 'GIF'. Replaces Background Audio (GIF has no audio stream).
 */
export const VideoGifOptions: React.FC<VideoGifOptionsProps> = ({ config, onChange }) => {
  const isLoop = config.gifLoop ?? true;
  const isTransparent = config.gifTransparent ?? false;

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 11px',
    borderRadius: '8px',
    border: active ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
    background: active ? 'var(--accent-primary-alpha)' : 'transparent',
    color: 'var(--text-main)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label className="image-config-section-label" style={{ marginBottom: 0 }}>
        GIF Animation Options
      </label>

      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => onChange({ ...config, gifLoop: !isLoop })}
        style={toggleStyle(isLoop)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600 }}>
          <Repeat size={13} style={{ color: isLoop ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
          Infinite Loop
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: isLoop ? 'var(--accent-cyan)' : 'var(--text-dim)',
          }}
        >
          {isLoop ? 'ON' : 'ONCE'}
        </span>
      </button>

      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => onChange({ ...config, gifTransparent: !isTransparent })}
        style={toggleStyle(isTransparent)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600 }}>
          <Sparkles size={13} style={{ color: isTransparent ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
          Transparent Background
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: isTransparent ? 'var(--accent-cyan)' : 'var(--text-dim)',
          }}
        >
          {isTransparent ? 'ALPHA' : 'BLACK'}
        </span>
      </button>
    </div>
  );
};

