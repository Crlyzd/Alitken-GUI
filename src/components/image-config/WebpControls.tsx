import React from 'react';
import { ImageConfig } from '../../types/media';
import { QualitySlider } from './QualitySlider';
import { ScaleSelector } from './ScaleSelector';

export interface WebpControlsProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
}

export const WebpControls: React.FC<WebpControlsProps> = ({ config, onChange }) => {
  return (
    <div className="image-config-panel-card">
      <QualitySlider
        label="WebP Compression Quality"
        value={config.webQuality}
        onChange={(val) => onChange({ ...config, webQuality: val })}
      />
      <ScaleSelector
        label="Resolution Scale"
        value={config.webScalePercent}
        onChange={(val) => onChange({ ...config, webScalePercent: val })}
      />
    </div>
  );
};
