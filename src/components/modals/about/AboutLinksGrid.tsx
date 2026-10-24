import React from 'react';
import { Globe, Github, Bug, Folder, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface AboutLinksGridProps {
  onOpenLink: (url: string) => void;
}

export const AboutLinksGrid: React.FC<AboutLinksGridProps> = ({ onOpenLink }) => {
  const handleOpenLogFolder = async () => {
    try {
      await invoke('open_log_folder');
    } catch (err) {
      console.error('Failed to open log directory:', err);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <button
        onClick={() => onOpenLink('https://alitken.kaleksananbagus.com/')}
        style={{
          padding: '7px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-glass-card)',
          color: 'var(--text-main)',
          fontSize: '11.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
        title="Visit Official Website"
      >
        <Globe size={13} color="var(--accent-cyan)" />
        <span>Website</span>
        <ExternalLink size={9} style={{ opacity: 0.65, marginLeft: '1px' }} />
      </button>

      <button
        onClick={() => onOpenLink('https://github.com/Crlyzd/Alitken-GUI')}
        style={{
          padding: '7px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-glass-card)',
          color: 'var(--text-main)',
          fontSize: '11.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
        title="Visit GitHub Repository"
      >
        <Github size={13} />
        <span>GitHub Repo</span>
        <ExternalLink size={9} style={{ opacity: 0.65, marginLeft: '1px' }} />
      </button>

      <button
        onClick={() => onOpenLink('https://forms.gle/rvASPHTJc9f9R24g8')}
        style={{
          padding: '7px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-glass-card)',
          color: 'var(--text-main)',
          fontSize: '11.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
        title="Report Bug / Request Feature"
      >
        <Bug size={13} color="var(--accent-amber)" />
        <span>Report Bug</span>
        <ExternalLink size={9} style={{ opacity: 0.65, marginLeft: '1px' }} />
      </button>

      <button
        onClick={handleOpenLogFolder}
        style={{
          padding: '7px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-glass-card)',
          color: 'var(--text-main)',
          fontSize: '11.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
        title="Open Application Log Folder"
      >
        <Folder size={13} color="var(--accent-cyan)" />
        <span>Open Logs</span>
      </button>
    </div>
  );
};
