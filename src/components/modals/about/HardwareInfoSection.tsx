import React from 'react';
import { Cpu, Zap } from 'lucide-react';

export interface HardwareInfoSectionProps {
  hardwareInfo?: {
    name: string;
    encoder: string;
    details?: string;
  };
}

export const HardwareInfoSection: React.FC<HardwareInfoSectionProps> = ({ hardwareInfo }) => {
  const isGpu = hardwareInfo?.name && !hardwareInfo.name.toLowerCase().includes('cpu');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
      {hardwareInfo?.name && (
        <div
          title={hardwareInfo.details || undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: isGpu ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${isGpu ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: isGpu ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              {isGpu ? <Zap size={12} style={{ flexShrink: 0 }} /> : <Cpu size={12} style={{ flexShrink: 0 }} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Active Encoder: {hardwareInfo.name}
              </span>
            </div>
            {hardwareInfo.encoder && <span style={{ opacity: 0.85, flexShrink: 0, whiteSpace: 'nowrap' }}>({hardwareInfo.encoder})</span>}
          </div>
          {hardwareInfo.details && (
            <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 400, wordBreak: 'break-word', lineHeight: '1.35', marginTop: '2px' }}>
              {hardwareInfo.details}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', color: 'var(--text-muted)' }}>
        <span>Engine: Tauri v2 &middot; Rust Tokio</span>
        <span>Powered by FFmpeg (GPLv3) &amp; ImageMagick</span>
      </div>
    </div>
  );
};
