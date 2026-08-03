import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react';

export interface ProgressState {
  type?: 'conversion' | 'download';
  isProcessing: boolean;
  currentFile: string;
  fileIndex: number;
  totalFiles: number;
  percent: number;
  currentPart: number;
  totalParts: number;
  status: string;
  error?: string;
  completed: boolean;
}

interface ProgressModalProps {
  progress: ProgressState;
  onClose: () => void;
  onOpenDestination?: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  progress,
  onClose,
  onOpenDestination,
}) => {
  if (!progress.isProcessing && !progress.completed && !progress.error) {
    return null;
  }

  const isDownload = progress.type === 'download';

  const getTitle = () => {
    if (progress.completed) {
      return isDownload ? 'Dependencies Installed!' : 'Processing Complete!';
    }
    if (progress.error) {
      return isDownload ? 'Download Failed' : 'Processing Failed';
    }
    return isDownload ? 'Downloading Dependencies...' : 'Processing Media...';
  };

  const getSubtitle = () => {
    if (isDownload) {
      return progress.currentFile || 'Fetching portable binary packages...';
    }
    return progress.currentFile || 'Initializing FFmpeg pipeline...';
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
          width: '100%',
          maxWidth: '480px',
          borderRadius: '16px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {progress.completed ? (
            <CheckCircle2 size={32} color="#34d399" />
          ) : progress.error ? (
            <AlertCircle size={32} color="#fb7185" />
          ) : (
            <Loader2 size={32} color="var(--accent-primary)" className="animate-spin" />
          )}

          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>
              {getTitle()}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Real-time Percentage Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
            <span>
              {isDownload
                ? 'Download Progress'
                : `File ${progress.fileIndex} of ${progress.totalFiles}${
                    progress.totalParts > 1 ? ` (Part ${progress.currentPart}/${progress.totalParts})` : ''
                  }`}
            </span>
            <span style={{ color: 'var(--accent-cyan)' }}>{progress.percent.toFixed(1)}%</span>
          </div>

          <div
            style={{
              height: '10px',
              borderRadius: '5px',
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress.percent}%`,
                background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                borderRadius: '5px',
                transition: 'width 0.2s ease',
                boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
              }}
            />
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'flex-end', marginTop: '2px' }}>
            {progress.status}
          </span>
        </div>

        {/* Action Buttons on completion / error */}
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

        {progress.error && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: '#f43f5e',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(244, 63, 94, 0.3)',
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

