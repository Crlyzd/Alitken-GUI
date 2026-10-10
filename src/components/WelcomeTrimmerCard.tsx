import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Scissors, ChevronRight } from 'lucide-react';
import { VIDEO_EXTENSIONS, getFileKind } from '../utils/mediaType';
import { getLastImportFolder, updateImportFolderFromFilePath } from '../utils/folderHistory';

interface WelcomeTrimmerCardProps {
  onOpenTrimmerFile?: (filePath: string) => void;
  isTrimmerDragOver: boolean;
  onZoneChange?: (zone: 'batch' | 'trimmer' | null) => void;
}

export const WelcomeTrimmerCard: React.FC<WelcomeTrimmerCardProps> = ({
  onOpenTrimmerFile,
  isTrimmerDragOver,
  onZoneChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handlePickTrimmerFile = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const selected = await open({
        multiple: false,
        defaultPath: getLastImportFolder() || undefined,
        filters: [
          {
            name: 'Video Files',
            extensions: VIDEO_EXTENSIONS.map((ext) => ext.replace('.', '')),
          },
        ],
      });

      if (selected && typeof selected === 'string' && onOpenTrimmerFile) {
        updateImportFolderFromFilePath(selected);
        onOpenTrimmerFile(selected);
      }
    } catch (err) {
      console.error('Trimmer file selection error:', err);
    }
  };

  const handleTrimmerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onZoneChange?.(null);
    if (e.dataTransfer?.files?.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const filePath = (droppedFile as any).path;
      if (filePath && onOpenTrimmerFile && getFileKind(filePath) === 'video') {
        onOpenTrimmerFile(filePath);
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onZoneChange?.('trimmer');
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onZoneChange?.(null);
      }}
      onDrop={handleTrimmerDrop}
      onClick={() => handlePickTrimmerFile()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="glass-panel"
      style={{
        height: '74px',
        flexShrink: 0,
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        border: `2px dashed ${
          isTrimmerDragOver
            ? 'var(--accent-cyan)'
            : isHovered
            ? 'rgba(6, 182, 212, 0.45)'
            : 'rgba(6, 182, 212, 0.28)'
        }`,
        background: isTrimmerDragOver
          ? 'rgba(6, 182, 212, 0.2)'
          : isHovered
          ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(6, 182, 212, 0.06) 0%, rgba(99, 102, 241, 0.04) 100%)',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isTrimmerDragOver
          ? '0 0 25px rgba(6, 182, 212, 0.45), inset 0 0 15px rgba(6, 182, 212, 0.15)'
          : isHovered
          ? '0 6px 20px rgba(6, 182, 212, 0.2)'
          : '0 4px 16px rgba(0, 0, 0, 0.15)',
        userSelect: 'none',
      }}
      title="Click or drop a video to trim & cut"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
        {/* Glowing Scissors Icon Box */}
        <div
          style={{
            width: '40px',
            height: '40px',
            minWidth: '40px',
            borderRadius: '11px',
            background: 'rgba(6, 182, 212, 0.18)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: isTrimmerDragOver || isHovered
              ? '0 0 18px rgba(6, 182, 212, 0.5)'
              : '0 4px 12px rgba(6, 182, 212, 0.2)',
            transform: isTrimmerDragOver || isHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'all 0.2s ease',
          }}
        >
          <Scissors size={20} />
        </div>

        {/* Text Content */}
        <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '0.2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Trim & Cut Single Video
          </h3>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              margin: '2px 0 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Drop video file here or click anywhere to browse
          </p>
        </div>
      </div>

      {/* Trailing Interactive Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: isHovered || isTrimmerDragOver ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
          color: 'var(--accent-cyan)',
          marginLeft: '12px',
          flexShrink: 0,
          transform: isHovered || isTrimmerDragOver ? 'translateX(3px)' : 'translateX(0)',
          transition: 'all 0.2s ease',
          opacity: isHovered || isTrimmerDragOver ? 1 : 0.65,
        }}
      >
        <ChevronRight size={18} />
      </div>
    </div>
  );
};
