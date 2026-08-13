import React from 'react';

interface SettingsFooterProps {
  executablePath?: string;
}

export const SettingsFooter: React.FC<SettingsFooterProps> = ({ executablePath }) => {
  if (!executablePath) return null;

  return (
    <div
      title={executablePath}
      style={{
        fontSize: '9.5px',
        color: 'var(--text-muted)',
        whiteSpace: 'normal',
        wordBreak: 'break-all',
        lineHeight: '1.35',
        opacity: 0.85,
        borderTop: '1px solid var(--border-glass)',
        paddingTop: '8px',
        marginTop: '4px',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Target Binary:</span>{' '}
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '9px', opacity: 0.9 }}>
        {executablePath}
      </span>
    </div>
  );
};
