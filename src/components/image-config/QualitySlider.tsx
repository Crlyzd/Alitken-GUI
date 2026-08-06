import React from 'react';

export interface QualitySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const QualitySlider: React.FC<QualitySliderProps> = ({
  label,
  value,
  onChange,
  min = 10,
  max = 100,
  step = 5,
}) => {
  return (
    <div>
      <label className="image-config-section-label">
        {label} ({value}%)
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="image-config-range-input"
      />
    </div>
  );
};
