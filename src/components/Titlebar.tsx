import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Cpu, Zap } from 'lucide-react';

interface TitlebarProps {
  hardwareName?: string;
  encoderName?: string;
}

export const Titlebar: React.FC<TitlebarProps> = ({ hardwareName, encoderName }) => {
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

  return (
    <div
      style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(12, 14, 22, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* Brand & App Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} data-tauri-drag-region>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
          }}
        >
          A
        </div>
        <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '14px', letterSpacing: '0.5px' }}>
          ALITKEN <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>Media Converter v2.0</span>
        </span>
      </div>

      {/* Flexible Drag Region Spacer */}
      <div data-tauri-drag-region style={{ flex: 1, height: '100%', cursor: 'default' }} />

      {/* GPU Hardware Status Badge & Control Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {hardwareName && (
          <div
            data-tauri-drag-region
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
              color: isGpu ? '#34d399' : '#fb7185',
            }}
          >
            {isGpu ? <Zap size={12} /> : <Cpu size={12} />}
            <span>{hardwareName}</span>
            {encoderName && <span style={{ opacity: 0.7 }}>({encoderName})</span>}
          </div>
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
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
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
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
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
              color: '#94a3b8',
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
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
