import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Info, Settings, Pin } from 'lucide-react';
import { APP_VERSION_TITLE } from '../../utils/version';

export interface WindowControlsProps {
  hasUpdate?: boolean;
  latestVersion?: string;
  onOpenAbout?: () => void;
  onOpenSettings?: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  hasUpdate,
  latestVersion,
  onOpenAbout,
  onOpenSettings,
}) => {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(() => {
    return localStorage.getItem('alitken_always_on_top') === 'true';
  });

  useEffect(() => {
    if (isAlwaysOnTop) {
      invoke('set_always_on_top', { alwaysOnTop: true }).catch(() => {
        getCurrentWindow().setAlwaysOnTop(true).catch(() => {});
      });
    }
  }, []);

  const handleToggleAlwaysOnTop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    localStorage.setItem('alitken_always_on_top', String(nextState));

    try {
      await invoke('set_always_on_top', { alwaysOnTop: nextState });
    } catch {
      try {
        await getCurrentWindow().setAlwaysOnTop(nextState);
      } catch (err) {
        console.error('Failed to set always on top:', err);
      }
    }
  };

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Always on Top Pin Toggle Button */}
      <button
        data-tauri-drag-region={false}
        onClick={handleToggleAlwaysOnTop}
        onMouseDown={(e) => e.stopPropagation()}
        title={isAlwaysOnTop ? 'Always on Top: ON (Click to unpin)' : 'Always on Top: OFF (Click to pin)'}
        className="no-drag"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: isAlwaysOnTop ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
          background: isAlwaysOnTop ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: isAlwaysOnTop ? '#818cf8' : 'var(--text-muted)',
        }}
        onMouseEnter={(e) => {
          if (!isAlwaysOnTop) e.currentTarget.style.background = 'var(--border-glass)';
        }}
        onMouseLeave={(e) => {
          if (!isAlwaysOnTop) e.currentTarget.style.background = 'transparent';
        }}
      >
        <Pin size={14} style={{ transform: isAlwaysOnTop ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {/* Settings Integration Button */}
      {onOpenSettings && (
        <button
          data-tauri-drag-region={false}
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

      {/* Standalone About Info Button */}
      {onOpenAbout && (
        <button
          data-tauri-drag-region={false}
          onClick={onOpenAbout}
          onMouseDown={(e) => e.stopPropagation()}
          title={hasUpdate ? `Update Available! (v${latestVersion || 'new'}) - Click to view` : `About ALITKEN ${APP_VERSION_TITLE}`}
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
          {hasUpdate ? (
            <div className="titlebar-outer-red-ring">
              <Info size={12} color="#10b981" className="titlebar-info-update-pulse" />
            </div>
          ) : (
            <Info size={14} color="var(--text-muted)" />
          )}
        </button>
      )}

      {/* Window Action Buttons (Explicitly Non-Draggable) */}
      <div
        data-tauri-drag-region={false}
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <button
          data-tauri-drag-region={false}
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
          data-tauri-drag-region={false}
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
          data-tauri-drag-region={false}
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
  );
};
