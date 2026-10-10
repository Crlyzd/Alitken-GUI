import React, { useState, useRef, useCallback } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import { AspectRatioOption } from '../../types/media';
import { AspectRatioSelector } from './AspectRatioSelector';
import { CropGuideLines } from './CropGuideLines';
import { VideoCanvasRenderer } from './VideoCanvasRenderer';
import { useCropInteraction } from './useCropInteraction';

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
  onVideoClick?: () => void;
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

  const targetRatio = RATIO_NUMERICS[aspectRatio];
  const canvasAspect = targetRatio || videoAspect;
  const isVideoWider = videoAspect >= canvasAspect;

  // Free translation: offset 0.5 = centered; 100 = 1:1 pixel mapping with mouse
  const translateX = (cropOffset.x - 0.5) * 100;
  const translateY = (cropOffset.y - 0.5) * 100;

  const {
    isDraggingMove,
    isDraggingResize,
    isSnappedX,
    isSnappedY,
    isSnappedLeft,
    isSnappedRight,
    isSnappedTop,
    isSnappedBottom,
    isMagnetActive,
    activeAxisLock,
    handleMoveStart,
    handleResizeStart,
  } = useCropInteraction({
    aspectRatio,
    cropOffset,
    onCropOffsetChange,
    cropScale,
    onCropScaleChange,
    containerRef,
    videoWrapperRef,
    canvasAspect,
    videoAspect,
  });

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
        maxHeight: '100%',
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
          maxHeight: '100%',
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
            <Scissors
              size={40}
              style={{
                color: 'var(--accent-cyan)',
                filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.8))',
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.3px' }}>
                Drop Single Video File
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginTop: '2px',
                }}
              >
                Replace current video target in Trimmer
              </div>
            </div>
          </div>
        )}

        {/* Thin Glowing Center & Container Edge Magnet Guide Lines */}
        <CropGuideLines
          isDraggingMove={isDraggingMove}
          isDraggingResize={isDraggingResize}
          cropOffset={cropOffset}
          isSnappedX={isSnappedX}
          isSnappedY={isSnappedY}
          isSnappedLeft={isSnappedLeft}
          isSnappedRight={isSnappedRight}
          isSnappedTop={isSnappedTop}
          isSnappedBottom={isSnappedBottom}
          isMagnetActive={isMagnetActive}
          activeAxisLock={activeAxisLock}
        />

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
            <Loader2
              size={32}
              className="spinning-loader"
              style={{ color: 'var(--accent-cyan)' }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
                lineHeight: 1.4,
                maxWidth: '100%',
              }}
            >
              Preparing Live Preview...
            </span>
          </div>
        )}

        {/* Inner Video Layer (Draggable & Resizable) */}
        <VideoCanvasRenderer
          videoWrapperRef={videoWrapperRef}
          videoRef={videoRef}
          aspectRatio={aspectRatio}
          videoAspect={videoAspect}
          isVideoWider={isVideoWider}
          cropScale={cropScale}
          translateX={translateX}
          translateY={translateY}
          isDraggingMove={isDraggingMove}
          isDraggingResize={isDraggingResize}
          isNativeSupported={isNativeSupported}
          activeMediaSrc={activeMediaSrc}
          fallbackFrameSrc={fallbackFrameSrc}
          handleMoveStart={handleMoveStart}
          handleResizeStart={handleResizeStart}
          onCropOffsetChange={onCropOffsetChange}
          onCropScaleChange={onCropScaleChange}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={onTimeUpdate}
          onError={onError}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        />
      </div>

      {/* Aspect Ratio Chooser — below canvas, right-aligned */}
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
