import React, { useState } from 'react';
import { Loader2, Terminal, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export interface ProgressState {
  isProcessing: boolean;
  currentFile: string;
  fileIndex: number;
  totalFiles: number;
  percent: number;
  currentPart: number;
  totalParts: number;
  status: string;
  logs: string[];
  error?: string;
  completed: boolean;
}

interface ProgressModalProps {
  progress: ProgressState;
  onClose: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ progress, onClose }) => {
  const [showLogs, setShowLogs] = useState(false);

  if (!progress.isProcessing && !progress.completed && !progress.error) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
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
          maxWidth: '560px',
          borderRadius: '16px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {progress.completed ? (
            <CheckCircle2 size={28} color="#34d399" />
          ) : progress.error ? (
            <AlertCircle size={28} color="#fb7185" />
          ) : (
            <Loader2 size={28} color="var(--accent-primary)" className="animate-spin" />
          )}

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {progress.completed
                ? 'Processing Complete!'
                : progress.error
                ? 'Processing Failed'
                : 'Processing Media...'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {progress.currentFile || 'Initializing FFmpeg pipeline...'}
            </p>
          </div>
        </div>

        {/* Real-time Percentage Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
            <span>
              File {progress.fileIndex} of {progress.totalFiles}
              {progress.totalParts > 1 ? ` (Part ${progress.currentPart}/${progress.totalParts})` : ''}
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

          <span style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'flex-end' }}>
            {progress.status}
          </span>
        </div>

        {/* Collapsible Log Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} /> Terminal Logs ({progress.logs.length})
            </span>
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showLogs && (
            <div
              style={{
                height: '120px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '8px',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#34d399',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {progress.logs.slice(-20).map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button on completion */}
        {(progress.completed || progress.error) && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};
