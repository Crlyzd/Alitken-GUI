import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { UploadCloud, FileVideo, Trash2, Film, Clock, HardDrive } from 'lucide-react';

export interface FileItem {
  name: string;
  path: string;
  sizeMb: number;
  durationSec?: number;
  resolution?: string;
  codec?: string;
}

interface DropzoneProps {
  files: FileItem[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'ts'],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        onAddFiles(paths);
      }
    } catch (err) {
      console.error('File selection error:', err);
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return 'N/A';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Drop Target Header / Action Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files) {
            const paths = Array.from(e.dataTransfer.files).map((f) => (f as any).path || f.name);
            onAddFiles(paths);
          }
        }}
        className="glass-panel"
        style={{
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)'}`,
          background: isDragOver ? 'rgba(99, 102, 241, 0.1)' : 'rgba(18, 20, 29, 0.5)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handlePickFiles}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}
        >
          <UploadCloud size={24} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
            Drag & Drop video files here
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Supports MP4, MKV, WEBM, MOV, AVI, AV1 Level 7.3 game clips
          </p>
        </div>
      </div>

      {/* File Queue List Header */}
      {files.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
            QUEUE ({files.length} {files.length === 1 ? 'FILE' : 'FILES'})
          </span>
          <button
            onClick={onClearFiles}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-rose)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Trash2 size={13} /> Clear All
          </button>
        </div>
      )}

      {/* File Cards Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px',
        }}
      >
        {files.map((file, idx) => (
          <div
            key={idx}
            className="glass-card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                  flexShrink: 0,
                }}
              >
                <FileVideo size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={file.name}
                >
                  {file.name}
                </h4>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    marginTop: '2px',
                  }}
                >
                  {file.resolution && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Film size={11} /> {file.resolution}
                    </span>
                  )}
                  {file.durationSec && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {formatDuration(file.durationSec)}
                    </span>
                  )}
                  {file.sizeMb > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <HardDrive size={11} /> {file.sizeMb.toFixed(1)} MB
                    </span>
                  )}
                  {file.codec && (
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        color: 'var(--accent-cyan)',
                      }}
                    >
                      {file.codec}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onRemoveFile(idx)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-rose)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
