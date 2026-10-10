import React from 'react';
import { Zap, Info } from 'lucide-react';

export interface TrimmerActionBannerProps {
  fastCopyTrim: boolean;
  onFastCopyTrimChange?: (val: boolean) => void;
  isFastCopyTrimDisabled?: boolean;
  fastCopyTrimDisabledReason?: string;
}

export const TrimmerActionBanner: React.FC<TrimmerActionBannerProps> = ({
  fastCopyTrim,
  onFastCopyTrimChange,
  isFastCopyTrimDisabled = false,
  fastCopyTrimDisabledReason,
}) => {
  if (!onFastCopyTrimChange) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div
        onClick={() => {
          if (!isFastCopyTrimDisabled) {
            onFastCopyTrimChange(!fastCopyTrim);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '10px',
          background: (!isFastCopyTrimDisabled && fastCopyTrim)
            ? 'rgba(6, 182, 212, 0.12)'
            : 'var(--input-bg)',
          border: `1px solid ${
            (!isFastCopyTrimDisabled && fastCopyTrim)
              ? 'rgba(6, 182, 212, 0.4)'
              : 'var(--border-glass)'
          }`,
          cursor: isFastCopyTrimDisabled ? 'not-allowed' : 'pointer',
          opacity: isFastCopyTrimDisabled ? 0.65 : 1,
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
        title={isFastCopyTrimDisabled ? fastCopyTrimDisabledReason : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap
            size={18}
            style={{
              color: (!isFastCopyTrimDisabled && fastCopyTrim)
                ? 'var(--accent-cyan)'
                : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isFastCopyTrimDisabled ? 'var(--text-muted)' : 'var(--text-main)',
              }}
            >
              Lossless Copy
            </div>
            <div
              style={{
                fontSize: '10.5px',
                color: 'var(--text-dim)',
                marginTop: '2px',
              }}
            >
              {isFastCopyTrimDisabled
                ? 'Unavailable when speed or crop is modified'
                : 'Lossless instant cut without re-encoding'}
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={!isFastCopyTrimDisabled && fastCopyTrim}
          disabled={isFastCopyTrimDisabled}
          onChange={(e) => {
            if (!isFastCopyTrimDisabled) {
              onFastCopyTrimChange(e.target.checked);
            }
          }}
          style={{
            accentColor: 'var(--accent-cyan)',
            cursor: isFastCopyTrimDisabled ? 'not-allowed' : 'pointer',
            transform: 'scale(1.2)',
          }}
        />
      </div>

      {/* Informative reason banner when Lossless Copy is disabled */}
      {isFastCopyTrimDisabled && fastCopyTrimDisabledReason && (
        <div
          style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={14} color="#c084fc" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-main)',
              lineHeight: '1.35',
            }}
          >
            {fastCopyTrimDisabledReason}
          </span>
        </div>
      )}
    </div>
  );
};
