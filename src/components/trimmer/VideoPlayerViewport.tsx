import React from 'react';
import { Loader2, Scissors } from 'lucide-react';

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
  isDragOver?: boolean;
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
  isDragOver = false,
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
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(6, 182, 212, 0.25)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '2px dashed var(--accent-cyan)',
            borderRadius: '12px',
            zIndex: 30,
            gap: '12px',
            color: '#ffffff',
            boxShadow: '0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <Scissors size={40} style={{ color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.8))' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.3px' }}>Drop Single Video File</div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
              Replace current video target in Trimmer
            </div>
          </div>
        </div>
      )}
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
            borderRadius: '12px',
            overflow: 'hidden',
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
