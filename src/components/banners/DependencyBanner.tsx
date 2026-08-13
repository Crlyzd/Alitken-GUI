import React from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { DepsStatus } from '../../hooks/useAppTelemetry';

interface DependencyBannerProps {
  depsStatus: DepsStatus;
  theme: 'dark' | 'light';
  isDownloadingDeps: boolean;
  onDownload: (mode: 'all' | 'ffmpeg' | 'magick') => void;
}

export const DependencyBanner: React.FC<DependencyBannerProps> = ({
  depsStatus,
  theme,
  isDownloadingDeps,
  onDownload,
}) => {
  if (depsStatus.ffmpeg && depsStatus.ffprobe && depsStatus.magick) {
    return null;
  }

  const downloadMode =
    !depsStatus.ffmpeg && !depsStatus.magick
      ? 'all'
      : !depsStatus.ffmpeg || !depsStatus.ffprobe
      ? 'ffmpeg'
      : 'magick';

  return (
    <div
      style={{
        margin: '8px 12px 0 12px',
        padding: '7px 14px',
        borderRadius: '10px',
        background:
          theme === 'light'
            ? 'rgba(255, 241, 242, 0.92)'
            : 'rgba(244, 63, 94, 0.12)',
        border:
          theme === 'light'
            ? '1px solid rgba(244, 63, 94, 0.25)'
            : '1px solid rgba(244, 63, 94, 0.3)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        boxShadow:
          theme === 'light'
            ? '0 4px 12px rgba(244, 63, 94, 0.08)'
            : '0 4px 16px rgba(0, 0, 0, 0.2)',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flex: 1,
        }}
      >
        <AlertCircle
          size={15}
          color={theme === 'light' ? '#be123c' : '#fb7185'}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            color: theme === 'light' ? '#9f1239' : '#fda4af',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {!depsStatus.ffmpeg && !depsStatus.magick
            ? 'Media dependencies missing (FFmpeg & ImageMagick)'
            : !depsStatus.ffmpeg || !depsStatus.ffprobe
            ? 'FFmpeg portable binaries missing'
            : 'ImageMagick binary (magick.exe) missing'}
        </span>
      </div>

      <button
        onClick={() => onDownload(downloadMode)}
        disabled={isDownloadingDeps}
        style={{
          background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '7px',
          padding: '4px 12px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: isDownloadingDeps ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(244, 63, 94, 0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <Download size={12} />
        {!depsStatus.ffmpeg && !depsStatus.magick
          ? 'Auto-Download All'
          : !depsStatus.ffmpeg || !depsStatus.ffprobe
          ? 'Auto-Download FFmpeg'
          : 'Auto-Download ImageMagick'}
      </button>
    </div>
  );
};
