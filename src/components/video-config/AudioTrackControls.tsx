import React from 'react';
import { Music, X } from 'lucide-react';
import { ConfigState } from '../../types/config';

export interface AudioTrackControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  isAudioBypassed: boolean;
  onBrowseAudio?: () => void;
  onClearAudio?: () => void;
}

export const AudioTrackControls: React.FC<AudioTrackControlsProps> = ({
  config,
  onChange,
  isAudioBypassed,
  onBrowseAudio,
  onClearAudio,
}) => {
  return (
    <div
      style={{
        opacity: isAudioBypassed ? 0.4 : 1,
        pointerEvents: isAudioBypassed ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}
    >
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
          Audio / Song Track
        </span>
        {config.audioPath && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--accent-cyan)',
              fontWeight: 600,
              background: 'rgba(6, 182, 212, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Music size={11} /> Replaces Audio
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            readOnly
            value={
              config.audioPath
                ? config.audioPath.split(/[\\/]/).pop() || 'Custom Audio Attached'
                : 'Original Video Audio (Stream Copy)'
            }
            title={config.audioPath || 'Original Video Audio'}
            style={{
              width: '100%',
              background: config.audioPath ? 'rgba(6, 182, 212, 0.1)' : 'rgba(0, 0, 0, 0.25)',
              border: config.audioPath
                ? '1px solid var(--accent-cyan)'
                : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px 10px 8px 30px',
              color: config.audioPath ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: config.audioPath ? 600 : 400,
              boxSizing: 'border-box',
              outline: 'none',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          />
          <Music
            size={14}
            style={{
              position: 'absolute',
              left: '9px',
              color: config.audioPath ? 'var(--accent-cyan)' : 'var(--text-dim)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {config.audioPath && onClearAudio && (
          <button
            type="button"
            onClick={onClearAudio}
            title="Remove song and restore original audio"
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            }}
          >
            <X size={13} />
          </button>
        )}

        {onBrowseAudio && (
          <button
            type="button"
            onClick={onBrowseAudio}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              background: 'var(--input-bg)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-glass)';
            }}
          >
            {config.audioPath ? 'Change' : 'Select Song'}
          </button>
        )}
      </div>

      {/* FADE IN & FADE OUT CONTROLS (Active when audio is attached) */}
      {config.audioPath && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: config.audioFadeIn ? 'rgba(6, 182, 212, 0.12)' : 'rgba(0, 0, 0, 0.15)',
              border: config.audioFadeIn
                ? '1px solid rgba(6, 182, 212, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              color: config.audioFadeIn ? 'var(--text-main)' : 'var(--text-muted)',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={config.audioFadeIn || false}
              onChange={(e) => onChange({ audioFadeIn: e.target.checked })}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            Fade In (1.5s)
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: config.audioFadeOut ? 'rgba(6, 182, 212, 0.12)' : 'rgba(0, 0, 0, 0.15)',
              border: config.audioFadeOut
                ? '1px solid rgba(6, 182, 212, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              color: config.audioFadeOut ? 'var(--text-main)' : 'var(--text-muted)',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={config.audioFadeOut || false}
              onChange={(e) => onChange({ audioFadeOut: e.target.checked })}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            Fade Out (1.5s)
          </label>
        </div>
      )}
    </div>
  );
};
