import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ValidationErrorBannerProps {
  validationError: string;
  theme: 'dark' | 'light';
  onDismiss: () => void;
}

export const ValidationErrorBanner: React.FC<ValidationErrorBannerProps> = ({
  validationError,
  theme,
  onDismiss,
}) => {
  return (
    <div
      style={{
        background:
          theme === 'light'
            ? 'rgba(254, 226, 226, 0.95)'
            : 'rgba(239, 68, 68, 0.25)',
        borderBottom:
          theme === 'light'
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : '1px solid rgba(239, 68, 68, 0.4)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        fontWeight: 600,
        color: theme === 'light' ? '#991b1b' : '#fca5a5',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={16} color={theme === 'light' ? '#b91c1c' : '#fca5a5'} />
        <span>{validationError}</span>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: theme === 'light' ? '#991b1b' : '#fca5a5',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
