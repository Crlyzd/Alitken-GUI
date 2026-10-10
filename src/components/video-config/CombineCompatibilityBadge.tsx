import React from 'react';
import { Link2, Loader2, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { StreamCompatibilityResult } from '../../types/media';

interface CombineCompatibilityBadgeProps {
  fileCount: number;
  isCheckingCompatibility: boolean;
  streamCompatibility?: StreamCompatibilityResult | null;
  croppedFilesCount: number;
  combineFastCopy: boolean;
  isStreamIncompatible: boolean;
}

export const CombineCompatibilityBadge: React.FC<CombineCompatibilityBadgeProps> = ({
  fileCount,
  isCheckingCompatibility,
  streamCompatibility,
  croppedFilesCount,
  combineFastCopy,
  isStreamIncompatible,
}) => {
  let statusColor = 'var(--text-muted)';
  let statusIcon = <Link2 size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />;
  let statusText = 'Add 2+ videos to check compatibility';

  if (fileCount < 2) {
    statusText = 'Add 2+ videos to check compatibility';
  } else if (isCheckingCompatibility) {
    statusColor = 'var(--accent-cyan)';
    statusIcon = (
      <Loader2
        size={12}
        className="spin"
        style={{ flexShrink: 0, color: 'var(--accent-cyan)' }}
      />
    );
    statusText = 'Checking stream compatibility...';
  } else if (streamCompatibility?.is_compatible) {
    if (croppedFilesCount > 0) {
      if (combineFastCopy) {
        statusColor = '#c084fc';
        statusIcon = <Info size={12} style={{ flexShrink: 0, color: '#c084fc' }} />;
        statusText = 'Streams Matched • Uncheck Lossless to apply crops';
      } else {
        statusColor = '#c084fc';
        statusIcon = <Info size={12} style={{ flexShrink: 0, color: '#c084fc' }} />;
        statusText = `Streams Matched • Transcoding ${croppedFilesCount} cropped clip${
          croppedFilesCount > 1 ? 's' : ''
        }`;
      }
    } else {
      statusColor = 'var(--accent-emerald)';
      statusIcon = (
        <CheckCircle size={12} style={{ flexShrink: 0, color: 'var(--accent-emerald)' }} />
      );
      statusText = combineFastCopy
        ? 'Streams Compatible (Lossless Ready)'
        : 'Streams Compatible (Transcode Active)';
    }
  } else if (isStreamIncompatible) {
    statusColor = 'var(--accent-rose)';
    statusIcon = (
      <AlertTriangle size={12} style={{ flexShrink: 0, color: 'var(--accent-rose)' }} />
    );
    statusText = 'Streams Incompatible';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 500,
        color: statusColor,
        minHeight: '20px',
        lineHeight: '1.35',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {statusIcon}
      <span>{statusText}</span>
    </div>
  );
};
