import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { UploadCloud, FileVideo, FileImage, Trash2, Film, Clock, HardDrive, ArrowUpDown } from 'lucide-react';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, getFileKind } from '../utils/mediaType';
import { GlassSelect, GlassSelectOption } from './GlassSelect';

export type SortOption =
  | 'DEFAULT'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'SIZE_ASC'
  | 'SIZE_DESC'
  | 'DURATION_ASC'
  | 'DURATION_DESC';

export interface FileItem {
  name: string;
  path: string;
  sizeMb: number;
  durationSec?: number;
  resolution?: string;
  codec?: string;
  mediaKind?: 'video' | 'image';
}

interface DropzoneProps {
  files: FileItem[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onReorderFiles?: (sortedFiles: FileItem[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onReorderFiles,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('DEFAULT');
  const initialFilesRef = useRef<FileItem[]>([]);

  const onAddFilesRef = useRef(onAddFiles);
  const lastDropTimeRef = useRef<number>(0);
  const lastDropPathsRef = useRef<string>('');

  // Keep track of original import order when files change length or are first loaded
  useEffect(() => {
    if (files.length === 0) {
      initialFilesRef.current = [];
      setSortOption('DEFAULT');
    } else if (initialFilesRef.current.length !== files.length && sortOption === 'DEFAULT') {
      initialFilesRef.current = [...files];
    }
  }, [files, sortOption]);

  const handleSortChange = (newSort: SortOption) => {
    setSortOption(newSort);
    if (!onReorderFiles) return;

    if (newSort === 'DEFAULT') {
      if (initialFilesRef.current.length > 0) {
        // Filter out any files that were removed
        const currentPaths = new Set(files.map((f) => f.path.toLowerCase()));
        const restored = initialFilesRef.current.filter((f) => currentPaths.has(f.path.toLowerCase()));
        onReorderFiles(restored);
      }
      return;
    }

    const sorted = [...files];
    if (newSort === 'NAME_ASC') {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (newSort === 'NAME_DESC') {
      sorted.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (newSort === 'SIZE_ASC') {
      sorted.sort((a, b) => a.sizeMb - b.sizeMb);
    } else if (newSort === 'SIZE_DESC') {
      sorted.sort((a, b) => b.sizeMb - a.sizeMb);
    } else if (newSort === 'DURATION_ASC') {
      sorted.sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0));
    } else if (newSort === 'DURATION_DESC') {
      sorted.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0));
    }

    onReorderFiles(sorted);
  };

  useEffect(() => {
    onAddFilesRef.current = onAddFiles;
  }, [onAddFiles]);

  useEffect(() => {
    let isMounted = true;

    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onDragDropEvent((event: any) => {
      if (!isMounted) return;
      if (event.payload.type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = event.payload.paths || [];
        if (paths.length > 0) {
          const now = Date.now();
          const fingerprint = paths.map((p) => p.replace(/\\/g, '/').toLowerCase()).join('|');
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

    return () => {
      isMounted = false;
      unlistenPromise
        .then((unlisten) => {
          if (typeof unlisten === 'function') {
            unlisten();
          }
        })
        .catch((err) => console.error('Failed to cleanup drag-drop listener:', err));
    };
  }, []);

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Supported Media',
            extensions: [
              ...VIDEO_EXTENSIONS.map((e) => e.replace('.', '')),
              ...IMAGE_EXTENSIONS.map((e) => e.replace('.', '')),
            ],
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

  const currentMediaKind = files.length > 0 ? getFileKind(files[0].path) : 'unknown';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, gap: '14px' }}>
      {/* Compact Drop Zone Header */}
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
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          border: `2px dashed ${isDragOver ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.16)'}`,
          background: isDragOver ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
        }}
        onClick={handlePickFiles}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background:
              currentMediaKind === 'image'
                ? 'rgba(168, 85, 247, 0.2)'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentMediaKind === 'image' ? '#c084fc' : 'var(--accent-cyan)',
          }}
        >
          <UploadCloud size={20} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Drop or click to add more {currentMediaKind === 'image' ? 'images' : 'videos'}
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {currentMediaKind === 'image' ? 'PNG, JPG, WEBP, BMP, HEIC, TIFF' : 'MP4, MKV, WEBM, MOV, AVI, AV1'}
          </span>
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
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
            QUEUE ({files.length} {currentMediaKind.toUpperCase()} {files.length === 1 ? 'FILE' : 'FILES'})
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Frosted Glass Sorting Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '175px' }}>
              <ArrowUpDown size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              <GlassSelect
                value={sortOption}
                onChange={(val) => handleSortChange(val as SortOption)}
                options={[
                  { value: 'DEFAULT', label: 'Original Order' },
                  { value: 'NAME_ASC', label: 'Name (A → Z / 0 → 9)' },
                  { value: 'NAME_DESC', label: 'Name (Z → A / 9 → 0)' },
                  { value: 'SIZE_ASC', label: 'Size (Smallest)' },
                  { value: 'SIZE_DESC', label: 'Size (Largest)' },
                  ...(currentMediaKind === 'video'
                    ? [
                        { value: 'DURATION_ASC', label: 'Duration (Shortest)' },
                        { value: 'DURATION_DESC', label: 'Duration (Longest)' },
                      ]
                    : []),
                ] as GlassSelectOption[]}
              />
            </div>

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
        {files.map((file, idx) => {
          const isImg = getFileKind(file.path) === 'image';
          return (
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
                    background: isImg ? 'rgba(168, 85, 247, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                    border: `1px solid ${isImg ? 'rgba(168, 85, 247, 0.25)' : 'rgba(6, 182, 212, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isImg ? '#c084fc' : 'var(--accent-cyan)',
                    flexShrink: 0,
                  }}
                >
                  {isImg ? <FileImage size={20} /> : <FileVideo size={20} />}
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
                      margin: 0,
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
                    {!isImg && file.durationSec && (
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
                          color: isImg ? '#c084fc' : 'var(--accent-cyan)',
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
          );
        })}
      </div>
    </div>
  );
};
