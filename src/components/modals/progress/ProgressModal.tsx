import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ProgressState } from '../../../types/progress';
import { ProgressBarSection } from './ProgressBarSection';
import { ProgressTelemetrySection } from './ProgressTelemetrySection';
import { ProgressActionsSection } from './ProgressActionsSection';

export interface ProgressModalProps {
  progress: ProgressState;
  onClose: () => void;
  onOpenDestination?: () => void;
  onAbort?: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  progress,
  onClose,
  onOpenDestination,
  onAbort,
}) => {
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  if (!progress.isProcessing && !progress.completed && !progress.error) {
    return null;
  }

  const isDownload = progress.type === 'download';
  const isSingleOutput = Boolean(progress.isSingleOutput);
  const completedCount = isSingleOutput ? 0 : Math.max(0, progress.fileIndex - 1);
  const isAborted = Boolean(
    progress.error &&
      (progress.error.toLowerCase().includes('abort') ||
        progress.error.toLowerCase().includes('cancel'))
  );
  const isFileMissing = Boolean(
    progress.error &&
      (progress.error.toLowerCase().includes('not found') ||
        progress.error.toLowerCase().includes('deleted or moved'))
  );

  const handleClose = () => {
    setShowConfirmCancel(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          borderRadius: '16px',
          padding: '26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Top-Right Absolute Close / Abort (X) Button */}
        {progress.isProcessing && !showConfirmCancel && (
          <button
            onClick={() => setShowConfirmCancel(true)}
            title="Cancel Operation"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(244, 63, 94, 0.18)';
              e.currentTarget.style.color = '#f43f5e';
              e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
          >
            <X size={14} />
          </button>
        )}

        {!showConfirmCancel && (
          <>
            <ProgressTelemetrySection
              progress={progress}
              isDownload={isDownload}
              isAborted={isAborted}
              completedCount={completedCount}
              isSingleOutput={isSingleOutput}
              isFileMissing={isFileMissing}
            />

            <ProgressBarSection progress={progress} isDownload={isDownload} />
          </>
        )}

        <ProgressActionsSection
          progress={progress}
          showConfirmCancel={showConfirmCancel}
          setShowConfirmCancel={setShowConfirmCancel}
          onAbort={onAbort}
          onOpenDestination={onOpenDestination}
          onClose={handleClose}
          isDownload={isDownload}
          completedCount={completedCount}
        />
      </div>
    </div>
  );
};
