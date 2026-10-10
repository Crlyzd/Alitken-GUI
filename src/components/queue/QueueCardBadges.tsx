import React from 'react';
import { AlertCircle, Scissors, Crop } from 'lucide-react';
import { FileItem } from '../../types/queue';

interface QueueCardBadgesProps {
  file: FileItem;
  hasTrim: boolean;
  hasCrop: boolean;
  trimmedDuration: number;
  formatDuration: (sec?: number) => string;
}

export const QueueCardBadges: React.FC<QueueCardBadgesProps> = ({
  file,
  hasTrim,
  hasCrop,
  trimmedDuration,
  formatDuration,
}) => {
  if (!file.isMissing && !file.isCorrupted && !hasTrim && !hasCrop) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'nowrap',
      }}
    >
      {file.isMissing && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3.5px',
            background: 'rgba(244, 63, 94, 0.18)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#fb7185',
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <AlertCircle size={10} /> Missing
        </span>
      )}
      {file.isCorrupted && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3.5px',
            background: 'rgba(244, 63, 94, 0.18)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#fb7185',
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          title={file.corruptReason}
        >
          <AlertCircle size={10} /> {file.corruptReason || 'Invalid / 0 B'}
        </span>
      )}
      {hasTrim && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            color: 'var(--accent-cyan)',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '10px',
            whiteSpace: 'nowrap',
          }}
          title={`Trimmed selection: ${formatDuration(trimmedDuration)}`}
        >
          <Scissors size={10} /> {formatDuration(trimmedDuration)}
        </span>
      )}
      {hasCrop && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            color: '#c084fc',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '10px',
            whiteSpace: 'nowrap',
          }}
          title="Crop applied"
        >
          <Crop size={10} />{' '}
          {file.aspectRatio && file.aspectRatio !== 'ORIGINAL' ? file.aspectRatio : 'Crop'}
        </span>
      )}
    </div>
  );
};
