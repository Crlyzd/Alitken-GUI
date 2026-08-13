import React from 'react';
import { Layers, X } from 'lucide-react';

interface SettingsHeaderProps {
  onClose: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onClose }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'var(--accent-primary-alpha)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}
        >
          <Layers size={16} />
        </div>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-main)',
              lineHeight: '1.2',
            }}
          >
            Preferences &amp; Integrations
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Customize app theme and Windows context menu integrations
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
