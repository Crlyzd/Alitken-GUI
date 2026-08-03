import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ImageConfig, ImageOutputFormat } from '../types/media';
import { Folder, Sparkles, Music, Film, FileText, FileImage } from 'lucide-react';

interface ImageConfigTabProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
  onStart: () => void;
  disabled: boolean;
  fileCount: number;
}

export const ImageConfigTab: React.FC<ImageConfigTabProps> = ({
  config,
  onChange,
  onStart,
  disabled,
  fileCount,
}) => {
  const handleBrowseOutputFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        onChange({ ...config, outputDir: selected });
      }
    } catch (err) {
      console.error('Directory picker error:', err);
    }
  };

  const handleBrowseAudio = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] }],
      });
      if (selected && typeof selected === 'string') {
        onChange({ ...config, audioPath: selected });
      }
    } catch (err) {
      console.error('Audio file picker error:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '18px',
        minHeight: 0,
      }}
    >
      {/* Scrollable Form Settings */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          paddingRight: '4px',
        }}
      >
        {/* TARGET FORMAT SELECTION */}
        <div>
          <label
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
            Target Output Format
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {(['JPG', 'PDF', 'PNG', 'WEBP', 'VIDEO'] as ImageOutputFormat[]).map((fmt) => {
              const isActive = config.outputFormat === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => onChange({ ...config, outputFormat: fmt })}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: isActive
                      ? '1px solid var(--accent-cyan)'
                      : '1px solid var(--border-glass)',
                    background: isActive ? 'var(--bg-glass-hover)' : 'var(--bg-glass-card)',
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {fmt === 'VIDEO' ? (
                    <Film size={14} />
                  ) : fmt === 'PDF' ? (
                    <FileText size={14} />
                  ) : (
                    <FileImage size={14} />
                  )}
                  {fmt === 'VIDEO' ? 'MP4' : fmt}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- FORMAT SPECIFIC CONTROLS --- */}

        {/* 1. JPG CONTROLS */}
        {config.outputFormat === 'JPG' && (
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--bg-glass-card)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.8px',
                display: 'block',
                marginBottom: '10px',
                textTransform: 'uppercase',
              }}
            >
              JPG Quality Compression
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                { label: 'Original', val: null },
                { label: '80% High', val: 80 },
                { label: '60% Med', val: 60 },
                { label: '40% Low', val: 40 },
                { label: '20% Min', val: 20 },
              ].map((item) => {
                const isActive = config.jpgQuality === item.val;
                return (
                  <button
                    key={item.label}
                    onClick={() => onChange({ ...config, jpgQuality: item.val })}
                    style={{
                      padding: '8px 4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: isActive
                        ? '1px solid var(--accent-cyan)'
                        : '1px solid var(--border-glass)',
                      background: isActive ? 'var(--accent-primary)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. PDF CONTROLS */}
        {config.outputFormat === 'PDF' && (
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
            {fileCount > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Merge into Single PDF
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Combines all {fileCount} images into one multi-page PDF document
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.mergePdf}
                  onChange={(e) => onChange({ ...config, mergePdf: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                />
              </div>
            )}

            <div>
              <label
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
                Target PDF Quality
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Original', val: null },
                  { label: '90% Best', val: 90 },
                  { label: '80% High', val: 80 },
                  { label: '60% Med', val: 60 },
                  { label: '50% Low', val: 50 },
                ].map((item) => {
                  const isActive = config.pdfQuality === item.val;
                  return (
                    <button
                      key={item.label}
                      onClick={() => onChange({ ...config, pdfQuality: item.val })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: isActive
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-glass)',
                        background: isActive ? 'var(--accent-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
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
                Target PDF Resolution / Scale
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Original', val: null },
                  { label: '80% Scale', val: 80 },
                  { label: '50% Scale', val: 50 },
                  { label: '30% Scale', val: 30 },
                ].map((item) => {
                  const isActive = config.pdfScalePercent === item.val;
                  return (
                    <button
                      key={item.label}
                      onClick={() => onChange({ ...config, pdfScalePercent: item.val })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: isActive
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-glass)',
                        background: isActive ? 'var(--accent-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. WEBP CONTROLS */}
        {config.outputFormat === 'WEBP' && (
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
            <div>
              <label
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
                WebP Compression Quality ({config.webQuality}%)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={config.webQuality}
                onChange={(e) => onChange({ ...config, webQuality: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label
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
                Resolution Scale
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Original', val: null },
                  { label: '80%', val: 80 },
                  { label: '50%', val: 50 },
                  { label: '30%', val: 30 },
                ].map((item) => {
                  const isActive = config.webScalePercent === item.val;
                  return (
                    <button
                      key={item.label}
                      onClick={() => onChange({ ...config, webScalePercent: item.val })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: isActive
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-glass)',
                        background: isActive ? 'var(--accent-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. PNG CONTROLS */}
        {config.outputFormat === 'PNG' && (
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--bg-glass-card)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              PNG conversion outputs uncompressed, lossless Portable Network Graphics format.
            </p>
          </div>
        )}

        {/* 5. VIDEO (MP4) CONTROLS */}
        {config.outputFormat === 'VIDEO' && (
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
            {/* VIDEO CONVERSION MODE SELECTOR */}
            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Conversion Mode
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, videoMode: 'SLIDESHOW' })}
                  style={{
                    padding: '8px 6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: config.videoMode === 'SLIDESHOW' || !config.videoMode
                      ? '1px solid var(--accent-cyan)'
                      : '1px solid var(--border-glass)',
                    background: config.videoMode === 'SLIDESHOW' || !config.videoMode
                      ? 'var(--accent-primary)'
                      : 'transparent',
                    color: config.videoMode === 'SLIDESHOW' || !config.videoMode
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
                    border: config.videoMode === 'SEQUENCE'
                      ? '1px solid var(--accent-cyan)'
                      : '1px solid var(--border-glass)',
                    background: config.videoMode === 'SEQUENCE'
                      ? 'var(--accent-primary)'
                      : 'transparent',
                    color: config.videoMode === 'SEQUENCE'
                      ? '#ffffff'
                      : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <Film size={13} /> Blender Animation
                </button>
              </div>
            </div>

            {/* DURATION PER IMAGE (SLIDESHOW MODE) OR SEQUENCE INFO */}
            {config.videoMode === 'SEQUENCE' ? (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  lineHeight: '1.4',
                }}
              >
                <strong>🎬 Image Sequence Mode:</strong> Each image is treated as 1 frame.
                {fileCount > 0 && (
                  <div style={{ marginTop: '3px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    Expected Duration: {(fileCount / config.videoFps).toFixed(2)}s ({fileCount} frames @ {config.videoFps} FPS)
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.8px',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
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
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Frame Rate (FPS)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[30, 60, 24].map((fps) => {
                  const isActive = config.videoFps === fps;
                  return (
                    <button
                      key={fps}
                      onClick={() => onChange({ ...config, videoFps: fps as any })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: isActive
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-glass)',
                        background: isActive ? 'var(--accent-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {fps} FPS
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Video Resolution
              </label>
              <select
                value={config.videoResolution}
                onChange={(e) => onChange({ ...config, videoResolution: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="1080p" style={{ background: '#18181b', color: '#fff' }}>
                  1080p Full HD (1920x1080)
                </option>
                <option value="4k" style={{ background: '#18181b', color: '#fff' }}>
                  4K Ultra HD (3840x2160)
                </option>
                <option value="720p" style={{ background: '#18181b', color: '#fff' }}>
                  720p HD (1280x720)
                </option>
                <option value="ORIGINAL" style={{ background: '#18181b', color: '#fff' }}>
                  Original Image Resolution (Padded)
                </option>
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Background Audio (Optional)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={config.audioPath ? config.audioPath.split(/[\\/]/).pop() : 'No audio attached'}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: config.audioPath ? 'var(--accent-cyan)' : 'var(--text-dim)',
                    fontSize: '11px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleBrowseAudio}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-glass-card)',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Music size={13} /> Select
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTPUT FOLDER PICKER */}
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
            Output Folder
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '12px',
                color: config.outputDir ? 'var(--text-main)' : 'var(--text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxSizing: 'border-box',
              }}
              title={config.outputDir || 'Output files will be saved in the same directory as source files'}
            >
              <Folder size={14} color={config.outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'} />
              <span>{config.outputDir || 'Same as Source File Directory'}</span>
            </div>

            <button
              onClick={handleBrowseOutputFolder}
              title="Browse Destination Folder"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-glass-card)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Folder size={14} /> Browse
            </button>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <button
          onClick={onStart}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: disabled
              ? 'var(--input-bg)'
              : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            color: disabled ? 'var(--text-dim)' : '#ffffff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: disabled ? 'none' : '0 6px 24px rgba(99, 102, 241, 0.45)',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Sparkles size={18} />
          {config.outputFormat === 'VIDEO' ? 'START CONVERT TO VIDEO' : 'START IMAGE CONVERT'}
        </button>
      </div>
    </div>
  );
};
