import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { UploadCloud, Film, Image as ImageIcon, Sparkles } from 'lucide-react';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../utils/mediaType';

interface WelcomeDropzoneProps {
  onAddFiles: (paths: string[]) => void;
}

export const WelcomeDropzone: React.FC<WelcomeDropzoneProps> = ({ onAddFiles }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const onAddFilesRef = useRef(onAddFiles);
  const lastDropTimeRef = useRef<number>(0);
  const lastDropPathsRef = useRef<string>('');

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
          if (typeof unlisten === 'function') unlisten();
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

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
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
        onClick={handlePickFiles}
        className="glass-panel"
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '40px 24px',
          border: `2px dashed ${
            isDragOver ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.16)'
          }`,
          background: isDragOver
            ? 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)'
            : 'radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.1) 100%)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isDragOver
            ? '0 0 40px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)'
            : '0 10px 30px rgba(0, 0, 0, 0.2)',
          userSelect: 'none',
        }}
      >
        {/* Animated Glow Icon Container */}
        <div
          style={{
            position: 'relative',
            width: '84px',
            height: '84px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: isDragOver
              ? '0 0 30px rgba(6, 182, 212, 0.5)'
              : '0 12px 28px rgba(0, 0, 0, 0.3)',
            transform: isDragOver ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          }}
        >
          <UploadCloud size={44} />
          <Sparkles
            size={18}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              color: 'var(--accent-primary)',
            }}
          />
        </div>

        {/* Text Content */}
        <div style={{ textAlign: 'center', maxWidth: '520px' }}>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '0.4px',
              marginBottom: '8px',
            }}
          >
            Drag & Drop media files here
          </h2>
          <p
            style={{
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Supports <strong style={{ color: 'var(--accent-cyan)' }}>Videos</strong> (MP4, MKV, WEBM, MOV, AVI, AV1) or{' '}
            <strong style={{ color: '#a855f7' }}>Images</strong> (PNG, JPG, WEBP, BMP, HEIC, TIFF, GIF)
          </p>
        </div>

        {/* Media Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
            }}
          >
            <Film size={14} /> Video Transcode & Split
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#c084fc',
            }}
          >
            <ImageIcon size={14} /> Image Convert, PDF & MP4
          </div>
        </div>
      </div>
    </div>
  );
};
