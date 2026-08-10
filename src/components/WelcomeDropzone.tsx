import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { UploadCloud, Film, Image as ImageIcon, Sparkles, Scissors } from 'lucide-react';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, getFileKind } from '../utils/mediaType';

interface WelcomeDropzoneProps {
  onAddFiles: (paths: string[]) => void;
  onOpenTrimmerFile?: (filePath: string) => void;
  isDragOver?: boolean;
  dragTargetZone?: 'batch' | 'trimmer' | null;
  onZoneChange?: (zone: 'batch' | 'trimmer' | null) => void;
}

export const WelcomeDropzone: React.FC<WelcomeDropzoneProps> = ({
  onAddFiles,
  onOpenTrimmerFile,
  dragTargetZone = null,
  onZoneChange,
}) => {
  const [localTopDragOver, setLocalTopDragOver] = useState(false);
  const [localTrimmerDragOver, setLocalTrimmerDragOver] = useState(false);

  const isTopDragOver = dragTargetZone === 'batch' || localTopDragOver;
  const isTrimmerDragOver = dragTargetZone === 'trimmer' || localTrimmerDragOver;

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'All Media Files (Video & Image)',
            extensions: [
              ...VIDEO_EXTENSIONS.map((e) => e.replace('.', '')),
              ...IMAGE_EXTENSIONS.map((e) => e.replace('.', '')),
            ],
          },
          {
            name: 'Video Files',
            extensions: VIDEO_EXTENSIONS.map((e) => e.replace('.', '')),
          },
          {
            name: 'Image Files',
            extensions: IMAGE_EXTENSIONS.map((e) => e.replace('.', '')),
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

  const handlePickTrimmerFile = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video Files',
            extensions: VIDEO_EXTENSIONS.map((e) => e.replace('.', '')),
          },
        ],
      });

      if (selected && typeof selected === 'string' && onOpenTrimmerFile) {
        onOpenTrimmerFile(selected);
      }
    } catch (err) {
      console.error('Trimmer file selection error:', err);
    }
  };

  const handleTrimmerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalTrimmerDragOver(false);
    onZoneChange?.(null);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const filePath = (droppedFile as any).path;
      if (filePath && onOpenTrimmerFile && getFileKind(filePath) === 'video') {
        onOpenTrimmerFile(filePath);
      }
    }
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Card: Main Conversion Batch Queue Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setLocalTopDragOver(true);
          setLocalTrimmerDragOver(false);
          onZoneChange?.('batch');
        }}
        onDragLeave={() => {
          setLocalTopDragOver(false);
          onZoneChange?.(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setLocalTopDragOver(false);
          onZoneChange?.(null);
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const paths = Array.from(e.dataTransfer.files)
              .map((f: any) => f.path)
              .filter(Boolean);
            if (paths.length > 0) onAddFiles(paths);
          }
        }}
        onClick={handlePickFiles}
        className="glass-panel"
        style={{
          flex: 1,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '16px',
          border: `2px dashed ${
            isTopDragOver ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.16)'
          }`,
          background: isTopDragOver
            ? 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)'
            : 'radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.1) 100%)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isTopDragOver
            ? '0 0 30px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)'
            : '0 8px 24px rgba(0, 0, 0, 0.2)',
          userSelect: 'none',
        }}
      >
        {/* Animated Glow Icon Container (Preserved UploadCloud + Sparkles) */}
        <div
          style={{
            position: 'relative',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: isTopDragOver
              ? '0 0 30px rgba(6, 182, 212, 0.5)'
              : '0 10px 24px rgba(0, 0, 0, 0.3)',
            transform: isTopDragOver ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          }}
        >
          <UploadCloud size={32} />
          <Sparkles
            size={13}
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              color: 'var(--accent-primary)',
            }}
          />
        </div>

        {/* Text Content */}
        <div style={{ textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '0.3px',
              marginBottom: '4px',
            }}
          >
            Drop Media Files or Click to Browse
          </h2>
          <p
            style={{
              fontSize: '11px',
              lineHeight: '1.45',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Supports <strong style={{ color: 'var(--accent-cyan)' }}>Cinema & Broadcast Video</strong> (ProRes, MP4, MKV, MOV, MXF)
            <br />
            and <strong style={{ color: '#a855f7' }}>Camera RAW & Photos</strong> (CR2/CR3, NEF, ARW, DNG, HEIC, PNG, JPG, WEBP)
          </p>
        </div>

        {/* Media Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '2px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              whiteSpace: 'nowrap',
            }}
          >
            <Film size={12} /> Transcode & Split
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              fontSize: '11px',
              fontWeight: 600,
              color: '#c084fc',
              whiteSpace: 'nowrap',
            }}
          >
            <ImageIcon size={12} /> Image & PDF
          </div>
        </div>
      </div>

      {/* Bottom Card: Dedicated Video Trimmer Target Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setLocalTrimmerDragOver(true);
          setLocalTopDragOver(false);
          onZoneChange?.('trimmer');
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setLocalTrimmerDragOver(false);
          onZoneChange?.(null);
        }}
        onDrop={handleTrimmerDrop}
        onClick={() => handlePickTrimmerFile()}
        className="glass-panel"
        style={{
          height: '92px',
          flexShrink: 0,
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          border: `2px dashed ${
            isTrimmerDragOver ? 'var(--accent-cyan)' : 'rgba(6, 182, 212, 0.3)'
          }`,
          background: isTrimmerDragOver
            ? 'rgba(6, 182, 212, 0.2)'
            : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          boxShadow: isTrimmerDragOver
            ? '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.15)'
            : '0 4px 16px rgba(0, 0, 0, 0.15)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Glowing Scissors Icon Box */}
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.18)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              boxShadow: isTrimmerDragOver
                ? '0 0 20px rgba(6, 182, 212, 0.6)'
                : '0 4px 12px rgba(6, 182, 212, 0.2)',
              transform: isTrimmerDragOver ? 'scale(1.08)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            <Scissors size={22} />
          </div>

          <div style={{ textAlign: 'left' }}>
            <h3
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                letterSpacing: '0.2px',
              }}
            >
              Drop Video Here to Trim & Edit
            </h3>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                margin: '2px 0 0 0',
              }}
            >
              Or click to open single video directly in Video Trimmer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePickTrimmerFile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            fontSize: '11.5px',
            fontWeight: 600,
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(6, 182, 212, 0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.28)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(6, 182, 212, 0.15)';
          }}
        >
          <Scissors size={13} /> Open Video Trimmer
        </button>
      </div>
    </div>
  );
};
