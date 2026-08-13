import React from 'react';
import { FolderCheck, RefreshCw } from 'lucide-react';
import { IntegrationStatus } from '../../types/media';

interface WindowsIntegrationSectionProps {
  status: IntegrationStatus | null;
  loadingSendTo: boolean;
  theme: 'dark' | 'light';
  handleToggleSendTo: () => Promise<void>;
}

export const WindowsIntegrationSection: React.FC<WindowsIntegrationSectionProps> = ({
  status,
  loadingSendTo,
  theme,
  handleToggleSendTo,
}) => {
  return (
    <div>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '6px',
        }}
      >
        Windows Context Menu Integrations
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Toggle 1: Send To Shortcut */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '2px',
                flexShrink: 0,
              }}
            >
              <FolderCheck size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.3' }}>
                Windows "Send To" Menu
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Right click file &rarr; Send to &rarr; Alitken Media Converter
              </div>
            </div>
          </div>

          {/* Right Column: Pill stacked vertically ABOVE Switch */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '5px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                background: theme === 'light' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.2)',
                color: theme === 'light' ? '#047857' : '#34d399',
                border: `1px solid ${theme === 'light' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
                whiteSpace: 'nowrap',
              }}
            >
              100% Portable
            </span>

            <button
              onClick={handleToggleSendTo}
              disabled={loadingSendTo}
              style={{
                width: '38px',
                height: '20px',
                borderRadius: '10px',
                background: status?.sendto_active
                  ? 'var(--accent-primary)'
                  : 'rgba(148, 163, 184, 0.25)',
                border: 'none',
                cursor: loadingSendTo ? 'wait' : 'pointer',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              {loadingSendTo ? (
                <RefreshCw
                  size={10}
                  className="spin"
                  style={{
                    position: 'absolute',
                    top: '5px',
                    left: status?.sendto_active ? '22px' : '5px',
                    color: '#fff',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: status?.sendto_active ? '21px' : '3px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  }}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
