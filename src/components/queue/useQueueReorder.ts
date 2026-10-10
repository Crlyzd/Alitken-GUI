import { useState, useEffect, useRef } from 'react';
import { FileItem, SortOption } from '../../types/queue';

interface UseQueueReorderProps {
  files: FileItem[];
  onReorderFiles?: (sortedFiles: FileItem[]) => void;
  setSortOption: (val: SortOption) => void;
}

export function useQueueReorder({ files, onReorderFiles, setSortOption }: UseQueueReorderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [startY, setStartY] = useState<number>(0);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const [itemHeight, setItemHeight] = useState<number>(68);
  const [isJustDropped, setIsJustDropped] = useState<boolean>(false);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerElemRef = useRef<HTMLElement | null>(null);

  const cancelOrReleaseDrag = () => {
    if (activePointerIdRef.current !== null && activePointerElemRef.current) {
      try {
        activePointerElemRef.current.releasePointerCapture(activePointerIdRef.current);
      } catch {
        // Ignore pointer release error if already released
      }
      activePointerIdRef.current = null;
      activePointerElemRef.current = null;
    }
    setDraggedIndex(null);
    setStartY(0);
    setDragOffsetY(0);
  };

  useEffect(() => {
    if (draggedIndex === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) {
        handlePointerUp();
        return;
      }
      const deltaY = e.clientY - startY;
      setDragOffsetY(deltaY);
    };

    const handlePointerUp = () => {
      if (draggedIndex !== null && itemHeight > 0) {
        const slotsMoved = Math.round(dragOffsetY / itemHeight);
        const targetIndex = Math.min(Math.max(0, draggedIndex + slotsMoved), files.length - 1);

        if (targetIndex !== draggedIndex) {
          const reordered = [...files];
          const [removed] = reordered.splice(draggedIndex, 1);
          reordered.splice(targetIndex, 0, removed);

          setSortOption('CUSTOM');
          if (onReorderFiles) {
            onReorderFiles(reordered);
          }
        }
      }

      setIsJustDropped(true);
      cancelOrReleaseDrag();

      setTimeout(() => {
        setIsJustDropped(false);
      }, 120);
    };

    const handleBlurOrLeave = () => {
      setIsJustDropped(true);
      cancelOrReleaseDrag();
      setTimeout(() => {
        setIsJustDropped(false);
      }, 120);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleBlurOrLeave);
    window.addEventListener('mouseleave', handleBlurOrLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleBlurOrLeave);
      window.removeEventListener('mouseleave', handleBlurOrLeave);
    };
  }, [draggedIndex, startY, dragOffsetY, itemHeight, files, onReorderFiles, setSortOption]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (files[index]?.isMissing) return;

    if (cardsContainerRef.current && cardsContainerRef.current.children.length > 0) {
      const firstCard = cardsContainerRef.current.children[0] as HTMLElement;
      const cardRect = firstCard.getBoundingClientRect();
      setItemHeight(cardRect.height + 10);
    }

    activePointerIdRef.current = e.pointerId;
    activePointerElemRef.current = e.currentTarget;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }

    setDraggedIndex(index);
    setStartY(e.clientY);
    setDragOffsetY(0);
    setIsJustDropped(false);
  };

  let activeTargetIndex = draggedIndex;
  if (draggedIndex !== null && itemHeight > 0) {
    const slotsMoved = Math.round(dragOffsetY / itemHeight);
    activeTargetIndex = Math.min(Math.max(0, draggedIndex + slotsMoved), files.length - 1);
  }

  return {
    draggedIndex,
    dragOffsetY,
    itemHeight,
    isJustDropped,
    cardsContainerRef,
    handleCardPointerDown,
    activeTargetIndex,
  };
}
