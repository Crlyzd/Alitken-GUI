import React from 'react';
import { ConfigState } from '../../types/config';
import { CodecSelector } from './CodecSelector';
import { ResolutionSelector } from './ResolutionSelector';
import { BitrateSelector } from './BitrateSelector';
import { AudioTrackControls } from './AudioTrackControls';

export interface TranscodeControlsProps {
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

  // In Combine mode, if combineFastCopy is active, video transcode options are bypassed/dimmed.
  // In Split mode, uncropped clips are bypassed while cropped clips use transcode settings.
  const isEffectivelyBypassed = isCombineMode
    ? !!config.combineFastCopy
    : (isFastCopyActive && croppedFilesCount === 0);

  // Audio replacement is supported in Convert and Combine (both Lossless and Transcode).
  // In Split mode, lossless fast copy does not re-encode audio.
  const isAudioBypassed = isSplitMode && isFastCopyActive && croppedFilesCount === 0;

  return (
    <>
      <CodecSelector
        config={config}
        onChange={onChange}
        isEffectivelyBypassed={isEffectivelyBypassed}
        isFastCopyActive={isFastCopyActive}
        isSplitMode={isSplitMode}
        croppedFilesCount={croppedFilesCount}
      />

      <ResolutionSelector
        config={config}
        onChange={onChange}
        isEffectivelyBypassed={isEffectivelyBypassed}
        isCustomHeight={isCustomHeight}
        setIsCustomHeight={setIsCustomHeight}
        PRESET_HEIGHTS={PRESET_HEIGHTS}
      />

      <BitrateSelector
        config={config}
        onChange={onChange}
        isEffectivelyBypassed={isEffectivelyBypassed}
        isCustomBitrate={isCustomBitrate}
        setIsCustomBitrate={setIsCustomBitrate}
        PRESET_BITRATES={PRESET_BITRATES}
      />

      <AudioTrackControls
        config={config}
        onChange={onChange}
        isAudioBypassed={isAudioBypassed}
        onBrowseAudio={onBrowseAudio}
        onClearAudio={onClearAudio}
      />
    </>
  );
};
