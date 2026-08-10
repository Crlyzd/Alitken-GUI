import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import { AspectRatioOption } from '../../types/media';
import { AspectRatioSelector } from './AspectRatioSelector';

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
  aspectRatio: AspectRatioOption;
  onSelectAspectRatio: (ratio: AspectRatioOption) => void;
  cropOffset: { x: number; y: number };
  onCropOffsetChange: (offset: { x: number; y: number }) => void;
  isCropApplied?: boolean;
  onApplyCrop?: () => void;
  onCancelCrop?: () => void;
}

const RATIO_NUMERICS: Record<string, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '4:3': 4 / 3,
  '21:9': 21 / 9,
};

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
  isDragOver = false,
  aspectRatio,
  onSelectAspectRatio,
  cropOffset,
  onCropOffsetChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);
  const [videoScale, setVideoScale] = useState<number>(1.0);

  const [isDraggingMove, setIsDraggingMove] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState<string | null>(null);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startOffsetX: number;
    startOffsetY: number;
    startScale: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    startOffsetX: 0.5,
    startOffsetY: 0.5,
    startScale: 1.0,
  });



  const handleMetadata = useCallback(() => {
    onLoadedMetadata();
    if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
      setVideoAspect(videoRef.current.videoWidth / videoRef.current.videoHeight);
    }
  }, [onLoadedMetadata, videoRef]);

  // Re-center crop offset and scale when aspect ratio changes
  const handleRatioChange = useCallback(
    (newRatio: AspectRatioOption) => {
      onSelectAspectRatio(newRatio);
      onCropOffsetChange({ x: 0.5, y: 0.5 });
      setVideoScale(1.0);
    },
    [onSelectAspectRatio, onCropOffsetChange]
  );



  // Handle Drag Move Start (body of video layer)
  const handleMoveStart = useCallback(
    (e: React.MouseEvent) => {
      if (aspectRatio === 'ORIGINAL') return;
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingMove(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startOffsetX: cropOffset.x,
        startOffsetY: cropOffset.y,
        startScale: videoScale,
      };
    },
    [aspectRatio, cropOffset, videoScale]
  );

  // Handle Corner Handle Resize Start
  const handleResizeStart = useCallback(
    (corner: string, e: React.MouseEvent) => {
      if (aspectRatio === 'ORIGINAL') return;
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingResize(corner);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startOffsetX: cropOffset.x,
        startOffsetY: cropOffset.y,
        startScale: videoScale,
      };
    },
    [aspectRatio, cropOffset, videoScale]
  );

  // Continuous Drag & Resize Handler
  useEffect(() => {
    if (!isDraggingMove && !isDraggingResize) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      if (isDraggingMove) {
        // Use the video wrapper's own dimensions so translate(X%, Y%) maps 1:1 to mouse pixels
        const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
        const wW = wrapperRect && wrapperRect.width > 0 ? wrapperRect.width : rect.width;
        const wH = wrapperRect && wrapperRect.height > 0 ? wrapperRect.height : rect.height;
        const sensitivityX = 1 / wW;
        const sensitivityY = 1 / wH;

        const rawX = dragStartRef.current.startOffsetX + deltaX * sensitivityX;
        const rawY = dragStartRef.current.startOffsetY + deltaY * sensitivityY;

        onCropOffsetChange({ x: rawX, y: rawY });
      } else if (isDraggingResize) {
        // Uniform aspect ratio locked resize based on drag distance
        // minFillScale = scale needed to fill the entire canvas (no black bars)
        const minFillScale = Math.max(canvasAspect / videoAspect, videoAspect / canvasAspect);
        const maxScale = Math.max(10.0, minFillScale * 1.5);
        const distance = (deltaX + deltaY) / (rect.width || 400);
        const factor = isDraggingResize.includes('top') || isDraggingResize.includes('left') ? -distance : distance;
        const newScale = Math.max(0.3, Math.min(maxScale, dragStartRef.current.startScale + factor * 1.5));
        setVideoScale(newScale);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingMove(false);
      setIsDraggingResize(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMove, isDraggingResize, onCropOffsetChange]);

  const targetRatio = RATIO_NUMERICS[aspectRatio];
  const canvasAspect = targetRatio || videoAspect;
  const isVideoWider = videoAspect >= canvasAspect;

  // Free translation: offset 0.5 = centered; 100 = 1:1 pixel mapping with mouse
  const translateX = (cropOffset.x - 0.5) * 100;
  const translateY = (cropOffset.y - 0.5) * 100;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        minHeight: '200px',
        maxHeight: '440px',
        overflow: 'hidden',
        gap: '4px',
      }}
    >
      {/* Outer Canvas Container (The Black Area - Matches Target Aspect Ratio) */}
      <div
        ref={containerRef}
        style={{
          aspectRatio: `${canvasAspect}`,
          height: '100%',
          maxHeight: '440px',
          maxWidth: '100%',
          borderRadius: '0px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          boxShadow: 'none',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          userSelect: 'none',
        }}
      >
        {/* File Drag-over Indicator */}
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
              borderRadius: '0px',
              zIndex: 40,
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

        {/* Loading Overlay */}
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
              borderRadius: '0px',
              overflow: 'hidden',
              zIndex: 30,
              gap: '10px',
              color: '#ffffff',
            }}
          >
            <Loader2 size={32} className="spinning-loader" style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Preparing 60 FPS Live Preview...</span>
          </div>
        )}

        {/* Inner Video Layer (Draggable & Resizable - Native Aspect Ratio Locked) */}
        <div
          ref={videoWrapperRef}
          onMouseDown={aspectRatio !== 'ORIGINAL' ? handleMoveStart : undefined}
          onDoubleClick={() => {
            onCropOffsetChange({ x: 0.5, y: 0.5 });
            setVideoScale(1.0);
          }}
          style={{
            position: 'relative',
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
                ? `translate(${translateX}%, ${translateY}%) scale(${videoScale})`
                : 'none',
            transition: isDraggingMove || isDraggingResize ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
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
                border: '1.5px solid rgba(255, 255, 255, 0.85)',
                boxShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
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
              onLoadedMetadata={handleMetadata}
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
                gap: '8px',
              }}
            >
              <Loader2 size={24} className="spinning-loader" />
              <span>Extracting GPU Preview Frame...</span>
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
                  top: '-5px',
                  left: '-5px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #000000',
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                  cursor: 'nwse-resize',
                  zIndex: 20,
                }}
              />
              {/* Top-Right Handle */}
              <div
                onMouseDown={(e) => handleResizeStart('top-right', e)}
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #000000',
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                  cursor: 'nesw-resize',
                  zIndex: 20,
                }}
              />
              {/* Bottom-Left Handle */}
              <div
                onMouseDown={(e) => handleResizeStart('bottom-left', e)}
                style={{
                  position: 'absolute',
                  bottom: '-5px',
                  left: '-5px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #000000',
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                  cursor: 'nesw-resize',
                  zIndex: 20,
                }}
              />
              {/* Bottom-Right Handle */}
              <div
                onMouseDown={(e) => handleResizeStart('bottom-right', e)}
                style={{
                  position: 'absolute',
                  bottom: '-5px',
                  right: '-5px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #000000',
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                  cursor: 'nwse-resize',
                  zIndex: 20,
                }}
              />
            </>
          )}
        </div>




      </div>

      {/* Aspect Ratio Chooser — below canvas, right-aligned, no shadow bleed */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          width: '100%',
          paddingRight: '2px',
        }}
      >
        <AspectRatioSelector selectedRatio={aspectRatio} onSelectRatio={handleRatioChange} />
      </div>
    </div>
  );
};
