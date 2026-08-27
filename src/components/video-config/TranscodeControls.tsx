import React from 'react';
import { GlassSelect } from '../GlassSelect';
import { ConfigState } from '../ConfigPanel';
import { Music, X, Zap } from 'lucide-react';

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
  croppedFilesCount?: number;
  onBrowseAudio?: () => void;
  onClearAudio?: () => void;
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
  croppedFilesCount = 0,
  onBrowseAudio,
  onClearAudio,
}) => {
  const isCombineMode = config.videoAction === 'COMBINE';
  const isSplitMode = config.videoAction === 'SPLIT';

  // In Combine mode, if combineFastCopy is active, all transcode options are bypassed/dimmed.
  // In Split mode, uncropped clips are bypassed while cropped clips use transcode settings.
  const isEffectivelyBypassed = isCombineMode
    ? !!config.combineFastCopy
    : (isFastCopyActive && croppedFilesCount === 0);

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
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            opacity: isEffectivelyBypassed ? 0.4 : 1,
            pointerEvents: isEffectivelyBypassed ? 'none' : 'auto',
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
                disabled={isEffectivelyBypassed}
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
              disabled={isEffectivelyBypassed}
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

      {/* AUDIO / SONG TRACK SECTION */}
      <div
        style={{
          opacity: isEffectivelyBypassed ? 0.4 : 1,
          pointerEvents: isEffectivelyBypassed ? 'none' : 'auto',
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
    </>
  );
};
