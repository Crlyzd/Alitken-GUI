import React from 'react';
import { Film, Image, RefreshCw, Trash2, Download, Sparkles } from 'lucide-react';
import { DependencyStatus } from '../../types/media';
import { EngineStatusRow } from './EngineStatusRow';

interface MediaEnginesSectionProps {
  deps: DependencyStatus | null;
  loadingDeps: boolean;
  theme: 'dark' | 'light';
  onClose: () => void;
  onUpdateEngine?: (engine: 'ffmpeg' | 'magick' | 'all') => void;
  handleInstallAppData: () => Promise<void>;
  handleUninstallDeps: () => Promise<void>;
  handleOpenAppDataFolder: (e: React.MouseEvent) => Promise<void>;
}

export const MediaEnginesSection: React.FC<MediaEnginesSectionProps> = ({
  deps,
  loadingDeps,
  theme,
  onClose,
  onUpdateEngine,
  handleInstallAppData,
  handleUninstallDeps,
  handleOpenAppDataFolder,
}) => {
  const isAllInstalledAndValid =
    deps?.ffmpeg_exists &&
    deps?.magick_exists &&
    deps?.ffmpeg_valid &&
    deps?.magick_valid &&
    !deps?.has_update &&
    !deps?.magick_has_update;

  const isAnyOutdated =
    deps?.has_update ||
    deps?.magick_has_update ||
    (!deps?.ffmpeg_valid && deps?.ffmpeg_exists) ||
    (!deps?.magick_valid && deps?.magick_exists);

  const handleEngineClick = (engine: 'ffmpeg' | 'magick') => {
    onClose();
    if (onUpdateEngine) {
      onUpdateEngine(engine);
    } else {
      handleInstallAppData();
    }
  };

  const handleBulkActionClick = () => {
    onClose();
    if (onUpdateEngine) {
      onUpdateEngine('all');
    } else {
      handleInstallAppData();
    }
  };

  return (
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
          <EngineStatusRow
            engineName="FFmpeg"
            icon={<Film size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            version={deps?.ffmpeg_version}
            exists={deps?.ffmpeg_exists}
            valid={deps?.ffmpeg_valid}
            hasUpdate={deps?.has_update}
            latestVersion={deps?.ffmpeg_latest_version}
            minVersionLabel="5.0"
            defaultLatestVersion="7.1"
            theme={theme}
            onBadgeClick={() => handleEngineClick('ffmpeg')}
          />

          {/* ImageMagick Engine */}
          <EngineStatusRow
            engineName="ImageMagick"
            icon={<Image size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            version={deps?.magick_version}
            exists={deps?.magick_exists}
            valid={deps?.magick_valid}
            hasUpdate={deps?.magick_has_update}
            latestVersion={deps?.magick_latest_version}
            minVersionLabel="7.0"
            defaultLatestVersion="7.1.2"
            theme={theme}
            onBadgeClick={() => handleEngineClick('magick')}
          />
        </div>

        {/* Dynamic Action Button & Contextual Sub-caption */}
        {(() => {
          if (isAllInstalledAndValid) {
            return (
              <>
                <button
                  onClick={handleUninstallDeps}
                  disabled={loadingDeps}
                  style={{
                    marginTop: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'var(--btn-danger-bg, rgba(244, 63, 94, 0.15))',
                    color: 'var(--btn-danger-text, #fb7185)',
                    border: '1px solid var(--btn-danger-border, rgba(244, 63, 94, 0.3))',
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
                  Binaries and logs are in{' '}
                  <span
                    onClick={handleOpenAppDataFolder}
                    style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                    title="Open AppData folder in Windows File Explorer"
                  >
                    AppData
                  </span>. Click uninstall to delete all binaries, logs, and AppData folder.
                </div>
              </>
            );
          }

          if (isAnyOutdated) {
            return (
              <>
                <button
                  onClick={handleBulkActionClick}
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
                  Updates binaries in{' '}
                  <span
                    onClick={handleOpenAppDataFolder}
                    style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                    title="Open AppData folder in Windows File Explorer"
                  >
                    AppData
                  </span> to the latest releases.
                </div>
              </>
            );
          }

          // Missing / Default state
          return (
            <>
              <button
                onClick={handleBulkActionClick}
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
                <span>{loadingDeps ? 'Installing...' : 'Install Binaries to AppData'}</span>
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
                Downloads and installs binaries directly into{' '}
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
        })()}
      </div>
    </div>
  );
};
