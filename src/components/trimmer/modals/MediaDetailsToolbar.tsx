import React from 'react';
import { Layers, Terminal, Copy, Check, FolderOpen } from 'lucide-react';

interface MediaDetailsToolbarProps {
  activeTab: 'visual' | 'text';
  setActiveTab: (tab: 'visual' | 'text') => void;
  onCopyPath: () => void;
  copiedPath: boolean;
  onRevealInExplorer: () => void;
  onCopyMediaInfo: () => void;
  copiedText: boolean;
  onCopyJson: () => void;
  copiedJson: boolean;
}

export const MediaDetailsToolbar: React.FC<MediaDetailsToolbarProps> = ({
  activeTab,
  setActiveTab,
  onCopyPath,
  copiedPath,
  onRevealInExplorer,
  onCopyMediaInfo,
  copiedText,
  onCopyJson,
  copiedJson,
}) => {
  return (
    <div
      style={{
        padding: '10px 20px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
      }}
    >
      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <TabButton
          active={activeTab === 'visual'}
          onClick={() => setActiveTab('visual')}
          icon={<Layers size={13} />}
          label="Visual Specs"
        />
        <TabButton
          active={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          icon={<Terminal size={13} />}
          label="MediaInfo Text"
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <ActionButton
          onClick={onCopyPath}
          icon={copiedPath ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          label={copiedPath ? 'Path Copied!' : 'Copy Path'}
        />
        <ActionButton
          onClick={onRevealInExplorer}
          icon={<FolderOpen size={12} />}
          label="Explorer"
        />
        <ActionButton
          onClick={onCopyMediaInfo}
          icon={copiedText ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          label={copiedText ? 'Report Copied!' : 'Copy Report'}
        />
        <ActionButton
          onClick={onCopyJson}
          icon={copiedJson ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          label={copiedJson ? 'JSON Copied!' : 'Copy JSON'}
        />
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '5px 12px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      background: active ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
      border: active ? '1px solid var(--accent-cyan)' : '1px solid transparent',
      color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
      transition: 'all 0.15s ease',
    }}
  >
    {icon} {label}
  </button>
);

const ActionButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 9px',
      borderRadius: '7px',
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid var(--border-glass)',
      color: 'var(--text-main)',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
    }}
  >
    {icon} {label}
  </button>
);
