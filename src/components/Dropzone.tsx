import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
  const onAddFilesRef = useRef(onAddFiles);
  const lastDropTimeRef = useRef<number>(0);
  const lastDropPathsRef = useRef<string>('');

  useEffect(() => {
    onAddFilesRef.current = onAddFiles;
  }, [onAddFiles]);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let isMounted = true;

    async function setupDragDrop() {
      try {
        const appWindow = getCurrentWindow();
        const unlisten = await appWindow.onDragDropEvent((event: any) => {
          if (!isMounted) return;
          if (event.payload.type === 'drop') {
            setIsDragOver(false);
            const paths = event.payload.paths || [];
            if (paths.length > 0) {
              const now = Date.now();
              const fingerprint = paths.join('|');
              if (now - lastDropTimeRef.current < 300 && lastDropPathsRef.current === fingerprint) {
                return;
              }
              lastDropTimeRef.current = now;
              lastDropPathsRef.current = fingerprint;
              onAddFilesRef.current(paths);
            }
          } else if (event.payload.type === 'enter') {
            setIsDragOver(true);
          } else if (event.payload.type === 'leave' || event.payload.type === 'cancel') {
            setIsDragOver(false);
          }
        });

        if (isMounted) {
          unlistenFn = unlisten;
        } else {
          unlisten();
        }
      } catch (err) {
        console.error('Failed to register drag-drop event listener:', err);
      }
    }

    setupDragDrop();

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
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
        }}
        className="glass-panel"
        style={{
          borderRadius: '16px',
          padding: files.length > 0 ? '20px' : '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.16)'}`,
          background: isDragOver ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isDragOver ? '0 0 30px rgba(99, 102, 241, 0.25)' : undefined,
        }}
        onClick={handlePickFiles}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
          }}
        >
          <UploadCloud size={26} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.3px' }}>
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
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
            QUEUE ({files.length} {files.length === 1 ? 'FILE' : 'FILES'})
          </span>
          <button
            onClick={onClearFiles}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-rose)',
              fontSize: '12px',
              fontWeight: 600,
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
          gap: '10px',
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
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                  flexShrink: 0,
                }}
              >
                <FileVideo size={20} />
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
                    marginTop: '3px',
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
                transition: 'all 0.15s ease',
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
