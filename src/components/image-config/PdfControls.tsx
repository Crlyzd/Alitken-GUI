import React from 'react';
import { ImageConfig } from '../../types/media';
import { QualitySlider } from './QualitySlider';
import { ScaleSelector } from './ScaleSelector';

export interface PdfControlsProps {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
  fileCount: number;
}

export const PdfControls: React.FC<PdfControlsProps> = ({ config, onChange, fileCount }) => {
  return (
    <div className="image-config-panel-card">
      {fileCount > 1 && (
        <div className="image-config-merge-box">
          <div>
            <div className="image-config-merge-title">Merge into Single PDF</div>
            <div className="image-config-merge-subtitle">
              Combines all {fileCount} images into one multi-page PDF document
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.mergePdf}
            onChange={(e) => onChange({ ...config, mergePdf: e.target.checked })}
            className="image-config-checkbox"
          />
        </div>
      )}

      <QualitySlider
        label="PDF Compression Quality"
        value={config.pdfQuality}
        onChange={(val) => onChange({ ...config, pdfQuality: val })}
      />

      <ScaleSelector
        label="Target PDF Resolution / Scale"
        value={config.pdfScalePercent}
        onChange={(val) => onChange({ ...config, pdfScalePercent: val })}
      />
    </div>
  );
};
