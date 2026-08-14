import React, { useMemo } from 'react';
import { Zap, AlertTriangle, Link2, Loader2, CheckCircle, Clock } from 'lucide-react';
import { ConfigState } from '../ConfigPanel';
import { StreamCompatibilityResult } from '../../types/media';
import { FileItem } from '../Dropzone';

interface CombineControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  streamCompatibility?: StreamCompatibilityResult | null;
  isCheckingCompatibility?: boolean;
  fileCount: number;
  files?: FileItem[];
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

export const CombineControls: React.FC<CombineControlsProps> = ({
  config,
  onChange,
  streamCompatibility,
  isCheckingCompatibility = false,
  fileCount,
  files,
}) => {
  const isStreamIncompatible = !!streamCompatibility && !streamCompatibility.is_compatible;

  const totalCombinedDurationSec = useMemo(() => {
    if (!files || files.length === 0) return 0;
    return files.reduce((sum, f) => {
      if (f.trimStartSec !== undefined && f.trimEndSec !== undefined && f.trimEndSec > f.trimStartSec) {
        return sum + (f.trimEndSec - f.trimStartSec);
      }
      return sum + (f.durationSec || 0);
    }, 0);
  }, [files]);

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
          cursor: isStreamIncompatible ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          opacity: isStreamIncompatible ? 0.6 : 1,
        }}
        title={
          isStreamIncompatible
            ? 'Lossless Copy is disabled because input streams differ (codecs or resolutions mismatch).'
            : undefined
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap
            size={16}
            style={{
              color: config.combineFastCopy && !isStreamIncompatible ? 'var(--accent-cyan)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
              Lossless Fast Concat
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isStreamIncompatible
                ? 'Unavailable for mismatched streams (-c copy requires identical streams)'
                : 'Instant stream copy with 0% quality loss (-c copy)'}
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={config.combineFastCopy && !isStreamIncompatible}
          disabled={isStreamIncompatible}
          onChange={(e) => onChange({ combineFastCopy: e.target.checked })}
          style={{
            width: '16px',
            height: '16px',
            accentColor: 'var(--accent-cyan)',
            cursor: isStreamIncompatible ? 'not-allowed' : 'pointer',
          }}
        />
      </label>

      {/* Stream Mismatch Warning Card */}
      {isStreamIncompatible && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <AlertTriangle
            size={14}
            color="var(--accent-amber)"
            style={{ flexShrink: 0 }}
          />
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--warning-text)', lineHeight: '1.3' }}>
            {streamCompatibility?.reason}
          </div>
        </div>
      )}

      {/* Permanent Stream Compatibility Status Line */}
      {(() => {
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
        } else if (isStreamIncompatible) {
          statusColor = 'var(--accent-rose)';
          statusIcon = <AlertTriangle size={12} style={{ flexShrink: 0, color: 'var(--accent-rose)' }} />;
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

      {/* Single Consolidated Combined Duration & Queue Info Card */}
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
          {fileCount} {fileCount === 1 ? 'video' : 'videos'} joined in queue order (after clip trims). Reorder via queue sort.
        </div>
      </div>
    </div>
  );
};
