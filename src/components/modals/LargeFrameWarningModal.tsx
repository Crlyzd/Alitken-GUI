import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LargeFrameWarningModalProps {
  isOpen: boolean;
  estimatedFramesCount: number;
  fileCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LargeFrameWarningModal: React.FC<LargeFrameWarningModalProps> = ({
  isOpen,
  estimatedFramesCount,
  fileCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '420px',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          background: 'var(--bg-glass-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
              Large Frame Extraction
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              High disk usage warning
            </div>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
          This operation will extract approximately{' '}
          <strong style={{ color: '#fcd34d' }}>
            ~{estimatedFramesCount.toLocaleString()} frames
          </strong>{' '}
          across {fileCount} video(s). Please make sure you have sufficient storage space.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--input-bg)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)',
            }}
          >
            Extract Frames
          </button>
        </div>
      </div>
    </div>
  );
};
