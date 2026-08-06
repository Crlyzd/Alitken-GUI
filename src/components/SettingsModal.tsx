import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Sparkles, FolderCheck, ShieldAlert, CheckCircle2, RefreshCw, Layers, Download, Trash2, Film, Image } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { DependencyStatus, IntegrationStatus } from '../types/media';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onUpdateEngine?: (engine: 'ffmpeg' | 'magick' | 'all', targetChoice?: 'AppData' | 'Portable') => void;
}

const formatEngineVersion = (versionStr?: string): string => {
  if (!versionStr) return '';
  return versionStr.split('-')[0];
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onUpdateEngine,
}) => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [loadingSendTo, setLoadingSendTo] = useState(false);
  const [loadingWin11, setLoadingWin11] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await invoke<IntegrationStatus>('get_system_integration_status');
      setStatus(res);
      const depRes = await invoke<DependencyStatus>('check_app_dependencies');
      setDeps(depRes);
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

    // Optimistic update — flip state immediately so the toggle feels instant
    setStatus((prev) =>
      prev ? { ...prev, sendto_active: targetState } : prev
    );

    try {
      const res = await invoke<boolean>('set_sendto_status', { enable: targetState });
      // Confirm with actual backend result
      setStatus((prev) =>
        prev
          ? { ...prev, sendto_active: res }
          : { sendto_active: res, win11_menu_active: false, executable_path: '' }
      );
      setSuccessMsg(res ? 'Added to Windows "Send to" menu!' : 'Removed from Windows "Send to" menu.');
    } catch (err: any) {
      // Revert optimistic update on failure
      setStatus((prev) =>
        prev ? { ...prev, sendto_active: !targetState } : prev
      );
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

    // Optimistic update — flip state immediately so the toggle feels instant
    setStatus((prev) =>
      prev ? { ...prev, win11_menu_active: targetState } : prev
    );

    try {
      const res = await invoke<boolean>('set_win11_context_menu_status', { enable: targetState });
      // Confirm with actual backend result
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
      // Revert optimistic update on failure
      setStatus((prev) =>
        prev ? { ...prev, win11_menu_active: !targetState } : prev
      );
      setErrorMsg(err?.toString() || 'Failed to update Context Menu registration.');
    } finally {
      setLoadingWin11(false);
    }
  };

  const handleInstallAppData = async () => {
    if (loadingDeps) return;
    setLoadingDeps(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await invoke<DependencyStatus>('install_to_appdata');
      setDeps(res);
      setSuccessMsg('Binaries successfully installed to AppData!');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to install binaries to AppData.');
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleUninstallDeps = async () => {
    if (loadingDeps) return;
    setLoadingDeps(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await invoke<DependencyStatus>('uninstall_appdata');
      setDeps(res);
      setSuccessMsg('Binaries uninstalled from AppData.');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to uninstall binaries.');
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleOpenAppDataFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('open_folder', { folderPath: deps?.appdata_path });
    } catch (err) {
      console.error('Failed to open AppData folder:', err);
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
          maxHeight: 'calc(100vh - 28px)',
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
                  fontFamily: 'var(--font-heading)',
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

        {/* Section 2: Media Processing Engines */}
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
            Media Processing Engines
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Engine Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* FFmpeg Engine */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flexShrink: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title={deps?.ffmpeg_version ? `FFmpeg v${deps.ffmpeg_version}` : undefined}
                >
                  <Film size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>FFmpeg:</span>{' '}
                  {deps?.ffmpeg_version
                    ? `v${formatEngineVersion(deps.ffmpeg_version)}`
                    : deps?.ffmpeg_exists
                    ? 'Installed'
                    : 'Not Installed'}
                  {deps?.active_location && deps.active_location !== '' && deps.active_location !== 'Missing'
                    ? ` (${deps.active_location})`
                    : ''}
                </span>

                {/* Right Aligned Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
                  <span
                    onClick={() => {
                      if (!deps?.ffmpeg_exists || !deps?.ffmpeg_valid || deps?.has_update) {
                        onClose();
                        const choice = deps?.active_location === 'AppData' ? 'AppData' : undefined;
                        onUpdateEngine ? onUpdateEngine('ffmpeg', choice) : handleInstallAppData();
                      }
                    }}
                    title={
                      !deps?.ffmpeg_exists
                        ? 'Click to download and install FFmpeg binary'
                        : deps?.has_update
                        ? 'Click to download & install FFmpeg update'
                        : deps?.ffmpeg_valid
                        ? 'FFmpeg is valid and up to date'
                        : 'Click to download valid FFmpeg binary'
                    }
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: (!deps?.ffmpeg_exists || !deps?.ffmpeg_valid || deps?.has_update) ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'all 0.2s ease',
                      background: deps?.ffmpeg_valid
                        ? (deps.has_update
                          ? (theme === 'light' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(245, 158, 11, 0.22)')
                          : (theme === 'light' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)'))
                        : (theme === 'light' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.15)'),
                      color: deps?.ffmpeg_valid
                        ? (deps.has_update
                          ? (theme === 'light' ? '#b45309' : '#fbbf24')
                          : (theme === 'light' ? '#047857' : '#34d399'))
                        : (theme === 'light' ? '#e11d48' : '#fb7185'),
                      border: `1px solid ${
                        deps?.ffmpeg_valid
                          ? (deps.has_update
                            ? (theme === 'light' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(245, 158, 11, 0.5)')
                            : (theme === 'light' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)'))
                          : (theme === 'light' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.3)')
                      }`,
                    }}
                  >
                    <span
                      className="status-dot-pulse"
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: deps?.ffmpeg_valid
                          ? (deps.has_update ? (theme === 'light' ? '#b45309' : '#fbbf24') : '#10b981')
                          : '#f43f5e',
                        boxShadow: deps?.ffmpeg_valid
                          ? (deps.has_update
                            ? (theme === 'light' ? '0 0 6px rgba(180, 83, 9, 0.7)' : '0 0 6px rgba(251, 191, 36, 0.9)')
                            : '0 0 6px rgba(16, 185, 129, 0.8)')
                          : '0 0 6px rgba(244, 63, 94, 0.8)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {!deps?.ffmpeg_exists
                        ? 'Not Installed'
                        : !deps?.ffmpeg_valid
                        ? 'Outdated (< 5.0)'
                        : deps?.has_update
                        ? 'Update Available (≥ 5.0)'
                        : 'Valid (≥ 5.0)'}
                    </span>
                    {(!deps?.ffmpeg_exists || !deps?.ffmpeg_valid || deps?.has_update) && (
                      <Download size={9} style={{ marginLeft: '1px' }} />
                    )}
                  </span>
                </div>
              </div>

              {/* ImageMagick Engine */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flexShrink: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title={deps?.magick_version ? `ImageMagick v${deps.magick_version}` : undefined}
                >
                  <Image size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>ImageMagick:</span>{' '}
                  {deps?.magick_version
                    ? `v${formatEngineVersion(deps.magick_version)}`
                    : deps?.magick_exists
                    ? 'Installed'
                    : 'Not Installed'}
                  {deps?.active_location && deps.active_location !== '' && deps.active_location !== 'Missing'
                    ? ` (${deps.active_location})`
                    : ''}
                </span>

                {/* Right Aligned Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
                  <span
                    onClick={() => {
                      if (!deps?.magick_exists || !deps?.magick_valid || deps?.magick_has_update) {
                        onClose();
                        const choice = deps?.active_location === 'AppData' ? 'AppData' : undefined;
                        onUpdateEngine ? onUpdateEngine('magick', choice) : handleInstallAppData();
                      }
                    }}
                    title={
                      !deps?.magick_exists
                        ? 'Click to download and install ImageMagick binary'
                        : deps?.magick_has_update
                        ? 'Click to download & install ImageMagick update'
                        : deps?.magick_valid
                        ? 'ImageMagick is valid and up to date'
                        : 'Click to download valid ImageMagick binary'
                    }
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: (!deps?.magick_exists || !deps?.magick_valid || deps?.magick_has_update) ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'all 0.2s ease',
                      background: deps?.magick_valid
                        ? (deps.magick_has_update
                          ? (theme === 'light' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(245, 158, 11, 0.22)')
                          : (theme === 'light' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)'))
                        : (theme === 'light' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.15)'),
                      color: deps?.magick_valid
                        ? (deps.magick_has_update
                          ? (theme === 'light' ? '#b45309' : '#fbbf24')
                          : (theme === 'light' ? '#047857' : '#34d399'))
                        : (theme === 'light' ? '#e11d48' : '#fb7185'),
                      border: `1px solid ${
                        deps?.magick_valid
                          ? (deps.magick_has_update
                            ? (theme === 'light' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(245, 158, 11, 0.5)')
                            : (theme === 'light' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)'))
                          : (theme === 'light' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.3)')
                      }`,
                    }}
                  >
                    <span
                      className="status-dot-pulse"
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: deps?.magick_valid
                          ? (deps.magick_has_update ? (theme === 'light' ? '#b45309' : '#fbbf24') : '#10b981')
                          : '#f43f5e',
                        boxShadow: deps?.magick_valid
                          ? (deps.magick_has_update
                            ? (theme === 'light' ? '0 0 6px rgba(180, 83, 9, 0.7)' : '0 0 6px rgba(251, 191, 36, 0.9)')
                            : '0 0 6px rgba(16, 185, 129, 0.8)')
                          : '0 0 6px rgba(244, 63, 94, 0.8)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {!deps?.magick_exists
                        ? 'Not Installed'
                        : !deps?.magick_valid
                        ? 'Outdated (< 7.0)'
                        : deps?.magick_has_update
                        ? 'Update Available (≥ 7.0)'
                        : 'Valid (≥ 7.0)'}
                    </span>
                    {(!deps?.magick_exists || !deps?.magick_valid || deps?.magick_has_update) && (
                      <Download size={9} style={{ marginLeft: '1px' }} />
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Action Button & Contextual Sub-caption */}
            {(() => {
              const isAnyOutdated =
                deps?.has_update ||
                deps?.magick_has_update ||
                !deps?.ffmpeg_valid ||
                !deps?.magick_valid;

              if (deps?.active_location === 'AppData') {
                if (isAnyOutdated) {
                  return (
                    <>
                      <button
                        onClick={() => {
                          onClose();
                          onUpdateEngine ? onUpdateEngine('all', 'AppData') : handleInstallAppData();
                        }}
                        disabled={loadingDeps}
                        style={{
                          marginTop: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#f59e0b',
                          color: '#000',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: loadingDeps ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {loadingDeps ? <RefreshCw size={12} className="spin" /> : <Download size={12} />}
                        <span>{loadingDeps ? 'Updating...' : 'Update Binaries'}</span>
                      </button>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                        Updates AppData binaries to the latest release in{' '}
                        <span
                          onClick={handleOpenAppDataFolder}
                          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                          title="Open AppData folder in Windows File Explorer"
                        >
                          AppData
                        </span>.
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <button
                      onClick={handleUninstallDeps}
                      disabled={loadingDeps}
                      style={{
                        marginTop: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(244, 63, 94, 0.15)',
                        color: '#fb7185',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: loadingDeps ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {loadingDeps ? <RefreshCw size={12} className="spin" /> : <Trash2 size={12} />}
                      <span>{loadingDeps ? 'Uninstalling...' : 'Uninstall Binaries'}</span>
                    </button>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                      Binaries are installed in{' '}
                      <span
                        onClick={handleOpenAppDataFolder}
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                        title="Open AppData folder in Windows File Explorer"
                      >
                        AppData
                      </span>. Click uninstall to remove them.
                    </div>
                  </>
                );
              }

              if (deps?.active_location === 'System PATH') {
                if (isAnyOutdated) {
                  return (
                    <>
                      <button
                        onClick={() => {
                          onClose();
                          onUpdateEngine ? onUpdateEngine('all', 'AppData') : handleInstallAppData();
                        }}
                        disabled={loadingDeps}
                        style={{
                          marginTop: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#f59e0b',
                          color: '#000',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: loadingDeps ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {loadingDeps ? <RefreshCw size={12} className="spin" /> : <Download size={12} />}
                        <span>{loadingDeps ? 'Updating...' : 'Update Binaries (Install to AppData)'}</span>
                      </button>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                        System PATH binaries are outdated. Click to download latest binaries into{' '}
                        <span
                          onClick={handleOpenAppDataFolder}
                          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                          title="Open AppData folder in Windows File Explorer"
                        >
                          AppData
                        </span>{' '}
                        to upgrade.
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <button
                      disabled={true}
                      style={{
                        marginTop: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: 0.8,
                      }}
                    >
                      <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                      <span>Using System PATH Binaries</span>
                    </button>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                      System PATH binaries are up-to-date and active. No{' '}
                      <span
                        onClick={handleOpenAppDataFolder}
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                        title="Open AppData folder in Windows File Explorer"
                      >
                        AppData
                      </span>{' '}
                      installation needed.
                    </div>
                  </>
                );
              }

              if (deps?.active_location === '' && deps?.ffmpeg_exists) {
                return (
                  <>
                    <button
                      onClick={() => {
                        onClose();
                        onUpdateEngine ? onUpdateEngine('all', 'AppData') : handleInstallAppData();
                      }}
                      disabled={loadingDeps}
                      style={{
                        marginTop: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: loadingDeps ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {loadingDeps ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                      <span>{loadingDeps ? 'Installing...' : 'Install to AppData'}</span>
                    </button>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                      Currently using local bin/ folder. Click to install a standalone copy to{' '}
                      <span
                        onClick={handleOpenAppDataFolder}
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                        title="Open AppData folder in Windows File Explorer"
                      >
                        AppData
                      </span>.
                    </div>
                  </>
                );
              }

              // Missing / Default state
              return (
                <>
                  <button
                    onClick={() => {
                      onClose();
                      onUpdateEngine ? onUpdateEngine('all', 'AppData') : handleInstallAppData();
                    }}
                    disabled={loadingDeps}
                    style={{
                      marginTop: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: loadingDeps ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {loadingDeps ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                    <span>{loadingDeps ? 'Installing...' : 'Install Binaries'}</span>
                  </button>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                    Installs binaries to{' '}
                    <span
                      onClick={handleOpenAppDataFolder}
                      style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                      title="Open AppData folder in Windows File Explorer"
                    >
                      AppData
                    </span>{' '}
                    so Alitken.exe can move anywhere on your PC.
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Section 3: Windows Context Menu Integrations */}
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
