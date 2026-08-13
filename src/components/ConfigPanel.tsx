import React, { useState } from 'react';
import {
  Scissors,
  RefreshCw,
  Zap,
  Folder,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Link2,
  Image,
  AlertTriangle,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ImageConfig, StreamCompatibilityResult } from '../types/media';
import { ImageConfigTab } from './ImageConfigTab';
import { GlassSelect } from './GlassSelect';

export interface ConfigState {
  videoAction: 'CONVERT' | 'SPLIT' | 'COMBINE' | 'EXTRACT_FRAMES';
  splitMode: 'DURATION' | 'PARTS';
  splitValue: number | '';
  splitFastCopy: boolean;
  combineFastCopy: boolean;
  combineOutputName: string;
  frameOutputFormat: 'PNG' | 'JPEG' | 'WEBP';
  frameRate: 'MAX' | '30' | '10' | '5' | '1';
  frameQuality: number;
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
  onOpenDestination?: () => void;
  isTrimmerMode?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onStartTrim?: () => void;
  fastCopyTrim?: boolean;
  onFastCopyTrimChange?: (val: boolean) => void;
  streamCompatibility?: StreamCompatibilityResult | null;
  isCheckingCompatibility?: boolean;
  estimatedFramesCount?: number;
}

const PRESET_HEIGHTS = ['ORIGINAL', '2160', '1440', '1080', '720', '480'];
const PRESET_BITRATES = ['ORIGINAL', '20000', '15000', '10000', '5000', '2000', '1000'];

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
  onOpenDestination,
  isTrimmerMode = false,
  isCollapsed = false,
  onToggleCollapse,
  onStartTrim,
  fastCopyTrim = false,
  onFastCopyTrimChange,
  streamCompatibility,
  isCheckingCompatibility = false,
  estimatedFramesCount = 0,
}) => {
  const [isCustomHeight, setIsCustomHeight] = useState<boolean>(
    !PRESET_HEIGHTS.includes(config.targetHeight)
  );
  const [isCustomBitrate, setIsCustomBitrate] = useState<boolean>(
    !PRESET_BITRATES.includes(config.targetBitrate)
  );

  const isFastCopyActive =
    !isTrimmerMode &&
    ((config.videoAction === 'SPLIT' && config.splitFastCopy) ||
      (config.videoAction === 'COMBINE' && config.combineFastCopy));

  const isCombineMismatch =
    config.videoAction === 'COMBINE' &&
    config.combineFastCopy &&
    !!streamCompatibility &&
    !streamCompatibility.is_compatible;

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
    if (onOpenDestination) {
      onOpenDestination();
    } else if (config.outputDir) {
      try {
        await invoke('open_folder', { folderPath: config.outputDir });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  if (isCollapsed) {
    return (
      <div
        className="glass-panel"
        style={{
          width: '44px',
          height: '100%',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '14px 6px',
          boxSizing: 'border-box',
          justifyContent: 'space-between',
          cursor: 'pointer',
          border: '1px solid var(--border-glass)',
        }}
        onClick={onToggleCollapse}
        title="Expand Export Settings"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PanelRightOpen size={18} />
        </button>
        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Export Settings
        </div>
        <div style={{ height: '24px' }} />
      </div>
    );
  }

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
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: 0,
        }}
      >
        {/* Top Header Row with Collapse Button */}
        {onToggleCollapse && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '-4px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
              }}
            >
              {isTrimmerMode ? 'Trim Export Configuration' : 'Export Configuration'}
            </span>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse Settings Panel"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <PanelRightClose size={16} />
            </button>
          </div>
        )}

        {/* IMAGE CONFIG TAB (when MediaType is 'image') */}
        {mediaType === 'image' ? (
          <ImageConfigTab
            config={imageConfig}
            onChange={onImageConfigChange}
            onStart={onStartImage}
            disabled={disabled}
            fileCount={fileCount}
            onOpenDestination={onOpenDestination}
          />
        ) : (
          /* VIDEO CONFIG PANEL (Design A: Left Vertical Icon Rail + Right Settings Column) */
          <div style={{ display: 'flex', flex: 1, gap: '14px', minHeight: 0 }}>
            {/* 1. Left Vertical Icon Sidebar Rail (42px) */}
            <div
              style={{
                width: '42px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '6px 4px',
                borderRadius: '12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-glass)',
                alignItems: 'center',
                flexShrink: 0,
                alignSelf: 'flex-start',
              }}
            >
              {/* Button 1: Transcode Video */}
              <button
                type="button"
                onClick={() => onChange({ videoAction: 'CONVERT' })}
                title="Transcode Video (Convert format, resolution & bitrate)"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    config.videoAction === 'CONVERT' || isTrimmerMode
                      ? 'var(--accent-primary)'
                      : 'transparent',
                  color:
                    config.videoAction === 'CONVERT' || isTrimmerMode
                      ? '#ffffff'
                      : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow:
                    config.videoAction === 'CONVERT' || isTrimmerMode
                      ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                      : 'none',
                }}
              >
                <RefreshCw size={16} />
              </button>

              {/* Button 2: Split Video */}
              <button
                type="button"
                onClick={() => !isTrimmerMode && onChange({ videoAction: 'SPLIT' })}
                disabled={isTrimmerMode}
                title={
                  isTrimmerMode
                    ? 'Split Video is disabled in single clip trimmer'
                    : 'Split Video into segments'
                }
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    !isTrimmerMode && config.videoAction === 'SPLIT'
                      ? 'var(--accent-primary)'
                      : 'transparent',
                  color:
                    !isTrimmerMode && config.videoAction === 'SPLIT'
                      ? '#ffffff'
                      : 'var(--text-muted)',
                  opacity: isTrimmerMode ? 0.35 : 1,
                  cursor: isTrimmerMode ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow:
                    !isTrimmerMode && config.videoAction === 'SPLIT'
                      ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                      : 'none',
                }}
              >
                <Scissors size={16} />
              </button>

              {/* Button 3: Combine Queue */}
              <button
                type="button"
                onClick={() => !isTrimmerMode && fileCount >= 2 && onChange({ videoAction: 'COMBINE' })}
                disabled={isTrimmerMode || fileCount < 2}
                title={
                  isTrimmerMode
                    ? 'Combine is disabled in single clip trimmer'
                    : fileCount < 2
                    ? 'Add at least 2 videos to combine'
                    : 'Combine Queue Videos into One File'
                }
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    !isTrimmerMode && config.videoAction === 'COMBINE'
                      ? 'var(--accent-primary)'
                      : 'transparent',
                  color:
                    !isTrimmerMode && config.videoAction === 'COMBINE'
                      ? '#ffffff'
                      : 'var(--text-muted)',
                  opacity: isTrimmerMode || fileCount < 2 ? 0.35 : 1,
                  cursor: isTrimmerMode || fileCount < 2 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow:
                    !isTrimmerMode && config.videoAction === 'COMBINE'
                      ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                      : 'none',
                }}
              >
                <Link2 size={16} />
              </button>

              {/* Button 4: Extract Frames */}
              <button
                type="button"
                onClick={() =>
                  !isTrimmerMode && fileCount > 0 && onChange({ videoAction: 'EXTRACT_FRAMES' })
                }
                disabled={isTrimmerMode || fileCount === 0}
                title={
                  isTrimmerMode
                    ? 'Extract Frames is disabled in single clip trimmer'
                    : fileCount === 0
                    ? 'Add a video to extract frames'
                    : 'Extract Video Frames to Images'
                }
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    !isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES'
                      ? 'var(--accent-primary)'
                      : 'transparent',
                  color:
                    !isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES'
                      ? '#ffffff'
                      : 'var(--text-muted)',
                  opacity: isTrimmerMode || fileCount === 0 ? 0.35 : 1,
                  cursor: isTrimmerMode || fileCount === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow:
                    !isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES'
                      ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                      : 'none',
                }}
              >
                <Image size={16} />
              </button>
            </div>

            {/* 2. Right Main Settings Panel (Flex 1) */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: 0,
              }}
            >
              {/* COMBINE MODE CONTROLS */}
              {!isTrimmerMode && config.videoAction === 'COMBINE' && (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Zap
                        size={16}
                        style={{
                          color: config.combineFastCopy ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}
                        >
                          Lossless Fast Concat
                        </div>
                        <div
                          style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}
                        >
                          Instant stream copy with 0% quality loss (-c copy)
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.combineFastCopy}
                      onChange={(e) => onChange({ combineFastCopy: e.target.checked })}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--accent-cyan)',
                        cursor: 'pointer',
                      }}
                    />
                  </label>

                  {/* Stream Mismatch Warning Card */}
                  {isCombineMismatch && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        color="#f59e0b"
                        style={{ flexShrink: 0, marginTop: '2px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#fcd34d', lineHeight: '1.4' }}>
                        {streamCompatibility?.reason}
                      </div>
                    </div>
                  )}

                  {/* Checking Stream Compatibility Indicator */}
                  {isCheckingCompatibility && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                      }}
                    >
                      Checking stream compatibility...
                    </div>
                  )}

                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                  {/* Output Filename Field */}
                  <div>
                    <label
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Combined Output Filename:
                    </label>
                    <input
                      type="text"
                      value={config.combineOutputName}
                      placeholder="combined_output"
                      onChange={(e) =>
                        onChange({
                          combineOutputName: e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ''),
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

                  {/* Order Info Card */}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(6, 182, 212, 0.08)',
                      border: '1px solid rgba(6, 182, 212, 0.2)',
                      fontSize: '11px',
                      color: 'var(--accent-cyan)',
                      lineHeight: '1.4',
                    }}
                  >
                    ℹ {fileCount} videos will be joined in queue order. Reorder via queue sort.
                  </div>
                </div>
              )}

              {/* EXTRACT FRAMES MODE CONTROLS */}
              {!isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES' && (
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
                  {/* Output Image Format Selection */}
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
                      Image Format
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {(['PNG', 'JPEG', 'WEBP'] as const).map((fmt) => {
                        const isActive = config.frameOutputFormat === fmt;
                        return (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => onChange({ frameOutputFormat: fmt })}
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
                              {fmt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quality Slider for JPEG / WEBP */}
                  {config.frameOutputFormat !== 'PNG' && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
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
                          Quality: {config.frameQuality}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={config.frameQuality}
                        onChange={(e) => onChange({ frameQuality: parseInt(e.target.value, 10) })}
                        style={{
                          width: '100%',
                          accentColor: 'var(--accent-cyan)',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  )}

                  {/* Frame Rate Presets Dropdown */}
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
                      Frame Rate / Sampling
                    </span>
                    <GlassSelect
                      value={config.frameRate}
                      onChange={(val) =>
                        onChange({ frameRate: val as 'MAX' | '30' | '10' | '5' | '1' })
                      }
                      options={[
                        { value: 'MAX', label: 'Every Frame (Full Native FPS)' },
                        { value: '30', label: '30 fps' },
                        { value: '10', label: '10 fps' },
                        { value: '5', label: '5 fps' },
                        { value: '1', label: '1 fps (1 frame per second)' },
                      ]}
                    />
                  </div>

                  {/* Estimated Frame Count Info / Warning Card */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background:
                        estimatedFramesCount > 10000
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(6, 182, 212, 0.08)',
                      border: `1px solid ${
                        estimatedFramesCount > 10000
                          ? 'rgba(245, 158, 11, 0.4)'
                          : 'rgba(6, 182, 212, 0.2)'
                      }`,
                      color: estimatedFramesCount > 10000 ? '#fcd34d' : 'var(--accent-cyan)',
                      fontSize: '11px',
                      lineHeight: '1.4',
                    }}
                  >
                    {estimatedFramesCount > 10000 ? (
                      <>
                        ⚠️ <strong>Large extraction</strong>: ~{estimatedFramesCount.toLocaleString()} frames
                        estimated. A storage pre-check will run before starting.
                      </>
                    ) : (
                      <>
                        ℹ ~{estimatedFramesCount.toLocaleString()} frames estimated across {fileCount} video(s).
                        Each video will create a dedicated <code>_frames/</code> subfolder.
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SPLIT VIDEO OPTIONS (If Split Mode Active and Not in Trimmer Mode) */}
              {!isTrimmerMode && config.videoAction === 'SPLIT' && (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Zap
                        size={16}
                        style={{
                          color: config.splitFastCopy ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}
                        >
                          Lossless Copy
                        </div>
                        <div
                          style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}
                        >
                          0% quality loss, 100x rendering speed with zero encoding overhead.
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
                      type="button"
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
                      type="button"
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

              {/* TARGET CODEC SECTION (Hidden in EXTRACT_FRAMES mode) */}
              {config.videoAction !== 'EXTRACT_FRAMES' && (
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
              )}

              {/* TARGET RESOLUTION SECTION (Hidden in EXTRACT_FRAMES mode) */}
              {config.videoAction !== 'EXTRACT_FRAMES' && (
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
              )}

              {/* TARGET BITRATE / QUALITY SECTION (Hidden in EXTRACT_FRAMES mode) */}
              {config.videoAction !== 'EXTRACT_FRAMES' && (
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
              )}

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
                    onClick={handleBrowseFolder}
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
                      justifyContent: 'space-between',
                      gap: '8px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                    }}
                    title="Click to browse destination folder"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}
                    >
                      <Folder
                        size={14}
                        color={config.outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'}
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {config.outputDir || 'Same as Source File Directory'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--accent-cyan)',
                        opacity: 0.8,
                        flexShrink: 0,
                      }}
                    >
                      Browse
                    </span>
                  </div>

                  {(config.outputDir || fileCount > 0) && (
                    <button
                      type="button"
                      onClick={handleOpenFolder}
                      title="Open Destination Folder in Explorer"
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
                        flexShrink: 0,
                      }}
                    >
                      <FolderOpen size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* FAST COPY TOGGLE FOR TRIMMER MODE */}
              {isTrimmerMode && onFastCopyTrimChange && (
                <div
                  onClick={() => onFastCopyTrimChange(!fastCopyTrim)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: fastCopyTrim ? 'rgba(6, 182, 212, 0.12)' : 'var(--input-bg)',
                    border: `1px solid ${
                      fastCopyTrim ? 'rgba(6, 182, 212, 0.4)' : 'var(--border-glass)'
                    }`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap
                      size={18}
                      style={{
                        color: fastCopyTrim ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}
                      >
                        Lossless Copy
                      </div>
                      <div
                        style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '2px' }}
                      >
                        Lossless instant cut without re-encoding
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={fastCopyTrim}
                    onChange={(e) => onFastCopyTrimChange(e.target.checked)}
                    style={{
                      accentColor: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      transform: 'scale(1.2)',
                    }}
                  />
                </div>
              )}

              {/* ACTION BUTTON (CTA) */}
              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={isTrimmerMode ? onStartTrim || onStart : onStart}
                  disabled={
                    disabled ||
                    isCombineMismatch ||
                    (config.videoAction === 'COMBINE' && fileCount < 2) ||
                    (config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0)
                  }
                  title={
                    isCombineMismatch
                      ? 'Streams differ — switch to Re-encode or fix files'
                      : config.videoAction === 'COMBINE' && fileCount < 2
                      ? 'Add at least 2 videos to combine'
                      : undefined
                  }
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background:
                      disabled ||
                      isCombineMismatch ||
                      (config.videoAction === 'COMBINE' && fileCount < 2) ||
                      (config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0)
                        ? 'var(--input-bg)'
                        : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                    color:
                      disabled ||
                      isCombineMismatch ||
                      (config.videoAction === 'COMBINE' && fileCount < 2) ||
                      (config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0)
                        ? 'var(--text-dim)'
                        : '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor:
                      disabled ||
                      isCombineMismatch ||
                      (config.videoAction === 'COMBINE' && fileCount < 2) ||
                      (config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0)
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow:
                      disabled ||
                      isCombineMismatch ||
                      (config.videoAction === 'COMBINE' && fileCount < 2) ||
                      (config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0)
                        ? 'none'
                        : '0 6px 24px rgba(99, 102, 241, 0.45)',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isTrimmerMode ? (
                    <>
                      <Scissors size={16} /> EXPORT TRIMMED CLIP
                    </>
                  ) : config.videoAction === 'COMBINE' ? (
                    <>
                      <Link2 size={16} /> START COMBINE
                    </>
                  ) : config.videoAction === 'EXTRACT_FRAMES' ? (
                    <>
                      <Image size={16} /> EXTRACT ALL FRAMES
                    </>
                  ) : config.videoAction === 'SPLIT' ? (
                    <>
                      <Scissors size={16} /> START SPLIT
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> START CONVERT
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
