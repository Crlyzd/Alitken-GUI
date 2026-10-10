import React from 'react';
import { APP_VERSION_TITLE } from '../../utils/version';

export const TitlebarBranding: React.FC = () => {
  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      <img
        src="/app-icon.ico"
        alt="ALITKEN"
        style={{
          width: '22px',
          height: '22px',
          objectFit: 'contain',
          borderRadius: '4px',
          filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: '14px',
          letterSpacing: '0.5px',
          color: 'var(--text-main)',
        }}
      >
        ALITKEN{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>
          {APP_VERSION_TITLE}
        </span>
      </span>
    </div>
  );
};
