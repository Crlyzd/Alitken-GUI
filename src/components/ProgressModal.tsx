import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FolderOpen, X } from 'lucide-react';

export interface ProgressState {
  type?: 'conversion' | 'download';
  isProcessing: boolean;
  isSingleOutput?: boolean;
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
  const isAborted =
    progress.error === 'Processing aborted by user.' ||
    Boolean(progress.error && progress.error.toLowerCase().includes('aborted'));
  const isFileMissing = Boolean(
    progress.error &&
      (progress.error.toLowerCase().includes('not found') ||
        progress.error.toLowerCase().includes('deleted or moved'))
  );

  const getTitle = () => {
    if (progress.completed) {
      return isDownload ? 'Dependencies Installed!' : 'Processing Complete!';
    }
    if (progress.error) {
      if (isDownload) return 'Download Stopped';
      if (isAborted) {
        if (isSingleOutput) return 'Task Cancelled';
        return completedCount > 0
          ? `Task Stopped — ${completedCount} of ${progress.totalFiles} Files Converted`
          : 'Task Cancelled';
      }
      if (isFileMissing) return 'File Not Found';
      if (isSingleOutput) return 'Conversion Error';
      return completedCount > 0
        ? `Task Interrupted — ${completedCount} of ${progress.totalFiles} Files Converted`
        : 'Conversion Error';
    }
    return isDownload ? 'Downloading Dependencies...' : 'Processing Media...';
  };

  const getSubtitle = () => {
    if (progress.completed) {
      return isDownload
        ? 'Portable binary packages installed successfully.'
        : `Successfully converted all ${progress.totalFiles} file(s).`;
    }
    if (progress.error) {
      if (isAborted) {
        if (isSingleOutput) {
          return 'Operation was cancelled before output file was completed.';
        }
        return completedCount > 0
          ? `${completedCount} file(s) converted before operation was stopped.`
          : 'Operation was cancelled before processing started.';
      }
      if (isFileMissing) {
        return 'Input media file missing from disk.';
      }
      return 'Processing encountered an execution error.';
    }
    if (isDownload) {
      return progress.currentFile || 'Fetching portable binary packages...';
    }
    return progress.currentFile || 'Initializing FFmpeg pipeline...';
  };

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

        {showConfirmCancel ? (
          /* Option A Inline Abort Confirmation View */
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
        ) : (
          /* Normal / Completed / Interrupted Progress View */
          <>
            {/* Header Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingRight: progress.isProcessing ? '28px' : 0 }}>
              {progress.completed ? (
                <CheckCircle2 size={32} color="#34d399" style={{ flexShrink: 0 }} />
              ) : progress.error ? (
                <AlertCircle
                  size={32}
                  color={isAborted || completedCount > 0 ? '#f59e0b' : '#fb7185'}
                  style={{ flexShrink: 0 }}
                />
              ) : (
                <Loader2 size={32} color="var(--accent-primary)" className="animate-spin" style={{ flexShrink: 0 }} />
              )}

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {getTitle()}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                  {getSubtitle()}
                </p>
              </div>
            </div>

            {/* Real-time Percentage Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>
                  {isDownload
                    ? progress.totalFiles > 1
                      ? `Download Progress (${progress.fileIndex}/${progress.totalFiles})`
                      : 'Download Progress'
                    : isSingleOutput
                      ? `Image ${progress.fileIndex} of ${progress.totalFiles}`
                      : `File ${progress.fileIndex} of ${progress.totalFiles}${
                          progress.totalParts > 1 ? ` (Part ${progress.currentPart}/${progress.totalParts})` : ''
                        }`}
                </span>
                <span style={{ color: 'var(--accent-cyan)' }}>
                  {progress.completed ? '100.0' : progress.percent.toFixed(1)}%
                </span>
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
                    width: `${progress.completed ? 100 : progress.percent}%`,
                    background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                    borderRadius: '5px',
                    transition: 'width 0.2s ease',
                    boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
                  }}
                />
              </div>

              {!progress.error && (
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'flex-end', marginTop: '2px' }}>
                  {progress.status}
                </span>
              )}
            </div>

            {/* High-Visibility Error Alert Box */}
            {progress.error && !isAborted && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isFileMissing ? 'rgba(244, 63, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isFileMissing ? 'rgba(244, 63, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: isFileMissing ? '#fb7185' : '#f87171',
                  fontSize: '12px',
                  lineHeight: '1.45',
                  wordBreak: 'break-word',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>{progress.error}</div>
              </div>
            )}

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
                  onClick={handleClose}
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
                  onClick={handleClose}
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
        )}
      </div>
    </div>
  );
};
