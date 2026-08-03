import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Sparkles, FolderCheck, ShieldAlert, CheckCircle2, RefreshCw, Layers } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { IntegrationStatus } from '../types/media';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
}) => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loadingSendTo, setLoadingSendTo] = useState(false);
  const [loadingWin11, setLoadingWin11] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await invoke<IntegrationStatus>('get_system_integration_status');
      setStatus(res);
    } catch (err) {
      console.error('Failed to fetch system integration status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      fetchStatus();
    }
  }, [isOpen]);

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

  const handleToggleSendTo = async () => {
    if (loadingSendTo) return;
    setLoadingSendTo(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetState = !(status?.sendto_active ?? false);

    try {
      const res = await invoke<boolean>('set_sendto_status', { enable: targetState });
      setStatus((prev) =>
        prev
          ? { ...prev, sendto_active: res }
          : { sendto_active: res, win11_menu_active: false, executable_path: '' }
      );
      setSuccessMsg(res ? 'Added to Windows "Send to" menu!' : 'Removed from Windows "Send to" menu.');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to update SendTo shortcut.');
    } finally {
      setLoadingSendTo(false);
    }
  };

  const handleToggleWin11Menu = async () => {
    if (loadingWin11) return;
    setLoadingWin11(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetState = !(status?.win11_menu_active ?? false);

    try {
      const res = await invoke<boolean>('set_win11_context_menu_status', { enable: targetState });
      setStatus((prev) =>
        prev
          ? { ...prev, win11_menu_active: res }
          : { sendto_active: false, win11_menu_active: res, executable_path: '' }
      );
      setSuccessMsg(
        res
          ? 'Registered on Windows Context Menu!'
          : 'Unregistered from Windows Context Menu.'
      );
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to update Context Menu registration.');
    } finally {
      setLoadingWin11(false);
    }
  };

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
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'var(--accent-primary-alpha)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Layers size={16} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'Outfit',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  lineHeight: '1.2',
                }}
              >
                Preferences &amp; Integrations
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Customize app theme and Windows context menu integrations
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--accent-emerald)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-rose)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldAlert size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Appearance & Theme */}
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

        {/* Section 2: Windows Context Menu Integrations */}
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
                    background: theme === 'light' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.2)',
                    color: theme === 'light' ? '#047857' : '#34d399',
                    border: `1px solid ${theme === 'light' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
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

            {/* Toggle 2: Windows 11 Main Menu (Option A) */}
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
                    background: 'rgba(168, 85, 247, 0.12)',
                    color: '#a855f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.3' }}>
                    Windows 11 Main Right-Click Menu
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Adds "Convert with Alitken" directly on primary Win11 main menu
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
                    background: theme === 'light' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.25)',
                    color: theme === 'light' ? '#6b21a8' : '#d8b4fe',
                    border: `1px solid ${theme === 'light' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.4)'}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Sparse Package
                </span>

                <button
                  onClick={handleToggleWin11Menu}
                  disabled={loadingWin11}
                  style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '10px',
                    background: status?.win11_menu_active
                      ? 'var(--accent-primary)'
                      : 'rgba(148, 163, 184, 0.25)',
                    border: 'none',
                    cursor: loadingWin11 ? 'wait' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  {loadingWin11 ? (
                    <RefreshCw
                      size={10}
                      className="spin"
                      style={{
                        position: 'absolute',
                        top: '5px',
                        left: status?.win11_menu_active ? '22px' : '5px',
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
                        left: status?.win11_menu_active ? '21px' : '3px',
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

        {/* Footer info */}
        {status?.executable_path && (
          <div
            title={status.executable_path}
            style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0.7,
              borderTop: '1px solid var(--border-glass)',
              paddingTop: '8px',
            }}
          >
            Target Binary: {status.executable_path}
          </div>
        )}
      </div>
    </div>
  );
};
