import React, { useState } from 'react';
import { ImageConfig } from '../../types/media';
import { FileImage, Film, Music } from 'lucide-react';
import { GlassSelect } from '../GlassSelect';

export interface VideoControlsProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
  fileCount: number;
  onBrowseAudio: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  config,
  onChange,
  fileCount,
  onBrowseAudio,
}) => {
  const [isCustomFpsMode, setIsCustomFpsMode] = useState<boolean>(
    ![24, 30, 60].includes(config.videoFps)
  );

  return (
    <div className="image-config-panel-card">
      {/* VIDEO CONVERSION MODE SELECTOR */}
      <div>
        <label className="image-config-section-label">Conversion Mode</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onChange({ ...config, videoMode: 'SLIDESHOW' })}
            style={{
              padding: '8px 6px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '8px',
              border:
                config.videoMode === 'SLIDESHOW' || !config.videoMode
                  ? '1px solid var(--accent-cyan)'
                  : '1px solid var(--border-glass)',
              background:
                config.videoMode === 'SLIDESHOW' || !config.videoMode
                  ? 'var(--accent-primary)'
                  : 'transparent',
              color:
                config.videoMode === 'SLIDESHOW' || !config.videoMode
                  ? '#ffffff'
                  : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}
          >
            <FileImage size={13} /> Photo Slideshow
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, videoMode: 'SEQUENCE' })}
            style={{
              padding: '8px 6px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '8px',
              border:
                config.videoMode === 'SEQUENCE'
                  ? '1px solid var(--accent-cyan)'
                  : '1px solid var(--border-glass)',
              background:
                config.videoMode === 'SEQUENCE'
                  ? 'var(--accent-primary)'
                  : 'transparent',
              color:
                config.videoMode === 'SEQUENCE'
                  ? '#ffffff'
                  : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}
          >
            <Film size={13} /> Image Sequence
          </button>
        </div>
      </div>

      {/* DURATION PER IMAGE (SLIDESHOW MODE) OR SEQUENCE INFO */}
      {config.videoMode === 'SEQUENCE' ? (
        <div className="image-config-sequence-info">
          Each image is treated as 1 frame.
          {fileCount > 0 && (
            <div className="image-config-sequence-duration">
              Expected Duration: {(fileCount / config.videoFps).toFixed(2)}s ({fileCount} frames @{' '}
              {config.videoFps} FPS)
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="image-config-section-label">
            {fileCount > 1 ? 'Duration Per Image (Seconds)' : 'Video Clip Duration (Seconds)'}
          </label>
          <input
            type="number"
            min="1"
            max="3600"
            value={config.videoDurationSec}
            onChange={(e) =>
              onChange({
                ...config,
                videoDurationSec: Math.max(1, parseInt(e.target.value, 10) || 5),
              })
            }
            className="image-config-number-input"
          />
        </div>
      )}

      {/* FPS SELECTOR */}
      <div>
        <label className="image-config-section-label">Frame Rate (FPS)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[24, 30, 60].map((fps) => {
            const isActive = !isCustomFpsMode && config.videoFps === fps;
            return (
              <button
                key={fps}
                type="button"
                onClick={() => {
                  setIsCustomFpsMode(false);
                  onChange({ ...config, videoFps: fps });
                }}
                className={`image-config-scale-btn ${isActive ? 'active' : ''}`}
              >
                {fps} FPS
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustomFpsMode(true)}
            className={`image-config-scale-btn ${
              isCustomFpsMode || ![24, 30, 60].includes(config.videoFps) ? 'active' : ''
            }`}
          >
            Custom
          </button>
        </div>

        {(isCustomFpsMode || ![24, 30, 60].includes(config.videoFps)) && (
          <div>
            <input
              type="number"
              min="1"
              max="240"
              value={config.videoFps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val)) {
                  onChange({ ...config, videoFps: 30 });
                } else {
                  const clamped = Math.min(240, Math.max(1, val));
                  onChange({ ...config, videoFps: clamped });
                }
              }}
              placeholder="Enter FPS (1 - 240)"
              className="image-config-number-input custom-active"
            />
          </div>
        )}
      </div>

      {/* RESOLUTION SELECT */}
      <div>
        <label className="image-config-section-label">Video Resolution</label>
        <GlassSelect
          value={config.videoResolution}
          onChange={(val) => onChange({ ...config, videoResolution: val as any })}
          options={[
            { value: '1080p', label: '1080p Full HD (1920x1080)' },
            { value: '4k', label: '4K Ultra HD (3840x2160)' },
            { value: '720p', label: '720p HD (1280x720)' },
            { value: 'ORIGINAL', label: 'Original Image Resolution (Padded)' },
          ]}
        />
      </div>

      {/* BACKGROUND AUDIO */}
      <div>
        <label className="image-config-section-label">Background Audio (Optional)</label>
        <div className="image-config-audio-row">
          <input
            type="text"
            readOnly
            value={config.audioPath ? config.audioPath.split(/[\\/]/).pop() : 'No audio attached'}
            className={`image-config-audio-input ${
              config.audioPath ? 'attached' : 'empty'
            }`}
          />
          <button onClick={onBrowseAudio} className="image-config-btn-secondary">
            <Music size={13} /> Select
          </button>
        </div>
      </div>
    </div>
  );
};
