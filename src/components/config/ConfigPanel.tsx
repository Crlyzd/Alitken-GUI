import React, { useState } from 'react';
import { PanelRightClose } from 'lucide-react';
import { ImageConfig, StreamCompatibilityResult } from '../../types/media';
import { ConfigState, PRESET_HEIGHTS, PRESET_BITRATES } from '../../types/config';
import { FileItem } from '../../types/queue';
import { ImageConfigTab } from '../image-config/ImageConfigTab';
import {
  VideoActionRail,
  CombineControls,
  ExtractFramesControls,
  SplitControls,
  TranscodeControls,
  OutputFolderSection,
} from '../video-config';
import { CollapsedConfigBar } from './CollapsedConfigBar';
import { TrimmerActionBanner } from './TrimmerActionBanner';
import { BatchActionFooter } from './BatchActionFooter';
import { useConfigPanelHandlers } from './useConfigPanelHandlers';

export interface ConfigPanelProps {
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
  isFastCopyTrimDisabled?: boolean;
  fastCopyTrimDisabledReason?: string;
  streamCompatibility?: StreamCompatibilityResult | null;
  isCheckingCompatibility?: boolean;
  estimatedFramesCount?: number;
}

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
  isFastCopyTrimDisabled = false,
  fastCopyTrimDisabledReason,
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

  const { handleBrowseFolder, handleBrowseAudio, handleClearAudio, handleOpenFolder } =
    useConfigPanelHandlers({
      config,
      onChange,
      onOpenDestination,
    });

  const isFastCopyActive = isTrimmerMode
    ? !!fastCopyTrim && !isFastCopyTrimDisabled
    : (config.videoAction === 'SPLIT' && config.splitFastCopy) ||
      (config.videoAction === 'COMBINE' && config.combineFastCopy);

  const croppedFilesCount = (files || []).filter(
    (f) =>
      f.isCropApplied ||
      (f.crop_w !== undefined && f.crop_h !== undefined) ||
      (f.aspectRatio && f.aspectRatio !== 'ORIGINAL')
  ).length;

  const isCombineMismatch =
    !isTrimmerMode &&
    config.videoAction === 'COMBINE' &&
    config.combineFastCopy &&
    !!streamCompatibility &&
    !streamCompatibility.is_compatible;

  const isCropFastConcatConflict =
    !isTrimmerMode &&
    config.videoAction === 'COMBINE' &&
    config.combineFastCopy &&
    croppedFilesCount > 0;

  if (isCollapsed) {
    return <CollapsedConfigBar onToggleCollapse={onToggleCollapse} />;
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
                  croppedFilesCount={croppedFilesCount}
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
                <SplitControls
                  config={config}
                  onChange={onChange}
                  croppedFilesCount={croppedFilesCount}
                />
              )}

              {/* TARGET CODEC, RESOLUTION & BITRATE */}
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
                  croppedFilesCount={croppedFilesCount}
                  onBrowseAudio={handleBrowseAudio}
                  onClearAudio={handleClearAudio}
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
                <TrimmerActionBanner
                  fastCopyTrim={fastCopyTrim}
                  onFastCopyTrimChange={onFastCopyTrimChange}
                  isFastCopyTrimDisabled={isFastCopyTrimDisabled}
                  fastCopyTrimDisabledReason={fastCopyTrimDisabledReason}
                />
              )}

              {/* ACTION BUTTON (CTA) */}
              <BatchActionFooter
                config={config}
                disabled={disabled}
                isTrimmerMode={isTrimmerMode}
                isCombineMismatch={isCombineMismatch}
                isCropFastConcatConflict={isCropFastConcatConflict}
                fileCount={fileCount}
                onStart={onStart}
                onStartTrim={onStartTrim}
              />

              <div style={{ height: '20px', flexShrink: 0 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
