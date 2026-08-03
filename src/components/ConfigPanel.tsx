import React, { useState } from 'react';
import { Scissors, RefreshCw, Zap, Folder, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ImageConfig } from '../types/media';
import { ImageConfigTab } from './ImageConfigTab';

export interface ConfigState {
  videoAction: 'CONVERT' | 'SPLIT';
  splitMode: 'DURATION' | 'PARTS';
  splitValue: number | '';
  splitFastCopy: boolean;
  targetHeight: string;
  targetBitrate: string;
  codecChoice: string; // "1"=H264, "2"=HEVC, "3"=AV1
  outputDir: string | null;
}

interface ConfigPanelProps {
  mediaType: 'video' | 'image';
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  onStart: () => void;
  imageConfig: ImageConfig;
  onImageConfigChange: (updated: ImageConfig) => void;
  onStartImage: () => void;
  disabled: boolean;
  fileCount: number;
}

const PRESET_HEIGHTS = ['ORIGINAL', '2160', '1440', '1080', '720', '480'];
const PRESET_BITRATES = ['ORIGINAL', '12000', '8000', '5000', '2500', '1200'];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  mediaType,
  config,
  onChange,
  onStart,
  imageConfig,
  onImageConfigChange,
  onStartImage,
  disabled,
  fileCount,
}) => {
  const [isCustomHeight, setIsCustomHeight] = useState<boolean>(
    !PRESET_HEIGHTS.includes(config.targetHeight)
  );
  const [isCustomBitrate, setIsCustomBitrate] = useState<boolean>(
    !PRESET_BITRATES.includes(config.targetBitrate)
  );

  const isFastCopyActive = config.videoAction === 'SPLIT' && config.splitFastCopy;

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.outputDir || undefined,
      });
      if (selected && typeof selected === 'string') {
        onChange({ outputDir: selected });
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const handleOpenFolder = async () => {
    if (config.outputDir) {
      try {
        await invoke('open_folder', { folderPath: config.outputDir });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '16px',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          minHeight: 0,
        }}
      >
        {/* RENDER IMAGE CONFIG TAB IF MEDIA TYPE IS IMAGE */}
        {mediaType === 'image' ? (
          <ImageConfigTab
            config={imageConfig}
            onChange={onImageConfigChange}
            onStart={onStartImage}
            disabled={disabled}
            fileCount={fileCount}
          />
        ) : (
          /* RENDER UNCHANGED VIDEO CONFIG PANEL IF MEDIA TYPE IS VIDEO */
          <>
            {/* Mode Selector Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: 'var(--input-bg)',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <button
                onClick={() => onChange({ videoAction: 'CONVERT' })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    config.videoAction === 'CONVERT' ? 'var(--accent-primary)' : 'transparent',
                  color: config.videoAction === 'CONVERT' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <RefreshCw size={14} /> Transcode
              </button>
              <button
                onClick={() => onChange({ videoAction: 'SPLIT' })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    config.videoAction === 'SPLIT' ? 'var(--accent-primary)' : 'transparent',
                  color: config.videoAction === 'SPLIT' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <Scissors size={14} /> Split Video
              </button>
            </div>

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
                      fontWeight: 600,
                      color: 'var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    Original Codec Preserved
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
                      onClick={() => onChange({ codecChoice: codec.id })}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '12px',
                        background: isActive ? 'var(--bg-glass-hover)' : 'var(--bg-glass-card)',
                        border: isActive
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-glass)',
                        color: 'var(--text-main)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
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

            {/* SPLIT VIDEO OPTIONS (If Split Mode Active) */}
            {config.videoAction === 'SPLIT' && (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap
                      size={15}
                      style={{
                        color: config.splitFastCopy ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      }}
                    />
                    <div>
                      <div
                        style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}
                      >
                        Fast Stream Copy (-c copy)
                      </div>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}
                      >
                        0% quality loss, 100x rendering speed with zero CPU/GPU encoding overhead.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.splitFastCopy}
                    onChange={(e) => onChange({ splitFastCopy: e.target.checked })}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--accent-cyan)',
                      cursor: 'pointer',
                    }}
                  />
                </label>

                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    onClick={() => onChange({ splitMode: 'DURATION' })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background:
                        config.splitMode === 'DURATION'
                          ? 'var(--accent-primary)'
                          : 'transparent',
                      color: config.splitMode === 'DURATION' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    By Duration (Sec)
                  </button>
                  <button
                    onClick={() => onChange({ splitMode: 'PARTS' })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background:
                        config.splitMode === 'PARTS' ? 'var(--accent-primary)' : 'transparent',
                      color: config.splitMode === 'PARTS' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    By Equal Parts
                  </button>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    {config.splitMode === 'DURATION'
                      ? 'Segment Length (Seconds):'
                      : 'Number of Equal Parts:'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.splitValue}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      onChange({ splitValue: val });
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
                    }}
                  />
                </div>
              </div>
            )}

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
              <select
                value={isCustomHeight ? 'CUSTOM' : config.targetHeight}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setIsCustomHeight(true);
                    onChange({ targetHeight: '1080' });
                  } else {
                    setIsCustomHeight(false);
                    onChange({ targetHeight: val });
                  }
                }}
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
                <option value="ORIGINAL" style={{ background: '#18181b', color: '#fff' }}>
                  Original Resolution
                </option>
                <option value="2160" style={{ background: '#18181b', color: '#fff' }}>
                  4K Ultra HD (2160p)
                </option>
                <option value="1440" style={{ background: '#18181b', color: '#fff' }}>
                  2K QHD (1440p)
                </option>
                <option value="1080" style={{ background: '#18181b', color: '#fff' }}>
                  1080p Full HD
                </option>
                <option value="720" style={{ background: '#18181b', color: '#fff' }}>
                  720p HD
                </option>
                <option value="480" style={{ background: '#18181b', color: '#fff' }}>
                  480p SD
                </option>
                <option value="CUSTOM" style={{ background: '#18181b', color: '#fff' }}>
                  Custom Height (px)...
                </option>
              </select>
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
              <select
                value={isCustomBitrate ? 'CUSTOM' : config.targetBitrate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setIsCustomBitrate(true);
                    onChange({ targetBitrate: '5000' });
                  } else {
                    setIsCustomBitrate(false);
                    onChange({ targetBitrate: val });
                  }
                }}
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
                <option value="ORIGINAL" style={{ background: '#18181b', color: '#fff' }}>
                  Auto / Quality Preserving (CRF 23)
                </option>
                <option value="20000" style={{ background: '#18181b', color: '#fff' }}>
                  Ultra High (20 Mbps)
                </option>
                <option value="15000" style={{ background: '#18181b', color: '#fff' }}>
                  Very High (15 Mbps)
                </option>
                <option value="10000" style={{ background: '#18181b', color: '#fff' }}>
                  High (10 Mbps)
                </option>
                <option value="5000" style={{ background: '#18181b', color: '#fff' }}>
                  Medium (5 Mbps)
                </option>
                <option value="2000" style={{ background: '#18181b', color: '#fff' }}>
                  Low (2 Mbps)
                </option>
                <option value="1000" style={{ background: '#18181b', color: '#fff' }}>
                  Min (1 Mbps)
                </option>
                <option value="CUSTOM" style={{ background: '#18181b', color: '#fff' }}>
                  Custom Bitrate (kbps)...
                </option>
              </select>
            </div>

            {/* OUTPUT FOLDER SECTION */}
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
                  title={
                    config.outputDir ||
                    'Output files will be saved in the same directory as source files'
                  }
                >
                  <Folder
                    size={14}
                    color={config.outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'}
                  />
                  <span>{config.outputDir || 'Same as Source File Directory'}</span>
                </div>

                <button
                  onClick={handleBrowseFolder}
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
                  <FolderOpen size={14} /> Browse
                </button>

                {config.outputDir && (
                  <button
                    onClick={handleOpenFolder}
                    title="Open Selected Folder in Explorer"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-glass-card)',
                      color: 'var(--accent-cyan)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FolderOpen size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* START VIDEO BUTTON */}
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
                <Zap size={16} /> START {config.videoAction}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
