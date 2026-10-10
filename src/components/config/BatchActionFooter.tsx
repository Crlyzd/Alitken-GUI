import React from 'react';
import { Scissors, Link2, Image, Zap } from 'lucide-react';
import { ConfigState } from '../../types/config';

export interface BatchActionFooterProps {
  config: ConfigState;
  disabled: boolean;
  isTrimmerMode: boolean;
  isCombineMismatch: boolean;
  isCropFastConcatConflict: boolean;
  fileCount: number;
  onStart: () => void;
  onStartTrim?: () => void;
}

export const BatchActionFooter: React.FC<BatchActionFooterProps> = ({
  config,
  disabled,
  isTrimmerMode,
  isCombineMismatch,
  isCropFastConcatConflict,
  fileCount,
  onStart,
  onStartTrim,
}) => {
  const isActionDisabled =
    disabled ||
    isCombineMismatch ||
    isCropFastConcatConflict ||
    (!isTrimmerMode && config.videoAction === 'COMBINE' && fileCount < 2) ||
    (!isTrimmerMode && config.videoAction === 'EXTRACT_FRAMES' && fileCount === 0);

  const getTitle = () => {
    if (!isTrimmerMode && isCropFastConcatConflict) {
      return 'Lossless stream copy cannot apply crops. Uncheck "Lossless Fast Concat" above to combine with re-encoding.';
    }
    if (!isTrimmerMode && isCombineMismatch) {
      return 'Lossless Copy is enabled but streams differ. Uncheck Lossless Copy to transcode and combine.';
    }
    if (!isTrimmerMode && config.videoAction === 'COMBINE' && fileCount < 2) {
      return 'Add at least 2 videos to combine';
    }
    return undefined;
  };

  return (
    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
      <button
        type="button"
        onClick={isTrimmerMode ? onStartTrim || onStart : onStart}
        disabled={isActionDisabled}
        title={getTitle()}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          border: isActionDisabled ? '1px solid var(--btn-disabled-border)' : 'none',
          background: isActionDisabled
            ? 'var(--btn-disabled-bg)'
            : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          color: isActionDisabled ? 'var(--btn-disabled-text)' : '#ffffff',
          fontWeight: 700,
          fontSize: '14px',
          cursor: isActionDisabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          opacity: isActionDisabled ? 0.7 : 1,
          boxShadow: isActionDisabled ? 'none' : '0 6px 24px rgba(99, 102, 241, 0.45)',
          transition: 'all 0.2s ease',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {isTrimmerMode ? (
          <>
            <Scissors size={16} /> EXPORT TRIMMED CLIP
          </>
        ) : config.videoAction === 'COMBINE' ? (
          <>
            <Link2 size={16} /> START COMBINE
          </>
        ) : config.videoAction === 'EXTRACT_FRAMES' ? (
          <>
            <Image size={16} /> EXTRACT ALL FRAMES
          </>
        ) : config.videoAction === 'SPLIT' ? (
          <>
            <Scissors size={16} /> START SPLIT
          </>
        ) : (
          <>
            <Zap size={16} /> START CONVERT
          </>
        )}
      </button>
    </div>
  );
};
