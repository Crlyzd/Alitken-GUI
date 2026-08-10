import React from 'react';
import { Loader2 } from 'lucide-react';

interface VideoPlayerViewportProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  activeMediaSrc: string;
  isLoadingPreview: boolean;
  isNativeSupported: boolean;
  fallbackFrameSrc: string | null;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onError: () => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onVideoClick: () => void;
}

export const VideoPlayerViewport: React.FC<VideoPlayerViewportProps> = ({
  videoRef,
  activeMediaSrc,
  isLoadingPreview,
  isNativeSupported,
  fallbackFrameSrc,
  onLoadedMetadata,
  onTimeUpdate,
  onError,
  onPlay,
  onPause,
  onEnded,
  onVideoClick,
}) => {
  return (
    <div
      style={{
        flex: 1,
        minHeight: '200px',
        maxHeight: '440px',
        borderRadius: '12px',
        background: '#000000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {isLoadingPreview && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 20,
            gap: '10px',
            color: '#ffffff',
          }}
        >
          <Loader2 size={32} className="spinning-loader" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Preparing 60 FPS Live Preview...</span>
        </div>
      )}

      {isNativeSupported ? (
        <video
          ref={videoRef}
          src={activeMediaSrc}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onError={onError}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onClick={onVideoClick}
          playsInline
          preload="auto"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            cursor: 'pointer',
          }}
        />
      ) : fallbackFrameSrc ? (
        <img
          src={fallbackFrameSrc}
          alt="Extracted Preview Frame"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Loader2 size={24} className="spinning-loader" />
          <span>Extracting GPU Preview Frame...</span>
        </div>
      )}
    </div>
  );
};
