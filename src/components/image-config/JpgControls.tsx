import React from 'react';
import { ImageConfig } from '../../types/media';
import { QualitySlider } from './QualitySlider';
import { ScaleSelector } from './ScaleSelector';

export interface JpgControlsProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
}

export const JpgControls: React.FC<JpgControlsProps> = ({ config, onChange }) => {
  return (
    <div className="image-config-panel-card">
      <QualitySlider
        label="JPG Compression Quality"
        value={config.jpgQuality}
        onChange={(val) => onChange({ ...config, jpgQuality: val })}
      />
      <ScaleSelector
        label="Resolution Scale"
        value={config.jpgScalePercent}
        onChange={(val) => onChange({ ...config, jpgScalePercent: val })}
      />
    </div>
  );
};
