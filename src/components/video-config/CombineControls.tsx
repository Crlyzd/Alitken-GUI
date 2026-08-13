import React from 'react';
import { Zap, AlertTriangle, Link2, Loader2, CheckCircle } from 'lucide-react';
import { ConfigState } from '../ConfigPanel';
import { StreamCompatibilityResult } from '../../types/media';

interface CombineControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  streamCompatibility?: StreamCompatibilityResult | null;
  isCheckingCompatibility?: boolean;
  fileCount: number;
  isCombineMismatch: boolean;
}

export const CombineControls: React.FC<CombineControlsProps> = ({
  config,
  onChange,
  streamCompatibility,
  isCheckingCompatibility = false,
  fileCount,
  isCombineMismatch,
}) => {
  return (
    <div
      style={{
        padding: '14px',
        borderRadius: '12px',
        background: 'var(--bg-glass-card)',
        border: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap
            size={16}
            style={{
              color: config.combineFastCopy ? 'var(--accent-cyan)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
              Lossless Fast Concat
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Instant stream copy with 0% quality loss (-c copy)
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={config.combineFastCopy}
          onChange={(e) => onChange({ combineFastCopy: e.target.checked })}
          style={{
            width: '16px',
            height: '16px',
            accentColor: 'var(--accent-cyan)',
            cursor: 'pointer',
          }}
        />
      </label>

      {/* Stream Mismatch Warning Card */}
      {isCombineMismatch && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle
            size={16}
            color="#f59e0b"
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div style={{ fontSize: '11px', color: '#fcd34d', lineHeight: '1.4' }}>
            {streamCompatibility?.reason}
          </div>
        </div>
      )}

      {/* Permanent Stream Compatibility Status Line */}
      {config.combineFastCopy && (() => {
        let statusColor = 'var(--text-muted)';
        let statusIcon = <Link2 size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />;
        let statusText = 'Add 2+ videos to check compatibility';

        if (fileCount < 2) {
          statusText = 'Add 2+ videos to check compatibility';
        } else if (isCheckingCompatibility) {
          statusColor = 'var(--accent-cyan)';
          statusIcon = <Loader2 size={12} className="spin" style={{ flexShrink: 0, color: 'var(--accent-cyan)' }} />;
          statusText = 'Checking stream compatibility...';
        } else if (streamCompatibility?.is_compatible) {
          statusColor = 'var(--accent-emerald)';
          statusIcon = <CheckCircle size={12} style={{ flexShrink: 0, color: 'var(--accent-emerald)' }} />;
          statusText = 'Streams Compatible (Lossless Ready)';
        } else if (streamCompatibility && !streamCompatibility.is_compatible) {
          statusColor = 'var(--accent-rose)';
          statusIcon = <AlertTriangle size={12} style={{ flexShrink: 0, color: 'var(--accent-rose)' }} />;
          statusText = 'Streams Incompatible (Will Re-encode)';
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
              height: '20px',
              lineHeight: '20px',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {statusIcon}
            <span>{statusText}</span>
          </div>
        );
      })()}

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Output Filename Field */}
      <div>
        <label
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Combined Output Filename:
        </label>
        <input
          type="text"
          value={config.combineOutputName}
          placeholder="combined_output"
          onChange={(e) =>
            onChange({
              combineOutputName: e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ''),
            })
          }
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-main)',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Order Info Card */}
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          fontSize: '11px',
          color: 'var(--accent-cyan)',
          lineHeight: '1.4',
        }}
      >
        ℹ {fileCount} videos will be joined in queue order. Reorder via queue sort.
      </div>
    </div>
  );
};
