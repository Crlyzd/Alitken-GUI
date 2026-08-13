import React from 'react';
import { Loader2, Film, Sparkles } from 'lucide-react';

export interface FileLoadingState {
  isLoading: boolean;
  loaded: number;
  total: number;
  currentFile: string;
}

interface FileLoadingOverlayProps {
  loadingState: FileLoadingState;
  hasExistingFiles: boolean;
}

export const FileLoadingOverlay: React.FC<FileLoadingOverlayProps> = ({
  loadingState,
  hasExistingFiles,
}) => {
  if (!loadingState.isLoading || loadingState.total === 0) {
    return null;
  }

  const percent = Math.min(100, Math.round((loadingState.loaded / loadingState.total) * 100));

  // Mode A: Top Glass Banner (when adding files to an existing queue)
  if (hasExistingFiles) {
    return (
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '100%',
          padding: '10px 16px',
          background: 'var(--bg-glass-dropdown)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: 'var(--shadow-panel)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <Loader2 size={20} color="var(--accent-cyan)" className="animate-spin" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Loading media files ({loadingState.loaded}/{loadingState.total}) &bull;{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{loadingState.currentFile}</span>
            </span>
            <span style={{ color: 'var(--accent-cyan)', flexShrink: 0 }}>{percent}%</span>
          </div>
          <div
            style={{
              height: '5px',
              width: '100%',
              background: 'var(--scrollbar-thumb)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                borderRadius: '3px',
                transition: 'width 0.15s ease',
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Mode B: Centered Frosted Glass Modal Overlay (for initial drop/selection on welcome screen)
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
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '20px',
          padding: '30px 26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
          boxShadow: 'var(--shadow-panel)',
          border: '1px solid var(--border-glass)',
        }}
      >
        {/* Animated Icon Ring */}
        <div
          style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(6, 182, 212, 0.25)',
          }}
        >
          <Film size={28} color="var(--accent-cyan)" />
          <div
            style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--accent-primary)',
              borderRightColor: 'var(--accent-cyan)',
              animation: 'spin 1.2s linear infinite',
            }}
          />
        </div>

        <div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            Loading Media Files <Sparkles size={16} color="var(--accent-cyan)" />
          </h3>
          <p
            style={{
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              margin: 0,
            }}
          >
            Analyzing codecs, dimensions & media duration...
          </p>
        </div>

        {/* Real-time Percentage Bar */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--text-main)' }}>
              Probing {loadingState.loaded} of {loadingState.total} files
            </span>
            <span style={{ color: 'var(--accent-cyan)' }}>{percent}%</span>
          </div>

          <div
            style={{
              height: '10px',
              borderRadius: '5px',
              background: 'var(--scrollbar-thumb)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                borderRadius: '5px',
                transition: 'width 0.15s ease',
                boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
              }}
            />
          </div>

          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--text-dim)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
            title={loadingState.currentFile}
          >
            {loadingState.currentFile || 'Initializing batch probe...'}
          </span>
        </div>
      </div>
    </div>
  );
};
