import React from 'react';
import { ProgressState } from '../../../types/progress';

export interface ProgressBarSectionProps {
  progress: ProgressState;
  isDownload: boolean;
}

export const ProgressBarSection: React.FC<ProgressBarSectionProps> = ({ progress, isDownload }) => {
  const isImageTask = progress.mediaKind === 'image' || progress.action === 'IMAGE';

  const label = isDownload
    ? progress.totalFiles > 1
      ? `Download Progress (${progress.fileIndex}/${progress.totalFiles})`
      : 'Download Progress'
    : isImageTask
    ? `Image ${progress.fileIndex} of ${progress.totalFiles}`
    : `File ${progress.fileIndex} of ${progress.totalFiles}${
        progress.totalParts > 1 ? ` (Part ${progress.currentPart}/${progress.totalParts})` : ''
      }`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, gap: '8px' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {label}
        </span>
        <span style={{ color: 'var(--accent-cyan)', flexShrink: 0 }}>
          {progress.completed ? '100.0' : progress.percent.toFixed(1)}%
        </span>
      </div>

      <div
        style={{
          height: '10px',
          borderRadius: '5px',
          background: 'rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress.completed ? 100 : progress.percent}%`,
            background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
            borderRadius: '5px',
            transition: 'width 0.2s ease',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
          }}
        />
      </div>

      {!progress.error && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-dim)',
            alignSelf: 'flex-end',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
          title={progress.status}
        >
          {progress.status}
        </span>
      )}
    </div>
  );
};
