import React from 'react';
import { Image, Video } from 'lucide-react';
import { ImageOutputFormat } from '../../types/media';

export interface FormatSelectorProps {
  format: ImageOutputFormat;
  onChange: (format: ImageOutputFormat) => void;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({ format, onChange }) => {
  const isVideo = format === 'VIDEO';

  return (
    <div>
      <label className="image-config-section-label">Target Output Format</label>

      {/* Tier 1: Category Switcher */}
      <div className="image-config-category-grid">
        <button
          type="button"
          onClick={() => {
            if (isVideo) {
              onChange('WEBP');
            }
          }}
          className={`image-config-category-btn ${!isVideo ? 'active' : ''}`}
        >
          <Image size={15} strokeWidth={2} /> Image & Document
        </button>

        <button
          type="button"
          onClick={() => onChange('VIDEO')}
          className={`image-config-category-btn ${isVideo ? 'active' : ''}`}
        >
          <Video size={15} strokeWidth={2} /> Video (MP4)
        </button>
      </div>

      {/* Tier 2: Sub-format Pill Selector (For Image Formats) */}
      {!isVideo && (
        <div className="image-config-subformat-grid">
          {(['JPG', 'PNG', 'WEBP', 'PDF'] as ImageOutputFormat[]).map((fmt) => {
            const isActive = format === fmt;
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => onChange(fmt)}
                className={`image-config-subformat-pill ${isActive ? 'active' : ''}`}
              >
                {fmt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
