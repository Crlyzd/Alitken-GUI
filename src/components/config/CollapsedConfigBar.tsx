import React from 'react';
import { PanelRightOpen } from 'lucide-react';

export interface CollapsedConfigBarProps {
  onToggleCollapse?: () => void;
}

export const CollapsedConfigBar: React.FC<CollapsedConfigBarProps> = ({ onToggleCollapse }) => {
  return (
    <div
      className="glass-panel"
      style={{
        width: '44px',
        height: '100%',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 6px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        cursor: 'pointer',
        border: '1px solid var(--border-glass)',
      }}
      onClick={onToggleCollapse}
      title="Expand Export Settings"
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--accent-cyan)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PanelRightOpen size={18} />
      </button>
      <div
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Export Settings
      </div>
      <div style={{ height: '24px' }} />
    </div>
  );
};
