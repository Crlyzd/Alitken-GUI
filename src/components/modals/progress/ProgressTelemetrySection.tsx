import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProgressState } from '../../../types/progress';

export interface ProgressTelemetrySectionProps {
  progress: ProgressState;
  isDownload: boolean;
  isAborted: boolean;
  completedCount: number;
  isSingleOutput: boolean;
  isFileMissing: boolean;
}

export const ProgressTelemetrySection: React.FC<ProgressTelemetrySectionProps> = ({
  progress,
  isDownload,
  isAborted,
  completedCount,
  isSingleOutput,
  isFileMissing,
}) => {
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
        if (isDownload) {
          return 'Download was cancelled by user.';
        }
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

  return (
    <>
      {/* Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingRight: progress.isProcessing ? '28px' : 0 }}>
        {progress.completed ? (
          <CheckCircle2 size={32} color="#34d399" style={{ flexShrink: 0 }} />
        ) : progress.error ? (
          <AlertCircle
            size={32}
            color={isAborted || completedCount > 0 ? '#f59e0b' : 'var(--accent-rose)'}
            style={{ flexShrink: 0 }}
          />
        ) : (
          <Loader2 size={32} color="var(--accent-primary)" className="animate-spin" style={{ flexShrink: 0 }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={getTitle()}
          >
            {getTitle()}
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={getSubtitle()}
          >
            {getSubtitle()}
          </p>
        </div>
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
            color: 'var(--accent-rose)',
            fontWeight: 500,
            fontSize: '12px',
            lineHeight: '1.45',
            wordBreak: 'break-word',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>{progress.error}</div>
        </div>
      )}
    </>
  );
};
