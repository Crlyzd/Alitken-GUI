import React, { useEffect } from 'react';
import { AlertOctagon, AlertTriangle, HardDrive, FileVideo, X } from 'lucide-react';

export interface StorageValidationModalProps {
  isOpen: boolean;
  status: 'HardFailure' | 'LowStorageWarning' | 'LargeFileWarning' | null;
  freeBytes: number;
  requiredBytes: number;
  /** Raw input file size in bytes (used for the LargeFileWarning copy). */
  fileSizeBytes?: number;
  /** Current app theme — used to adapt all inline colours. Defaults to 'dark'. */
  theme?: 'dark' | 'light';
  onProceed: () => void;
  onCancel: () => void;
}

export const StorageValidationModal: React.FC<StorageValidationModalProps> = ({
  isOpen,
  status,
  freeBytes,
  requiredBytes,
  fileSizeBytes = 0,
  theme = 'dark',
  onProceed,
  onCancel,
}) => {
  const isDark = theme !== 'light';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !status) return null;

  const isHardFailure = status === 'HardFailure';
  const isLowStorage = status === 'LowStorageWarning';
  const isLargeFile = status === 'LargeFileWarning';

  const freeGB = (freeBytes / (1024 ** 3)).toFixed(1);
  const requiredGB = (requiredBytes / (1024 ** 3)).toFixed(1);
  const requiredMB = (requiredBytes / (1024 ** 2)).toFixed(0);
  const fileGB = (fileSizeBytes / (1024 ** 3)).toFixed(1);

  // ── Theme-derived base colours ───────────────────────────────────────────
  const colorText       = isDark ? '#ffffff'                   : '#0f172a';   // --text-main
  const colorMuted      = isDark ? 'rgba(255,255,255,0.70)'   : '#334155';   // --text-muted
  const colorDim        = isDark ? 'rgba(255,255,255,0.55)'   : '#475569';   // --text-dim
  const colorClose      = isDark ? 'rgba(255,255,255,0.40)'   : 'rgba(0,0,0,0.35)';
  const colorCloseHover = isDark ? '#ffffff'                   : '#0f172a';

  const pillBg          = isDark ? 'rgba(255,255,255,0.04)'   : 'rgba(0,0,0,0.04)';
  const pillBorder      = isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(0,0,0,0.08)';
  const pillText        = isDark ? 'rgba(255,255,255,0.65)'   : '#475569';

  const codeBg          = isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(0,0,0,0.06)';
  const codeText        = isDark ? 'rgba(255,255,255,0.75)'   : '#334155';

  const cancelBg        = isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(0,0,0,0.05)';
  const cancelText      = isDark ? 'rgba(255,255,255,0.70)'   : '#334155';
  const cancelBorder    = isDark ? 'rgba(255,255,255,0.10)'   : 'rgba(0,0,0,0.12)';
  const cancelHoverBg   = isDark ? 'rgba(255,255,255,0.10)'   : 'rgba(0,0,0,0.09)';

  const gotItBg         = isDark ? 'rgba(255,255,255,0.10)'   : 'rgba(0,0,0,0.07)';
  const gotItBorder     = isDark ? 'rgba(255,255,255,0.15)'   : 'rgba(0,0,0,0.14)';
  const gotItHoverBg    = isDark ? 'rgba(255,255,255,0.18)'   : 'rgba(0,0,0,0.12)';

  const overlayBg       = isDark ? 'rgba(0,0,0,0.65)'        : 'rgba(0,0,0,0.35)';
  const panelShadow     = isDark
    ? '0 24px 48px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.10)'
    : '0 24px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)';

  // ── Icon & accent colour per status ─────────────────────────────────────
  const accent      = isHardFailure ? '#ef4444' : isLowStorage ? '#f59e0b' : '#60a5fa';
  const accentAlpha = isHardFailure
    ? 'rgba(239, 68, 68, 0.15)'
    : isLowStorage
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(96, 165, 250, 0.12)';

  const Icon = isHardFailure ? AlertOctagon : isLowStorage ? AlertTriangle : FileVideo;

  // ── Title ────────────────────────────────────────────────────────────────
  const title = isHardFailure
    ? 'Insufficient Disk Space for Editing'
    : isLowStorage
    ? 'Low Disk Space Warning'
    : `Large Video File Notice (${fileGB} GB)`;

  // ── Body copy ────────────────────────────────────────────────────────────
  const Body = () => {
    if (isHardFailure) {
      return (
        <>
          Editing this video requires temporary preview caching (~
          <strong style={{ color: colorText }}>{requiredGB} GB</strong>), but your drive only has{' '}
          <strong style={{ color: '#ef4444' }}>{freeGB} GB</strong> of free space remaining.
          <br />
          <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
            Please free up disk space before entering edit mode.
          </span>
        </>
      );
    }
    if (isLowStorage) {
      return (
        <>
          Your drive is running low on space (
          <strong style={{ color: '#f59e0b' }}>{freeGB} GB</strong> remaining). Opening this video in
          edit mode will use ~<strong style={{ color: colorText }}>{requiredMB} MB</strong> for temporary
          preview caching.
          <br />
          <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
            Do you want to continue?
          </span>
        </>
      );
    }
    // LargeFileWarning
    return (
      <>
        Opening this large video file (<strong style={{ color: colorText }}>{fileGB} GB</strong>) will
        create ~<strong style={{ color: '#60a5fa' }}>{requiredGB} GB</strong> of temporary preview
        cache in{' '}
        <code
          style={{
            fontSize: '11px',
            backgroundColor: codeBg,
            borderRadius: '4px',
            padding: '1px 5px',
            color: codeText,
          }}
        >
          %LOCALAPPDATA%\Alitken\temp\
        </code>
        .
        <br />
        <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
          Pre-rendering the preview timeline may take a few moments. Do you want to continue?
        </span>
      </>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: overlayBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '460px',
          maxWidth: '90vw',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: panelShadow,
          position: 'relative',
        }}
      >
        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accentAlpha,
              color: accent,
              flexShrink: 0,
            }}
          >
            <Icon size={24} />
          </div>

          <div style={{ flex: 1, paddingTop: '2px' }}>
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 600,
                color: colorText,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: colorMuted,
                margin: '6px 0 0 0',
                lineHeight: 1.6,
              }}
            >
              <Body />
            </p>
          </div>

          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: colorClose,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colorCloseHover)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colorClose)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Informational Storage Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: pillBg,
            borderRadius: '12px',
            padding: '10px 14px',
            border: `1px solid ${pillBorder}`,
            fontSize: '12px',
            color: pillText,
          }}
        >
          <HardDrive size={16} style={{ opacity: isDark ? 0.7 : 0.55, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
            <span>Available Drive Space:</span>
            <span style={{ fontWeight: 600, color: accent }}>{freeGB} GB</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          {isHardFailure ? (
            <button
              onClick={onCancel}
              style={{
                backgroundColor: gotItBg,
                color: colorText,
                border: `1px solid ${gotItBorder}`,
                padding: '8px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = gotItHoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = gotItBg)}
            >
              Got It
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                style={{
                  backgroundColor: cancelBg,
                  color: cancelText,
                  border: `1px solid ${cancelBorder}`,
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = cancelHoverBg;
                  e.currentTarget.style.color = colorText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = cancelBg;
                  e.currentTarget.style.color = cancelText;
                }}
              >
                Cancel
              </button>
              <button
                onClick={onProceed}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
              >
                {isLargeFile ? 'Proceed to Editor' : 'Proceed Anyway'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
