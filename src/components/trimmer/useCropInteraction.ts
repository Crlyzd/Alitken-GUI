import { useState, useRef, useEffect, useCallback } from 'react';
import { AspectRatioOption } from '../../types/media';

interface UseCropInteractionProps {
  aspectRatio: AspectRatioOption;
  cropOffset: { x: number; y: number };
  onCropOffsetChange: (offset: { x: number; y: number }) => void;
  cropScale: number;
  onCropScaleChange?: (scale: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  videoWrapperRef: React.RefObject<HTMLDivElement>;
  canvasAspect: number;
  videoAspect: number;
}

export function useCropInteraction({
  aspectRatio,
  cropOffset,
  onCropOffsetChange,
  cropScale,
  onCropScaleChange,
  containerRef,
  videoWrapperRef,
  canvasAspect,
  videoAspect,
}: UseCropInteractionProps) {
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
    centerX: number;
    centerY: number;
    startRadius: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    startOffsetX: 0.5,
    startOffsetY: 0.5,
    startScale: 1.0,
    centerX: 0,
    centerY: 0,
    startRadius: 1.0,
  });

  const handleMoveStart = useCallback(
    (e: React.MouseEvent) => {
      if (aspectRatio === 'ORIGINAL') return;
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingMove(true);
      const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
      const cx = wrapperRect ? wrapperRect.left + wrapperRect.width / 2 : e.clientX;
      const cy = wrapperRect ? wrapperRect.top + wrapperRect.height / 2 : e.clientY;
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startOffsetX: cropOffset.x,
        startOffsetY: cropOffset.y,
        startScale: cropScale,
        centerX: cx,
        centerY: cy,
        startRadius: 1.0,
      };
    },
    [aspectRatio, cropOffset, cropScale, videoWrapperRef]
  );

  const handleResizeStart = useCallback(
    (corner: string, e: React.MouseEvent) => {
      if (aspectRatio === 'ORIGINAL') return;
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingResize(corner);
      const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
      const cx = wrapperRect ? wrapperRect.left + wrapperRect.width / 2 : e.clientX;
      const cy = wrapperRect ? wrapperRect.top + wrapperRect.height / 2 : e.clientY;
      const startRadius = Math.hypot(e.clientX - cx, e.clientY - cy);

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startOffsetX: cropOffset.x,
        startOffsetY: cropOffset.y,
        startScale: cropScale,
        centerX: cx,
        centerY: cy,
        startRadius: Math.max(10, startRadius),
      };
    },
    [aspectRatio, cropOffset, cropScale, videoWrapperRef]
  );

  useEffect(() => {
    if (!isDraggingMove && !isDraggingResize) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      if (isDraggingMove) {
        const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
        const currentScale = Math.max(0.01, cropScale || 1.0);
        const wW = wrapperRect && wrapperRect.width > 0 ? wrapperRect.width / currentScale : rect.width;
        const wH = wrapperRect && wrapperRect.height > 0 ? wrapperRect.height / currentScale : rect.height;
        const sensitivityX = 1 / wW;
        const sensitivityY = 1 / wH;

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

        if (isMagnet && rect.width > 0 && rect.height > 0) {
          const scaledW = wW * currentScale;
          const scaledH = wH * currentScale;
          const leftSnapX = 0.5 - (rect.width - scaledW) / (2 * wW);
          const rightSnapX = 0.5 + (rect.width - scaledW) / (2 * wW);
          const topSnapY = 0.5 - (rect.height - scaledH) / (2 * wH);
          const bottomSnapY = 0.5 + (rect.height - scaledH) / (2 * wH);

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

        const minFillScale = Math.max(canvasAspect / videoAspect, videoAspect / canvasAspect);
        const maxScale = Math.max(10.0, minFillScale * 1.5);

        const v0X = dragStartRef.current.mouseX - dragStartRef.current.centerX;
        const v0Y = dragStartRef.current.mouseY - dragStartRef.current.centerY;
        const vX = e.clientX - dragStartRef.current.centerX;
        const vY = e.clientY - dragStartRef.current.centerY;

        const dot = vX * v0X + vY * v0Y;
        const r0Sq = dragStartRef.current.startRadius * dragStartRef.current.startRadius;
        const ratio = r0Sq > 0 ? dot / r0Sq : 1.0;

        let targetScale = Math.max(0.3, Math.min(maxScale, dragStartRef.current.startScale * ratio));

        let snapL = false;
        let snapR = false;
        let snapT = false;
        let snapB = false;

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
  }, [
    isDraggingMove,
    isDraggingResize,
    cropScale,
    canvasAspect,
    videoAspect,
    containerRef,
    videoWrapperRef,
    onCropOffsetChange,
    onCropScaleChange,
  ]);

  return {
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
  };
}
