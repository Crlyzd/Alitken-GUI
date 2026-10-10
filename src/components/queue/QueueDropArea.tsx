import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../../utils/mediaType';
import { getLastImportFolder, updateImportFolderFromFilePath } from '../../utils/folderHistory';

export interface QueueDropAreaProps {
  currentMediaKind: string;
  isDragOverProp: boolean;
  onAddFiles: (paths: string[]) => void;
}

export const QueueDropArea: React.FC<QueueDropAreaProps> = ({
  currentMediaKind,
  isDragOverProp,
  onAddFiles,
}) => {
  const [localIsDragOver, setLocalIsDragOver] = useState(false);
  const isDragOver = isDragOverProp || localIsDragOver;

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

  return (
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
  );
};
