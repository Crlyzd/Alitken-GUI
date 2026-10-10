import React from 'react';
import { Cpu, Zap } from 'lucide-react';

export interface HardwareAccelPillProps {
  hardwareName?: string;
  encoderName?: string;
  hardwareDetails?: string;
}

export const HardwareAccelPill: React.FC<HardwareAccelPillProps> = ({
  hardwareName,
  encoderName,
  hardwareDetails,
}) => {
  if (!hardwareName) return null;

  const isGpu = !hardwareName.toLowerCase().includes('cpu');

  const displayHardwareName = hardwareName.includes('Software Fallback') || hardwareName.toLowerCase().includes('cpu')
    ? 'CPU (Software)'
    : hardwareName.includes('NVIDIA')
    ? 'NVIDIA NVENC'
    : hardwareName.includes('AMD')
    ? 'AMD AMF'
    : hardwareName.includes('Intel')
    ? 'Intel QSV'
    : hardwareName;

  const tooltipText = hardwareDetails
    ? `${displayHardwareName} ${encoderName ? `(${encoderName})` : ''} - ${hardwareDetails}`
    : encoderName
    ? `${hardwareName} (${encoderName})`
    : hardwareName || '';

  return (
    <div
      data-tauri-drag-region
      title={tooltipText}
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
        color: isGpu ? 'var(--accent-emerald)' : 'var(--accent-rose)',
        maxWidth: '180px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 1,
      }}
    >
      {isGpu ? <Zap size={12} style={{ flexShrink: 0 }} /> : <Cpu size={12} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayHardwareName}
      </span>
    </div>
  );
};
