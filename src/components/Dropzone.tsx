import React, { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  UploadCloud,
  FileVideo,
  FileImage,
  Trash2,
  Film,
  Clock,
  HardDrive,
  ArrowUpDown,
  AlertCircle,
  Scissors,
  GripVertical,
  FolderOpen,
  ExternalLink,
  Crop,
} from 'lucide-react';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, getFileKind } from '../utils/mediaType';
import { showFileInFolder, openFileWithDefaultApp } from '../utils/folderUtils';
import { getLastImportFolder, updateImportFolderFromFilePath } from '../utils/folderHistory';
import { GlassSelect, GlassSelectOption } from './GlassSelect';
import { AspectRatioOption } from '../types/media';

export type SortOption =
  | 'DEFAULT'
  | 'CUSTOM'
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
  isMissing?: boolean;
  trimStartSec?: number;
  trimEndSec?: number;
  trimFastCopy?: boolean;
  filmstrip?: string[];
  aspectRatio?: AspectRatioOption;
  cropOffset?: { x: number; y: number };
  cropScale?: number;
  isCropApplied?: boolean;
  crop_x?: number;
  crop_y?: number;
  crop_w?: number;
  crop_h?: number;
  crop_filter?: string;
}

interface DropzoneProps {
  files: FileItem[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onReorderFiles?: (sortedFiles: FileItem[]) => void;
  onOpenTrimmer?: (file: FileItem) => void;
  isDragOver?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onReorderFiles,
  onOpenTrimmer,
  isDragOver: isDragOverProp = false,
}) => {
  const [localIsDragOver, setLocalIsDragOver] = useState(false);
  const isDragOver = isDragOverProp || localIsDragOver;
  const [sortOption, setSortOption] = useState<SortOption>('DEFAULT');
  const initialFilesRef = useRef<FileItem[]>([]);

  // Snappy GPU-accelerated drag state & focus loss handling
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [startY, setStartY] = useState<number>(0);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const [itemHeight, setItemHeight] = useState<number>(68);
  const [isJustDropped, setIsJustDropped] = useState<boolean>(false);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerElemRef = useRef<HTMLElement | null>(null);

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

    if (newSort === 'CUSTOM') {
      return;
    }

    if (newSort === 'DEFAULT') {
      if (initialFilesRef.current.length > 0) {
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

  const cancelOrReleaseDrag = () => {
    if (activePointerIdRef.current !== null && activePointerElemRef.current) {
      try {
        activePointerElemRef.current.releasePointerCapture(activePointerIdRef.current);
      } catch (err) {
        // Ignore pointer release error if already released
      }
      activePointerIdRef.current = null;
      activePointerElemRef.current = null;
    }
    setDraggedIndex(null);
    setStartY(0);
    setDragOffsetY(0);
  };

  // Pointer event mouse tracking & instant GPU transform engine
  useEffect(() => {
    if (draggedIndex === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Auto-release drag if mouse button is no longer held down
      if (e.buttons === 0) {
        handlePointerUp();
        return;
      }
      const deltaY = e.clientY - startY;
      setDragOffsetY(deltaY);
    };

    const handlePointerUp = () => {
      if (draggedIndex !== null && itemHeight > 0) {
        const slotsMoved = Math.round(dragOffsetY / itemHeight);
        const targetIndex = Math.min(Math.max(0, draggedIndex + slotsMoved), files.length - 1);

        if (targetIndex !== draggedIndex) {
          const reordered = [...files];
          const [removed] = reordered.splice(draggedIndex, 1);
          reordered.splice(targetIndex, 0, removed);

          setSortOption('CUSTOM');
          if (onReorderFiles) {
            onReorderFiles(reordered);
          }
        }
      }

      setIsJustDropped(true);
      cancelOrReleaseDrag();

      setTimeout(() => {
        setIsJustDropped(false);
      }, 120);
    };

    const handleBlurOrLeave = () => {
      setIsJustDropped(true);
      cancelOrReleaseDrag();
      setTimeout(() => {
        setIsJustDropped(false);
      }, 120);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleBlurOrLeave);
    window.addEventListener('mouseleave', handleBlurOrLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleBlurOrLeave);
      window.removeEventListener('mouseleave', handleBlurOrLeave);
    };
  }, [draggedIndex, startY, dragOffsetY, itemHeight, files, onReorderFiles]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (files[index]?.isMissing) return;

    if (cardsContainerRef.current && cardsContainerRef.current.children.length > 0) {
      const firstCard = cardsContainerRef.current.children[0] as HTMLElement;
      const cardRect = firstCard.getBoundingClientRect();
      setItemHeight(cardRect.height + 10);
    }

    activePointerIdRef.current = e.pointerId;
    activePointerElemRef.current = e.currentTarget;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if pointer capture fails
    }

    setDraggedIndex(index);
    setStartY(e.clientY);
    setDragOffsetY(0);
    setIsJustDropped(false);
  };

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        defaultPath: getLastImportFolder() || undefined,
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
        if (paths.length > 0) {
          updateImportFolderFromFilePath(paths[0]);
        }
        onAddFiles(paths);
      }
    } catch (err) {
      console.error('File selection error:', err);
    }
  };

  const formatDuration = (sec?: number) => {
    if (sec === undefined || sec === null || isNaN(sec) || sec < 0) return 'N/A';
    if (sec === 0) return '0m 0s';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  const currentMediaKind = files.length > 0 ? getFileKind(files[0].path) : 'unknown';

  // Calculate active target index while dragging
  let activeTargetIndex = draggedIndex;
  if (draggedIndex !== null && itemHeight > 0) {
    const slotsMoved = Math.round(dragOffsetY / itemHeight);
    activeTargetIndex = Math.min(Math.max(0, draggedIndex + slotsMoved), files.length - 1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, gap: '14px' }}>
      {/* Compact Drop Zone Header */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setLocalIsDragOver(true);
        }}
        onDragLeave={() => setLocalIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setLocalIsDragOver(false);
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
                  ...(sortOption === 'CUSTOM' ? [{ value: 'CUSTOM', label: 'Custom Order' }] : []),
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

            {files.some((f) => f.isMissing) && (
              <button
                onClick={() => {
                  const filtered = files.filter((f) => !f.isMissing);
                  if (onReorderFiles) {
                    onReorderFiles(filtered);
                  }
                  if (filtered.length === 0) {
                    onClearFiles();
                  }
                }}
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  color: '#fb7185',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={12} /> Clear Missing
              </button>
            )}

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
        ref={cardsContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '6px 6px 8px 2px',
          userSelect: draggedIndex !== null ? 'none' : 'auto',
          position: 'relative',
        }}
      >
        {files.map((file, idx) => {
          const isImg = getFileKind(file.path) === 'image';
          const hasTrim = file.trimStartSec !== undefined && file.trimEndSec !== undefined;
          const isBeingDragged = draggedIndex === idx;

          let translateY = 0;
          if (draggedIndex !== null && activeTargetIndex !== null) {
            if (isBeingDragged) {
              translateY = dragOffsetY;
            } else {
              if (draggedIndex < activeTargetIndex) {
                // Dragging DOWN: cards between draggedIndex + 1 and activeTargetIndex shift UP
                if (idx > draggedIndex && idx <= activeTargetIndex) {
                  translateY = -itemHeight;
                }
              } else if (draggedIndex > activeTargetIndex) {
                // Dragging UP: cards between activeTargetIndex and draggedIndex - 1 shift DOWN
                if (idx < draggedIndex && idx >= activeTargetIndex) {
                  translateY = itemHeight;
                }
              }
            }
          }

          return (
            <div
              key={file.path || idx}
              className="glass-card"
              onPointerDown={(e) => handleCardPointerDown(e, idx)}
              style={{
                padding: '10px 10px 10px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                border: isBeingDragged
                  ? '1.5px solid var(--accent-cyan)'
                  : file.isMissing
                  ? '1px solid rgba(244, 63, 94, 0.45)'
                  : undefined,
                boxShadow: isBeingDragged
                  ? '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(6, 182, 212, 0.35)'
                  : undefined,
                background: isBeingDragged
                  ? 'rgba(6, 182, 212, 0.14)'
                  : file.isMissing
                  ? 'rgba(244, 63, 94, 0.06)'
                  : undefined,
                transform: `translateY(${translateY}px)`,
                zIndex: isBeingDragged ? 50 : 1,
                opacity: 1,
                cursor: file.isMissing ? 'default' : isBeingDragged ? 'grabbing' : 'grab',
                transition: isBeingDragged || isJustDropped
                  ? 'none'
                  : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), border 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                touchAction: 'none',
                position: 'relative',
              }}
            >
              {/* Compact Left Grip & Trim Action Group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Drag Handle Grip Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isBeingDragged ? 'var(--accent-cyan)' : 'var(--text-dim)',
                    opacity: isBeingDragged ? 1 : 0.4,
                    flexShrink: 0,
                    cursor: 'grab',
                    padding: '2px 0 2px 2px',
                  }}
                  title="Drag to reorder queue"
                >
                  <GripVertical size={14} />
                </div>

                {/* Video Trim Button */}
                {!isImg && onOpenTrimmer && !file.isMissing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTrimmer(file);
                    }}
                    title={hasTrim ? 'Edit Video Trim Selection' : 'Open Video in Trimmer'}
                    className={`queue-trim-btn ${hasTrim ? 'has-trim' : ''}`}
                  >
                    <Scissors size={15} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: file.isMissing
                      ? 'rgba(244, 63, 94, 0.2)'
                      : isImg
                      ? 'rgba(168, 85, 247, 0.15)'
                      : 'rgba(6, 182, 212, 0.15)',
                    border: `1px solid ${
                      file.isMissing
                        ? 'rgba(244, 63, 94, 0.4)'
                        : isImg
                        ? 'rgba(168, 85, 247, 0.25)'
                        : 'rgba(6, 182, 212, 0.25)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: file.isMissing ? '#fb7185' : isImg ? '#c084fc' : 'var(--accent-cyan)',
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
                      color: file.isMissing ? '#fb7185' : 'var(--text-main)',
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
                      flexWrap: 'wrap',
                      gap: '8px',
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
                    {hasTrim && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.35)',
                          color: 'var(--accent-cyan)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '10.5px',
                        }}
                      >
                        <Scissors size={10} /> Trimmed: {formatDuration((file.trimEndSec ?? 0) - (file.trimStartSec ?? 0))}
                      </span>
                    )}
                    {(file.isCropApplied || (file.crop_w !== undefined && file.crop_h !== undefined) || (file.aspectRatio && file.aspectRatio !== 'ORIGINAL')) && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                          color: '#c084fc',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '10.5px',
                        }}
                      >
                        <Crop size={10} /> Crop: {file.aspectRatio && file.aspectRatio !== 'ORIGINAL' ? file.aspectRatio : 'Applied'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side Action Cluster */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                {file.isMissing && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3.5px',
                      background: 'rgba(244, 63, 94, 0.18)',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      color: '#fb7185',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      marginRight: '4px',
                    }}
                  >
                    <AlertCircle size={10} /> File Missing
                  </span>
                )}

                {/* Open File Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileWithDefaultApp(file.path);
                  }}
                  disabled={file.isMissing}
                  title="Open File (Default Viewer)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    opacity: file.isMissing ? 0.3 : 0.7,
                    cursor: file.isMissing ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!file.isMissing) {
                      e.currentTarget.style.color = 'var(--accent-cyan)';
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!file.isMissing) {
                      e.currentTarget.style.color = 'var(--text-dim)';
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <ExternalLink size={15} />
                </button>

                {/* Open Containing Folder Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showFileInFolder(file.path);
                  }}
                  disabled={file.isMissing}
                  title="Open Containing Folder"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    opacity: file.isMissing ? 0.3 : 0.7,
                    cursor: file.isMissing ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!file.isMissing) {
                      e.currentTarget.style.color = 'var(--accent-cyan)';
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!file.isMissing) {
                      e.currentTarget.style.color = 'var(--text-dim)';
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <FolderOpen size={15} />
                </button>

                {/* Remove File Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(idx);
                  }}
                  title="Remove from Queue"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    opacity: 0.7,
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent-rose)';
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-dim)';
                    e.currentTarget.style.opacity = '0.7';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
