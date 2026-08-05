import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Cpu, Zap, Info, Settings } from 'lucide-react';

interface TitlebarProps {
  hardwareName?: string;
  encoderName?: string;
  hardwareDetails?: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  onOpenAbout?: () => void;
  onOpenSettings?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  hardwareName,
  encoderName,
  hardwareDetails,
  hasUpdate,
  latestVersion,
  onOpenAbout,
  onOpenSettings,
}) => {
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('minimize_window');
    } catch {
      try {
        await getCurrentWindow().minimize();
      } catch (err) {
        console.error('Failed to minimize window:', err);
      }
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('toggle_maximize_window');
    } catch {
      try {
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.error('Failed to toggle maximize window:', err);
      }
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('close_window');
    } catch {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.error('Failed to close window:', err);
      }
    }
  };

  const isGpu = hardwareName && !hardwareName.toLowerCase().includes('cpu');

  // Format concise badge text for narrow header bar
  const displayHardwareName = hardwareName
    ? hardwareName.includes('Software Fallback')
      ? 'CPU (Software)'
      : hardwareName
    : '';

  const tooltipText = hardwareDetails
    ? `${displayHardwareName} ${encoderName ? `(${encoderName})` : ''} - ${hardwareDetails}`
    : encoderName
    ? `${hardwareName} (${encoderName})`
    : hardwareName || '';

  return (
    <div
      style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 16px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-titlebar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* Brand & App Name — drag region only, not clickable */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'default',
          flexShrink: 0,
        }}
      >
        <img
          src="/app-icon.ico"
          alt="ALITKEN"
          style={{
            width: '22px',
            height: '22px',
            objectFit: 'contain',
            borderRadius: '4px',
            filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))',
          }}
        />
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.5px', color: 'var(--text-main)' }}>
          ALITKEN <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>v0.4</span>
        </span>
      </div>

      {/* Flexible Drag Region Spacer */}
      <div data-tauri-drag-region style={{ flex: 1, minWidth: '40px', height: '100%', cursor: 'default' }} />

      {/* GPU Hardware Status Badge & Control Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 1, minWidth: 0 }}>
        {hardwareName && (
          <div
            data-tauri-drag-region
            title={tooltipText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 500,
              background: isGpu ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              border: `1px solid ${isGpu ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              color: isGpu ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              maxWidth: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
            }}
          >
            {isGpu ? <Zap size={12} style={{ flexShrink: 0 }} /> : <Cpu size={12} style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayHardwareName}
            </span>
            {encoderName && <span style={{ opacity: 0.7, flexShrink: 0 }}>({encoderName})</span>}
          </div>
        )}

        {/* Settings Integration Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            onMouseDown={(e) => e.stopPropagation()}
            title="Settings & Windows Integrations"
            className="no-drag"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-glass)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Settings size={14} color="var(--text-muted)" />
          </button>
        )}

        {/* Standalone About Info Button (Beside Theme Toggle) */}
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            onMouseDown={(e) => e.stopPropagation()}
            title={hasUpdate ? `Update Available! (v${latestVersion || 'new'}) - Click to view` : "About ALITKEN v0.4"}
            className={`no-drag ${hasUpdate ? 'titlebar-info-update-pulse' : ''}`}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: hasUpdate ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
              background: hasUpdate ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!hasUpdate) e.currentTarget.style.background = 'var(--border-glass)';
            }}
            onMouseLeave={(e) => {
              if (!hasUpdate) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Info size={14} color={hasUpdate ? '#10b981' : 'var(--text-muted)'} />
            {hasUpdate && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
            )}
          </button>
        )}

        {/* Window Action Buttons (Explicitly Non-Draggable) */}
        <div
          className="no-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            onMouseDown={(e) => e.stopPropagation()}
            title="Minimize"
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
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-glass)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            onMouseDown={(e) => e.stopPropagation()}
            title="Maximize / Restore"
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
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-glass)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Square size={12} />
          </button>
          <button
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
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
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f43f5e';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
