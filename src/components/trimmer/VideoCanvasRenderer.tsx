import React from 'react';
import { Loader2 } from 'lucide-react';
import { AspectRatioOption } from '../../types/media';

interface VideoCanvasRendererProps {
  videoWrapperRef: React.RefObject<HTMLDivElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  aspectRatio: AspectRatioOption;
  videoAspect: number;
  isVideoWider: boolean;
  cropScale: number;
  translateX: number;
  translateY: number;
  isDraggingMove: boolean;
  isDraggingResize: string | null;
  isNativeSupported: boolean;
  activeMediaSrc: string;
  fallbackFrameSrc: string | null;
  handleMoveStart: (e: React.MouseEvent) => void;
  handleResizeStart: (corner: string, e: React.MouseEvent) => void;
  onCropOffsetChange: (offset: { x: number; y: number }) => void;
  onCropScaleChange?: (scale: number) => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onError: () => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export const VideoCanvasRenderer: React.FC<VideoCanvasRendererProps> = ({
  videoWrapperRef,
  videoRef,
  aspectRatio,
  videoAspect,
  isVideoWider,
  cropScale,
  translateX,
  translateY,
  isDraggingMove,
  isDraggingResize,
  isNativeSupported,
  activeMediaSrc,
  fallbackFrameSrc,
  handleMoveStart,
  handleResizeStart,
  onCropOffsetChange,
  onCropScaleChange,
  onLoadedMetadata,
  onTimeUpdate,
  onError,
  onPlay,
  onPause,
  onEnded,
}) => {
  // Counter-scaling for overlay elements (crop border & corner handles) so they maintain constant pixel size across all zoom scales
  const invScale = 1 / Math.max(0.01, cropScale || 1.0);
  const strokeWidth = Math.max(0.75, 1.5 * invScale);
  const strokeShadow = Math.max(3, 15 * invScale);
  const handleBorder = Math.max(0.5, 1 * invScale);
  const handleShadow = Math.max(2, 6 * invScale);

  return (
    <div
      ref={videoWrapperRef}
      onMouseDown={aspectRatio !== 'ORIGINAL' ? handleMoveStart : undefined}
      onDoubleClick={() => {
        onCropOffsetChange({ x: 0.5, y: 0.5 });
        onCropScaleChange?.(1.0);
      }}
      style={{
        position: 'absolute',
        inset: 0,
        margin: 'auto',
        aspectRatio: `${videoAspect}`,
        width: isVideoWider ? '100%' : 'auto',
        height: isVideoWider ? 'auto' : '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform:
          aspectRatio !== 'ORIGINAL'
            ? `translate(${translateX}%, ${translateY}%) scale(${cropScale})`
            : 'none',
        transition:
          isDraggingMove || isDraggingResize
            ? 'none'
            : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: aspectRatio !== 'ORIGINAL' ? (isDraggingMove ? 'grabbing' : 'grab') : 'pointer',
        boxSizing: 'border-box',
      }}
    >
      {/* White Border Frame around Video Layer */}
      {aspectRatio !== 'ORIGINAL' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `${strokeWidth}px solid rgba(255, 255, 255, 0.85)`,
            boxShadow: `0 0 ${strokeShadow}px rgba(0, 0, 0, 0.5)`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}

      {/* Actual HTML5 Video Element */}
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
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            cursor: 'default',
          }}
        />
      ) : fallbackFrameSrc ? (
        <img
          src={fallbackFrameSrc}
          alt="Extracted Preview Frame"
          style={{
            width: '100%',
            height: '100%',
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
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 16px',
            boxSizing: 'border-box',
            gap: '8px',
          }}
        >
          <Loader2 size={24} className="spinning-loader" />
          <span style={{ textAlign: 'center', lineHeight: 1.4 }}>
            Extracting GPU Preview Frame...
          </span>
        </div>
      )}

      {/* 4 White Corner Handles for Resizing Video Layer */}
      {aspectRatio !== 'ORIGINAL' && (
        <>
          {/* Top-Left Handle */}
          <div
            onMouseDown={(e) => handleResizeStart('top-left', e)}
            style={{
              position: 'absolute',
              top: '0px',
              left: '0px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffffff',
              border: `${handleBorder}px solid #000000`,
              boxShadow: `0 0 ${handleShadow}px rgba(255, 255, 255, 0.9)`,
              cursor: 'nwse-resize',
              zIndex: 20,
              transform: `translate(-50%, -50%) scale(${invScale})`,
              transformOrigin: 'center center',
            }}
          />
          {/* Top-Right Handle */}
          <div
            onMouseDown={(e) => handleResizeStart('top-right', e)}
            style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffffff',
              border: `${handleBorder}px solid #000000`,
              boxShadow: `0 0 ${handleShadow}px rgba(255, 255, 255, 0.9)`,
              cursor: 'nesw-resize',
              zIndex: 20,
              transform: `translate(50%, -50%) scale(${invScale})`,
              transformOrigin: 'center center',
            }}
          />
          {/* Bottom-Left Handle */}
          <div
            onMouseDown={(e) => handleResizeStart('bottom-left', e)}
            style={{
              position: 'absolute',
              bottom: '0px',
              left: '0px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffffff',
              border: `${handleBorder}px solid #000000`,
              boxShadow: `0 0 ${handleShadow}px rgba(255, 255, 255, 0.9)`,
              cursor: 'nesw-resize',
              zIndex: 20,
              transform: `translate(-50%, 50%) scale(${invScale})`,
              transformOrigin: 'center center',
            }}
          />
          {/* Bottom-Right Handle */}
          <div
            onMouseDown={(e) => handleResizeStart('bottom-right', e)}
            style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffffff',
              border: `${handleBorder}px solid #000000`,
              boxShadow: `0 0 ${handleShadow}px rgba(255, 255, 255, 0.9)`,
              cursor: 'nwse-resize',
              zIndex: 20,
              transform: `translate(50%, 50%) scale(${invScale})`,
              transformOrigin: 'center center',
            }}
          />
        </>
      )}
    </div>
  );
};
