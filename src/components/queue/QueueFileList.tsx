import React from 'react';
import { FileItem } from '../../types/queue';
import { QueueFileCard } from './QueueFileCard';

export interface QueueFileListProps {
  files: FileItem[];
  cardsContainerRef: React.RefObject<HTMLDivElement>;
  draggedIndex: number | null;
  dragOffsetY: number;
  itemHeight: number;
  isJustDropped: boolean;
  activeTargetIndex: number | null;
  handleCardPointerDown: (e: React.PointerEvent<HTMLDivElement>, index: number) => void;
  onRemoveFile: (index: number) => void;
  onOpenTrimmer?: (file: FileItem) => void;
}

export const QueueFileList: React.FC<QueueFileListProps> = ({
  files,
  cardsContainerRef,
  draggedIndex,
  dragOffsetY,
  itemHeight,
  isJustDropped,
  activeTargetIndex,
  handleCardPointerDown,
  onRemoveFile,
  onOpenTrimmer,
}) => {
  return (
    <div
      ref={cardsContainerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '6px 6px 8px 2px',
        userSelect: draggedIndex !== null ? 'none' : 'auto',
        position: 'relative',
      }}
    >
      {files.map((file, idx) => {
        const isBeingDragged = draggedIndex === idx;

        let translateY = 0;
        if (draggedIndex !== null && activeTargetIndex !== null) {
          if (isBeingDragged) {
            translateY = dragOffsetY;
          } else {
            if (draggedIndex < activeTargetIndex) {
              if (idx > draggedIndex && idx <= activeTargetIndex) {
                translateY = -itemHeight;
              }
            } else if (draggedIndex > activeTargetIndex) {
              if (idx < draggedIndex && idx >= activeTargetIndex) {
                translateY = itemHeight;
              }
            }
          }
        }

        return (
          <QueueFileCard
            key={file.path || idx}
            file={file}
            idx={idx}
            isBeingDragged={isBeingDragged}
            translateY={translateY}
            isJustDropped={isJustDropped}
            onPointerDown={(e) => handleCardPointerDown(e, idx)}
            onRemoveFile={onRemoveFile}
            onOpenTrimmer={onOpenTrimmer}
          />
        );
      })}
    </div>
  );
};
