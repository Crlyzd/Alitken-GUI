import React from 'react';
import { Clock } from 'lucide-react';

interface CombineDurationCardProps {
  totalCombinedDurationSec: number;
  fileCount: number;
}

const formatTotalDuration = (sec: number): string => {
  if (!sec || sec <= 0) return '0s';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export const CombineDurationCard: React.FC<CombineDurationCardProps> = ({
  totalCombinedDurationSec,
  fileCount,
}) => {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'rgba(6, 182, 212, 0.08)',
        border: '1px solid rgba(6, 182, 212, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-cyan)',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={13} style={{ flexShrink: 0 }} />
          <span>Total Duration</span>
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--accent-cyan)',
            fontFamily: 'monospace',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            padding: '2px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatTotalDuration(totalCombinedDurationSec)}
        </span>
      </div>
      <div
        style={{
          fontSize: '10.5px',
          color: 'var(--text-muted)',
          lineHeight: '1.4',
        }}
      >
        {fileCount} {fileCount === 1 ? 'video' : 'videos'} joined in queue order (after clip trims).
        Reorder via queue sort.
      </div>
    </div>
  );
};
