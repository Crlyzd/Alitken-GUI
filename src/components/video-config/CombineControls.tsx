import React, { useMemo } from 'react';
import { Zap, AlertTriangle, Info } from 'lucide-react';
import { ConfigState } from '../ConfigPanel';
import { StreamCompatibilityResult } from '../../types/media';
import { FileItem } from '../../types/queue';
import { CombineCompatibilityBadge } from './CombineCompatibilityBadge';
import { CombineDurationCard } from './CombineDurationCard';

interface CombineControlsProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  streamCompatibility?: StreamCompatibilityResult | null;
  isCheckingCompatibility?: boolean;
  fileCount: number;
  files?: FileItem[];
  croppedFilesCount?: number;
}

export const CombineControls: React.FC<CombineControlsProps> = ({
  config,
  onChange,
  streamCompatibility,
  isCheckingCompatibility = false,
  fileCount,
  files,
  croppedFilesCount = 0,
}) => {
  const isStreamIncompatible = !!streamCompatibility && !streamCompatibility.is_compatible;
  const hasCropInFastConcat = !!config.combineFastCopy && croppedFilesCount > 0;

  const totalCombinedDurationSec = useMemo(() => {
    if (!files || files.length === 0) return 0;
    return files.reduce((sum, f) => {
      if (
        f.trimStartSec !== undefined &&
        f.trimEndSec !== undefined &&
        f.trimEndSec > f.trimStartSec
      ) {
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
            ? 'Lossless Merge is disabled because input streams differ (codecs or resolutions mismatch).'
            : undefined
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap
            size={16}
            style={{
              color:
                config.combineFastCopy && !isStreamIncompatible
                  ? 'var(--accent-cyan)'
                  : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
              Lossless Merge
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isStreamIncompatible
                ? 'Unavailable for mismatched streams (requires matching formats)'
                : 'Instant stream merge with 0% quality loss (no re-encoding)'}
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

      {/* Crop detected warning in Combine Lossless Mode */}
      {hasCropInFastConcat && (
        <div
          style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <Info size={15} color="#c084fc" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: '1.35' }}>
            Cropped clips detected. Lossless merge preserves original frame sizes without
            re-encoding. To combine and apply your crops, please uncheck{' '}
            <strong>Lossless Merge</strong> above.
          </span>
        </div>
      )}

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
          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--warning-text)',
              lineHeight: '1.3',
            }}
          >
            {streamCompatibility?.reason}
          </div>
        </div>
      )}

      {/* Permanent Stream Compatibility Status Line */}
      <CombineCompatibilityBadge
        fileCount={fileCount}
        isCheckingCompatibility={isCheckingCompatibility}
        streamCompatibility={streamCompatibility}
        croppedFilesCount={croppedFilesCount}
        combineFastCopy={Boolean(config.combineFastCopy)}
        isStreamIncompatible={isStreamIncompatible}
      />

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
      <CombineDurationCard
        totalCombinedDurationSec={totalCombinedDurationSec}
        fileCount={fileCount}
      />
    </div>
  );
};
