import React, { useEffect } from 'react';
import { X, Heart, Coffee, ExternalLink, Folder, Bug, Cpu, Zap, RefreshCw, Download, CheckCircle2, AlertCircle, Loader2, ArrowUpCircle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
  release_notes_url: string;
  release_name: string;
}

export interface UpdateProgressPayload {
  status: string;
  percent: number;
  downloaded_mb: number;
  total_mb: number;
  speed_mbps: number;
}

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  hardwareInfo?: {
    name: string;
    encoder: string;
    details?: string;
  };
  updateInfo: UpdateInfo | null;
  onCheckUpdate: () => Promise<void>;
  onInstallUpdate: (downloadUrl: string) => Promise<void>;
  isCheckingUpdate: boolean;
  updateProgress: UpdateProgressPayload | null;
  updateError: string | null;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  hardwareInfo,
  updateInfo,
  onCheckUpdate,
  onInstallUpdate,
  isCheckingUpdate,
  updateProgress,
  updateError,
}) => {
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
        padding: '12px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        {/* Top Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/app-icon.ico"
              alt="ALITKEN Logo"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                borderRadius: '8px',
                filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))',
              }}
            />
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: 'var(--text-main)',
                  lineHeight: '1.2',
                }}
              >
                ALITKEN
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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
            gap: '8px',
            alignItems: 'center',
            textAlign: 'center',
            background: 'var(--bg-glass-card)',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-main)' }}>
            <span>Made with</span>
            <Heart size={13} color="#f43f5e" fill="#f43f5e" />
            <span>
              by{' '}
              <strong
                onClick={() => handleOpenLink('http://kaleksananbagus.com/')}
                title="Visit http://kaleksananbagus.com/"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Coffee size={13} color="#f59e0b" />
              <span>Buy me a coffee:</span>
            </div>
            <button
              onClick={() => handleOpenLink('https://saweria.co/curlyzed')}
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--accent-primary)',
                borderRadius: '5px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
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
              Saweria <ExternalLink size={10} />
            </button>
            <span style={{ color: 'var(--border-glass)' }}>/</span>
            <button
              onClick={() => handleOpenLink('https://paypal.me/BagusMassani')}
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: 'var(--accent-cyan)',
                borderRadius: '5px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
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
              PayPal <ExternalLink size={10} />
            </button>
          </div>
        </div>

        {/* Auto-Update Feature Streamlined Section */}
        {updateInfo?.available ? (
          /* State 1: Update Available Banner */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpCircle size={16} color="#10b981" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                  Update Available: v{updateInfo.latest_version}
                </span>
              </div>
              {updateInfo.release_notes_url && (
                <button
                  onClick={() => handleOpenLink(updateInfo.release_notes_url)}
                  title="View Release Notes on GitHub"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  Notes <ExternalLink size={9} />
                </button>
              )}
            </div>

            {updateProgress && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-main)' }}>
                  <span>{updateProgress.status}</span>
                  <span>
                    {updateProgress.downloaded_mb.toFixed(1)} / {updateProgress.total_mb > 0 ? updateProgress.total_mb.toFixed(1) : '?'} MB
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, updateProgress.percent))}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                      borderRadius: '2px',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => onInstallUpdate(updateInfo.download_url)}
              disabled={isCheckingUpdate || updateProgress !== null}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: isCheckingUpdate || updateProgress !== null ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                opacity: isCheckingUpdate || updateProgress !== null ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              {updateProgress ? (
                <>
                  <Loader2 size={13} className="spin" />
                  <span>Installing Update...</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Update to v{updateInfo.latest_version} — Install Now</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* State 2: Sleek 1-Line Compact Up-to-Date Bar */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--bg-glass-card)',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-main)' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>
                ALITKEN v{updateInfo ? updateInfo.current_version : '0.4.0'}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>(Latest Version)</span>
              </span>
            </div>

            <button
              onClick={onCheckUpdate}
              disabled={isCheckingUpdate}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-glass-hover)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isCheckingUpdate ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              {isCheckingUpdate ? (
                <>
                  <Loader2 size={11} className="spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={11} />
                  <span>Check</span>
                </>
              )}
            </button>
          </div>
        )}

        {updateError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#f43f5e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} />
              <span>{updateError}</span>
            </div>
            <button
              onClick={() => handleOpenLink('https://github.com/kaleksanan/Alitken-GUI/releases')}
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                borderRadius: '5px',
                padding: '3px 8px',
                fontSize: '10.5px',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Open Download Page in Browser
            </button>
          </div>
        )}

        {/* Action Utility Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleOpenLink('https://forms.gle/rvASPHTJc9f9R24g8')}
            style={{
              flex: 1,
              padding: '7px 12px',
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
          >
            <Bug size={13} color="#f59e0b" />
            <span>Report Bug / Request Feature</span>
          </button>

          <button
            onClick={handleOpenLogFolder}
            style={{
              padding: '7px 12px',
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
            <Folder size={13} color="#38bdf8" />
            <span>Open Logs</span>
          </button>
        </div>

        {/* Hardware Status Badge & Tech Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
          {hardwareInfo?.name && (
            <div
              title={hardwareInfo.details || undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                padding: '4px 10px',
                borderRadius: '6px',
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
