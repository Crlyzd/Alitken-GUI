import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface ThemeSectionProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const ThemeSection: React.FC<ThemeSectionProps> = ({
  theme,
  onToggleTheme,
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
        Appearance &amp; Theme Mode
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* Dark Theme Button */}
        <div
          onClick={theme === 'light' ? onToggleTheme : undefined}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${theme === 'dark' ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
            cursor: theme === 'light' ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Moon size={14} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              Dark Mode
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Frosted Glass</div>
          </div>
        </div>

        {/* Light Theme Button */}
        <div
          onClick={theme === 'dark' ? onToggleTheme : undefined}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: theme === 'light' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${theme === 'light' ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
            cursor: theme === 'dark' ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sun size={14} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              Light Mode
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mica / Acrylic</div>
          </div>
        </div>
      </div>
    </div>
  );
};
