import React from 'react';
import { ImageConfig } from '../../types/media';
import { useImageDialogs } from '../../hooks/useImageDialogs';
import { FormatSelector } from './FormatSelector';
import { JpgControls } from './JpgControls';
import { PdfControls } from './PdfControls';
import { WebpControls } from './WebpControls';
import { PngControls } from './PngControls';
import { VideoControls } from './VideoControls';
import { OutputFolderPicker } from './OutputFolderPicker';
import { ImageStartButton } from './ImageStartButton';
import '../../styles/image-config.css';

export interface ImageConfigTabProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
  onStart: () => void;
  disabled: boolean;
  fileCount: number;
  onOpenDestination?: () => void;
  onBrowseOutputFolder?: () => void;
  onBrowseAudio?: () => void;
}

export const ImageConfigTab: React.FC<ImageConfigTabProps> = ({
  config,
  onChange,
  onStart,
  disabled,
  fileCount,
  onOpenDestination,
  onBrowseOutputFolder: externalBrowseFolder,
  onBrowseAudio: externalBrowseAudio,
}) => {
  const { handleBrowseOutputFolder, handleBrowseAudio } = useImageDialogs({
    config,
    onChange,
    onBrowseOutputFolder: externalBrowseFolder,
    onBrowseAudio: externalBrowseAudio,
  });

  return (
    <div className="image-config-container">
      {/* Scrollable Form Settings */}
      <div className="image-config-scroll-area">
        {/* Category & Format Selectors */}
        <FormatSelector
          format={config.outputFormat}
          onChange={(fmt) => onChange({ ...config, outputFormat: fmt })}
        />

        {/* Format Specific Sub-Panels */}
        {config.outputFormat === 'JPG' && (
          <JpgControls config={config} onChange={onChange} />
        )}
        {config.outputFormat === 'PDF' && (
          <PdfControls config={config} onChange={onChange} fileCount={fileCount} />
        )}
        {config.outputFormat === 'WEBP' && (
          <WebpControls config={config} onChange={onChange} />
        )}
        {config.outputFormat === 'PNG' && (
          <PngControls config={config} onChange={onChange} />
        )}
        {config.outputFormat === 'VIDEO' && (
          <VideoControls
            config={config}
            onChange={onChange}
            fileCount={fileCount}
            onBrowseAudio={handleBrowseAudio}
          />
        )}

        {/* Output Directory Picker */}
        <OutputFolderPicker
          outputDir={config.outputDir}
          fileCount={fileCount}
          onBrowse={handleBrowseOutputFolder}
          onOpen={onOpenDestination}
        />
      </div>

      {/* Primary Action Button */}
      <ImageStartButton
        onStart={onStart}
        disabled={disabled}
        isVideo={config.outputFormat === 'VIDEO'}
      />
    </div>
  );
};
