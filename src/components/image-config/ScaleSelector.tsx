import React from 'react';

export interface ScaleSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
}

export const ScaleSelector: React.FC<ScaleSelectorProps> = ({
  value,
  onChange,
  label = 'Resolution Scale',
}) => {
  const options = [
    { label: 'Original', val: null },
    { label: '80%', val: 80 },
    { label: '50%', val: 50 },
    { label: '30%', val: 30 },
  ];

  return (
    <div>
      {label && <label className="image-config-section-label">{label}</label>}
      <div className="image-config-scale-grid">
        {options.map((item) => {
          const isActive = value === item.val;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onChange(item.val)}
              className={`image-config-scale-btn ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
