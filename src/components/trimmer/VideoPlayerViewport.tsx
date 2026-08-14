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
  cropScale?: number;
  onCropScaleChange?: (scale: number) => void;
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
  cropScale = 1.0,
  onCropScaleChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);

  const [isDraggingMove, setIsDraggingMove] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState<string | null>(null);

  const [isSnappedX, setIsSnappedX] = useState(false);
  const [isSnappedY, setIsSnappedY] = useState(false);
  const [isSnappedLeft, setIsSnappedLeft] = useState(false);
  const [isSnappedRight, setIsSnappedRight] = useState(false);
  const [isSnappedTop, setIsSnappedTop] = useState(false);
  const [isSnappedBottom, setIsSnappedBottom] = useState(false);
  const [isMagnetActive, setIsMagnetActive] = useState(false);
  const [activeAxisLock, setActiveAxisLock] = useState<'vertical' | 'horizontal' | 'both' | null>(null);

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
      onCropScaleChange?.(1.0);
    },
    [onSelectAspectRatio, onCropOffsetChange, onCropScaleChange]
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
        startScale: cropScale,
      };
    },
    [aspectRatio, cropOffset, cropScale]
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
        startScale: cropScale,
      };
    },
    [aspectRatio, cropOffset, cropScale]
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

        // Axis locking with modifier keys:
        // Shift key -> lock vertical movement (Y remains fixed at startOffsetY)
        // Ctrl/Cmd key -> lock horizontal movement (X remains fixed at startOffsetX)
        // Shift / Ctrl / Alt keys -> activate edge magnetic snapping
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;
        const isAlt = e.altKey;
        const isMagnet = isShift || isCtrl || isAlt;
        setIsMagnetActive(isMagnet);

        let lock: 'vertical' | 'horizontal' | 'both' | null = null;
        if (isShift && isCtrl) {
          lock = 'both';
        } else if (isShift) {
          lock = 'vertical';
        } else if (isCtrl) {
          lock = 'horizontal';
        }
        setActiveAxisLock(lock);

        let rawX = isCtrl ? dragStartRef.current.startOffsetX : dragStartRef.current.startOffsetX + deltaX * sensitivityX;
        let rawY = isShift ? dragStartRef.current.startOffsetY : dragStartRef.current.startOffsetY + deltaY * sensitivityY;

        // Center cross section magnetic snapping (0.5 = center)
        const SNAP_THRESHOLD = 0.02;
        let snappedX = false;
        let snappedY = false;
        let snapL = false;
        let snapR = false;
        let snapT = false;
        let snapB = false;

        if (Math.abs(rawX - 0.5) <= SNAP_THRESHOLD) {
          rawX = 0.5;
          snappedX = true;
        }

        if (Math.abs(rawY - 0.5) <= SNAP_THRESHOLD) {
          rawY = 0.5;
          snappedY = true;
        }

        // Shift / Ctrl / Alt key: Outer video container edge magnetic snapping
        if (isMagnet && rect.width > 0 && rect.height > 0) {
          const halfW = (wW / rect.width) / 2;
          const halfH = (wH / rect.height) / 2;

          const leftSnapX = halfW;
          const rightSnapX = 1.0 - halfW;
          const topSnapY = halfH;
          const bottomSnapY = 1.0 - halfH;

          if (!snappedX) {
            if (Math.abs(rawX - leftSnapX) <= SNAP_THRESHOLD) {
              rawX = leftSnapX;
              snapL = true;
            } else if (Math.abs(rawX - rightSnapX) <= SNAP_THRESHOLD) {
              rawX = rightSnapX;
              snapR = true;
            }
          }

          if (!snappedY) {
            if (Math.abs(rawY - topSnapY) <= SNAP_THRESHOLD) {
              rawY = topSnapY;
              snapT = true;
            } else if (Math.abs(rawY - bottomSnapY) <= SNAP_THRESHOLD) {
              rawY = bottomSnapY;
              snapB = true;
            }
          }
        }

        setIsSnappedX(snappedX);
        setIsSnappedY(snappedY);
        setIsSnappedLeft(snapL);
        setIsSnappedRight(snapR);
        setIsSnappedTop(snapT);
        setIsSnappedBottom(snapB);

        onCropOffsetChange({ x: rawX, y: rawY });
      } else if (isDraggingResize) {
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;
        const isAlt = e.altKey;
        const isMagnet = isShift || isCtrl || isAlt;
        setIsMagnetActive(isMagnet);

        // Uniform aspect ratio locked resize based on drag distance
        const minFillScale = Math.max(canvasAspect / videoAspect, videoAspect / canvasAspect);
        const maxScale = Math.max(10.0, minFillScale * 1.5);
        const distance = (deltaX + deltaY) / (rect.width || 400);
        const factor = isDraggingResize.includes('top') || isDraggingResize.includes('left') ? -distance : distance;
        let targetScale = Math.max(0.3, Math.min(maxScale, dragStartRef.current.startScale + factor * 1.5));

        let snapL = false;
        let snapR = false;
        let snapT = false;
        let snapB = false;

        // Shift / Ctrl / Alt key: Outer container magnetic snapping during corner resize
        if (isMagnet) {
          const SCALE_SNAP_THRESHOLD = 0.04;
          if (Math.abs(targetScale - minFillScale) <= SCALE_SNAP_THRESHOLD) {
            targetScale = minFillScale;
            snapL = true;
            snapR = true;
            snapT = true;
            snapB = true;
          } else if (Math.abs(targetScale - 1.0) <= SCALE_SNAP_THRESHOLD) {
            targetScale = 1.0;
            snapL = true;
            snapR = true;
            snapT = true;
            snapB = true;
          }
        }

        setIsSnappedLeft(snapL);
        setIsSnappedRight(snapR);
        setIsSnappedTop(snapT);
        setIsSnappedBottom(snapB);

        onCropScaleChange?.(targetScale);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingMove(false);
      setIsDraggingResize(null);
      setIsSnappedX(false);
      setIsSnappedY(false);
      setIsSnappedLeft(false);
      setIsSnappedRight(false);
      setIsSnappedTop(false);
      setIsSnappedBottom(false);
      setIsMagnetActive(false);
      setActiveAxisLock(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMove, isDraggingResize, onCropOffsetChange, onCropScaleChange]);

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
        contain: 'layout size',
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
          border: 'none',
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

        {/* Thin Glowing Center Cross Section Magnet Guide Lines */}
        {isDraggingMove && (isSnappedX || Math.abs(cropOffset.x - 0.5) < 0.001) && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              width: '1px',
              transform: 'translateX(-50%)',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {isDraggingMove && (isSnappedY || Math.abs(cropOffset.y - 0.5) < 0.001) && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: '1px',
              transform: 'translateY(-50%)',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {/* Outer Container Edge Magnet Guide Lines (Alt key move or resize) */}
        {(isDraggingMove || isDraggingResize) && isSnappedLeft && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '1px',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {(isDraggingMove || isDraggingResize) && isSnappedRight && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '1px',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {(isDraggingMove || isDraggingResize) && isSnappedTop && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: '1px',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {(isDraggingMove || isDraggingResize) && isSnappedBottom && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '1px',
              background: 'rgba(6, 182, 212, 0.95)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          />
        )}

        {/* Center Crosshair Point indicator when both axes are centered */}
        {isDraggingMove &&
          (isSnappedX || Math.abs(cropOffset.x - 0.5) < 0.001) &&
          (isSnappedY || Math.abs(cropOffset.y - 0.5) < 0.001) && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#ffffff',
                border: '1.5px solid var(--accent-cyan)',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 8px var(--accent-cyan)',
                pointerEvents: 'none',
                zIndex: 26,
              }}
            />
          )}

        {/* Axis & Magnet Lock Feedback Toast */}
        {(isDraggingMove || isDraggingResize) && (activeAxisLock || isMagnetActive) && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: 'var(--accent-cyan)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)', flexShrink: 0 }} />
            {activeAxisLock === 'vertical' && 'SHIFT: Locked Vertical'}
            {activeAxisLock === 'horizontal' && 'CTRL: Locked Horizontal'}
            {activeAxisLock === 'both' && 'SHIFT + CTRL: Position Locked'}
            {isMagnetActive && !activeAxisLock && (isDraggingResize ? 'Resize Magnet Active' : 'Edge Magnet Active')}
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
              textAlign: 'center',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(10px)',
              borderRadius: '0px',
              overflow: 'hidden',
              zIndex: 30,
              gap: '12px',
              padding: '0 16px',
              boxSizing: 'border-box',
              color: '#ffffff',
            }}
          >
            <Loader2 size={32} className="spinning-loader" style={{ color: 'var(--accent-cyan)' }} />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
                lineHeight: 1.4,
                maxWidth: '100%',
              }}
            >
              Preparing 60 FPS Live Preview...
            </span>
          </div>
        )}

        {/* Inner Video Layer (Draggable & Resizable - Native Aspect Ratio Locked) */}
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
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0 16px',
                boxSizing: 'border-box',
                gap: '8px',
              }}
            >
              <Loader2 size={24} className="spinning-loader" />
              <span style={{ textAlign: 'center', lineHeight: 1.4 }}>Extracting GPU Preview Frame...</span>
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
