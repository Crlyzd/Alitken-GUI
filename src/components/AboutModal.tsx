import React, { useEffect } from 'react';
import { X, Heart, Coffee, ExternalLink, Folder, Bug, Cpu, Zap } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  hardwareInfo?: {
    name: string;
    encoder: string;
    details?: string;
  };
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, hardwareInfo }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenLogFolder = async () => {
    try {
      await invoke('open_log_folder');
    } catch (err) {
      console.error('Failed to open log directory:', err);
    }
  };

  const isGpu = hardwareInfo?.name && !hardwareInfo.name.toLowerCase().includes('cpu');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          borderRadius: '16px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        {/* Top Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/app-icon.ico"
              alt="ALITKEN Logo"
              style={{
                width: '44px',
                height: '44px',
                objectFit: 'contain',
                borderRadius: '10px',
                filter: 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.5))',
              }}
            />
            <div>
              <h2
                style={{
                  fontFamily: 'Outfit',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: 'var(--text-main)',
                  lineHeight: '1.2',
                }}
              >
                ALITKEN
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                v0.4 &middot; Universal Video, Image & PDF Suite
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="no-drag"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f43f5e';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border-glass)' }} />

        {/* Creator & Coffee Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            textAlign: 'center',
            background: 'var(--bg-glass-card)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
            <span>Made with</span>
            <Heart size={14} color="#f43f5e" fill="#f43f5e" />
            <span>
              by{' '}
              <strong
                onClick={() => handleOpenLink('http://kaleksananbagus.com/')}
                title="Visit http://kaleksananbagus.com/"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-primary)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'inherit';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Kaleksanan Bagus
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Coffee size={14} color="#f59e0b" />
              <span>Buy me a coffee:</span>
            </div>
            <button
              onClick={() => handleOpenLink('https://saweria.co/curlyzed')}
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--accent-primary)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-primary)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.color = 'var(--accent-primary)';
              }}
            >
              Saweria <ExternalLink size={11} />
            </button>
            <span style={{ color: 'var(--border-glass)' }}>/</span>
            <button
              onClick={() => handleOpenLink('https://paypal.me/BagusMassani')}
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: 'var(--accent-cyan)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-cyan)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.12)';
                e.currentTarget.style.color = 'var(--accent-cyan)';
              }}
            >
              PayPal <ExternalLink size={11} />
            </button>
          </div>
        </div>

        {/* Action Utility Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleOpenLink('https://forms.gle/rvASPHTJc9f9R24g8')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
          >
            <Bug size={14} color="#f59e0b" />
            <span>Report Bug / Request Feature</span>
          </button>

          <button
            onClick={handleOpenLogFolder}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-glass-card)')}
            title="Open Application Log Folder"
          >
            <Folder size={14} color="#38bdf8" />
            <span>Open Logs</span>
          </button>
        </div>

        {/* Hardware Status Badge & Tech Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {hardwareInfo?.name && (
            <div
              title={hardwareInfo.details || undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: isGpu ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                border: `1px solid ${isGpu ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                color: isGpu ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  {isGpu ? <Zap size={12} style={{ flexShrink: 0 }} /> : <Cpu size={12} style={{ flexShrink: 0 }} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Active Encoder: {hardwareInfo.name}
                  </span>
                </div>
                {hardwareInfo.encoder && <span style={{ opacity: 0.85, flexShrink: 0, whiteSpace: 'nowrap' }}>({hardwareInfo.encoder})</span>}
              </div>
              {hardwareInfo.details && (
                <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 400, wordBreak: 'break-word', lineHeight: '1.35', marginTop: '2px' }}>
                  {hardwareInfo.details}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', color: 'var(--text-muted)' }}>
            <span>Engine: Tauri v2 &middot; Rust Tokio</span>
            <span>AV1: VideoLAN libdav1d</span>
          </div>
        </div>
      </div>
    </div>
  );
};
