import React, { useState } from 'react';
import {
  Scissors,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Link2,
  Image,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ImageConfig, StreamCompatibilityResult } from '../types/media';
import { ImageConfigTab } from './ImageConfigTab';
import { FileItem } from './Dropzone';
import {
  VideoActionRail,
  CombineControls,
  ExtractFramesControls,
  SplitControls,
  TranscodeControls,
  OutputFolderSection,
} from './video-config';

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
  files?: FileItem[];
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
  files,
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

  const isFastCopyActive = isTrimmerMode
    ? !!fastCopyTrim
    : (config.videoAction === 'SPLIT' && config.splitFastCopy) ||
      (config.videoAction === 'COMBINE' && config.combineFastCopy);

  const isCombineMismatch =
    !isTrimmerMode &&
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
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
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
          /* VIDEO CONFIG PANEL */
          <div style={{ display: 'flex', flex: 1, gap: '14px', minHeight: 0 }}>
            {/* 1. Left Vertical Icon Sidebar Rail */}
            <VideoActionRail
              videoAction={config.videoAction}
              onChange={onChange}
              isTrimmerMode={isTrimmerMode}
              fileCount={fileCount}
            />

            {/* 2. Right Main Settings Panel */}
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
                <CombineControls
                  config={config}
                  onChange={onChange}
                  streamCompatibility={streamCompatibility}
                  isCheckingCompatibility={isCheckingCompatibility}
                  fileCount={fileCount}
                  files={files}
                />
              )}

              {/* EXTRACT FRAMES MODE CONTROLS */}
              {!isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES' && (
                <ExtractFramesControls
                  config={config}
                  onChange={onChange}
                  fileCount={fileCount}
                  estimatedFramesCount={estimatedFramesCount}
                />
              )}

              {/* SPLIT VIDEO OPTIONS */}
              {!isTrimmerMode && config.videoAction === 'SPLIT' && (
                <SplitControls config={config} onChange={onChange} />
              )}

              {/* TARGET CODEC, RESOLUTION & BITRATE (Hidden in EXTRACT_FRAMES mode unless in Trimmer Mode) */}
              {(isTrimmerMode || config.videoAction !== 'EXTRACT_FRAMES') && (
                <TranscodeControls
                  config={config}
                  onChange={onChange}
                  isFastCopyActive={isFastCopyActive}
                  isCustomHeight={isCustomHeight}
                  setIsCustomHeight={setIsCustomHeight}
                  isCustomBitrate={isCustomBitrate}
                  setIsCustomBitrate={setIsCustomBitrate}
                  PRESET_HEIGHTS={PRESET_HEIGHTS}
                  PRESET_BITRATES={PRESET_BITRATES}
                />
              )}

              {/* OUTPUT FOLDER SECTION */}
              <OutputFolderSection
                outputDir={config.outputDir}
                handleBrowseFolder={handleBrowseFolder}
                handleOpenFolder={handleOpenFolder}
                fileCount={fileCount}
              />

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
              {(() => {
                const isActionDisabled =
                  disabled ||
                  isCombineMismatch ||
                  (!isTrimmerMode && config.videoAction === 'COMBINE' && fileCount < 2) ||
                  (!isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0);

                return (
                  <button
                    type="button"
                    onClick={isTrimmerMode ? onStartTrim || onStart : onStart}
                    disabled={isActionDisabled}
                    title={
                      !isTrimmerMode && isCombineMismatch
                        ? 'Lossless Copy is enabled but streams differ. Uncheck Lossless Copy to transcode and combine.'
                        : !isTrimmerMode && config.videoAction === 'COMBINE' && fileCount < 2
                        ? 'Add at least 2 videos to combine'
                        : undefined
                    }
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: isActionDisabled ? '1px solid var(--btn-disabled-border)' : 'none',
                      background: isActionDisabled
                        ? 'var(--btn-disabled-bg)'
                        : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                      color: isActionDisabled ? 'var(--btn-disabled-text)' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: isActionDisabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: isActionDisabled ? 0.7 : 1,
                      boxShadow: isActionDisabled ? 'none' : '0 6px 24px rgba(99, 102, 241, 0.45)',
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
                );
              })()}
              </div>
              {/* Natural empty space at the bottom to prevent CTA button clipping and allow scrolling past */}
              <div style={{ height: '20px', flexShrink: 0 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
