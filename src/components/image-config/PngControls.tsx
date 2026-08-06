import React from 'react';
import { ImageConfig } from '../../types/media';
import { ScaleSelector } from './ScaleSelector';

export interface PngControlsProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
}

export const PngControls: React.FC<PngControlsProps> = ({ config, onChange }) => {
  return (
    <div className="image-config-panel-card">
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        PNG conversion outputs lossless Portable Network Graphics format.
      </p>

      <ScaleSelector
        label="Resolution Scale"
        value={config.pngScalePercent}
        onChange={(val) => onChange({ ...config, pngScalePercent: val })}
      />
    </div>
  );
};
