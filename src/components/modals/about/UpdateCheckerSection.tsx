import React from 'react';
import {
  CheckCircle2,
  ArrowUpCircle,
  ExternalLink,
  Loader2,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { APP_VERSION } from '../../../utils/version';
import { UpdateInfo, UpdateProgressPayload } from '../../../types/update';

export interface UpdateCheckerSectionProps {
  updateInfo: UpdateInfo | null;
  onCheckUpdate: () => Promise<void>;
  onInstallUpdate: (downloadUrl: string) => Promise<void>;
  isCheckingUpdate: boolean;
  updateProgress: UpdateProgressPayload | null;
  updateError: string | null;
}

export const UpdateCheckerSection: React.FC<UpdateCheckerSectionProps> = ({
  updateInfo,
  onCheckUpdate,
  onInstallUpdate,
  isCheckingUpdate,
  updateProgress,
  updateError,
}) => {
  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* Auto-Update Feature Streamlined Section */}
      {updateInfo?.is_store_build ? (
        /* State: Microsoft Store Build Notice */
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
            <CheckCircle2 size={14} color="var(--accent-emerald)" />
            <span>
              ALITKEN v{updateInfo ? updateInfo.current_version : APP_VERSION}{' '}
              <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>(MS Store Build)</span>
            </span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--accent-cyan)', fontWeight: 500 }}>Auto-Updated</span>
        </div>
      ) : updateInfo?.available ? (
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
              <ArrowUpCircle size={16} color="var(--accent-emerald)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                Update Available: v{updateInfo.latest_version}
              </span>
            </div>
            {updateInfo.release_notes_url && (
              <button
                onClick={() => handleOpenLink(updateInfo.release_notes_url!)}
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
            <CheckCircle2 size={14} color="var(--accent-emerald)" />
            <span>
              ALITKEN v{updateInfo ? updateInfo.current_version : APP_VERSION}{' '}
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
            onClick={() => handleOpenLink('https://github.com/Crlyzd/Alitken-GUI/releases')}
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
    </>
  );
};
