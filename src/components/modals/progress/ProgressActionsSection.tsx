import React from 'react';
import { AlertCircle, FolderOpen, X } from 'lucide-react';
import { ProgressState } from '../../../types/progress';

export interface ProgressActionsSectionProps {
  progress: ProgressState;
  showConfirmCancel: boolean;
  setShowConfirmCancel: (val: boolean) => void;
  onAbort?: () => void;
  onOpenDestination?: () => void;
  onClose: () => void;
  isDownload: boolean;
  completedCount: number;
}

export const ProgressActionsSection: React.FC<ProgressActionsSectionProps> = ({
  progress,
  showConfirmCancel,
  setShowConfirmCancel,
  onAbort,
  onOpenDestination,
  onClose,
  isDownload,
  completedCount,
}) => {
  if (showConfirmCancel) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={28} color="#fb7185" style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Cancel active operation?
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', margin: 0 }}>
              This will stop the current process and discard progress.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={() => {
              setShowConfirmCancel(false);
              if (onAbort) onAbort();
            }}
            style={{
              flex: 1,
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '12.5px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(244, 63, 94, 0.35)',
            }}
          >
            <X size={14} /> Cancel Task
          </button>

          <button
            onClick={() => setShowConfirmCancel(false)}
            style={{
              flex: 1,
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '12.5px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Keep Running
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Action Buttons on completion */}
      {progress.completed && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isDownload && onOpenDestination && (
            <button
              onClick={onOpenDestination}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
              }}
            >
              <FolderOpen size={16} /> Open Destination Folder
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: isDownload ? 1 : undefined,
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Action Buttons on error / task interruption */}
      {progress.error && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isDownload && onOpenDestination && completedCount > 0 && (
            <button
              onClick={onOpenDestination}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
              }}
            >
              <FolderOpen size={16} /> Open Destination Folder
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: !isDownload && onOpenDestination && completedCount > 0 ? undefined : 1,
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}
    </>
  );
};
