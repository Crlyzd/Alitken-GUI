import React, { useState, useEffect, useRef } from 'react';
import { getFileKind } from '../../utils/mediaType';
import { FileItem, SortOption } from '../../types/queue';
import { QueueDropArea } from './QueueDropArea';
import { QueueHeader } from './QueueHeader';
import { QueueFileList } from './QueueFileList';
import { useQueueReorder } from './useQueueReorder';

export interface DropzoneProps {
  files: FileItem[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onReorderFiles?: (sortedFiles: FileItem[]) => void;
  onOpenTrimmer?: (file: FileItem) => void;
  isDragOver?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onReorderFiles,
  onOpenTrimmer,
  isDragOver = false,
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('DEFAULT');
  const initialFilesRef = useRef<FileItem[]>([]);

  const {
    draggedIndex,
    dragOffsetY,
    itemHeight,
    isJustDropped,
    cardsContainerRef,
    handleCardPointerDown,
    activeTargetIndex,
  } = useQueueReorder({ files, onReorderFiles, setSortOption });

  useEffect(() => {
    if (files.length === 0) {
      initialFilesRef.current = [];
      setSortOption('DEFAULT');
    } else if (initialFilesRef.current.length !== files.length && sortOption === 'DEFAULT') {
      initialFilesRef.current = [...files];
    }
  }, [files, sortOption]);

  const handleSortChange = (newSort: SortOption) => {
    setSortOption(newSort);
    if (!onReorderFiles) return;

    if (newSort === 'CUSTOM') {
      return;
    }

    if (newSort === 'DEFAULT') {
      if (initialFilesRef.current.length > 0) {
        const currentPaths = new Set(files.map((f) => f.path.toLowerCase()));
        const restored = initialFilesRef.current.filter((f) => currentPaths.has(f.path.toLowerCase()));
        onReorderFiles(restored);
      }
      return;
    }

    const sorted = [...files];
    if (newSort === 'NAME_ASC') {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (newSort === 'NAME_DESC') {
      sorted.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (newSort === 'SIZE_ASC') {
      sorted.sort((a, b) => a.sizeMb - b.sizeMb);
    } else if (newSort === 'SIZE_DESC') {
      sorted.sort((a, b) => b.sizeMb - a.sizeMb);
    } else if (newSort === 'DURATION_ASC') {
      sorted.sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0));
    } else if (newSort === 'DURATION_DESC') {
      sorted.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0));
    }

    onReorderFiles(sorted);
  };

  const handleClearInvalid = () => {
    const filtered = files.filter((f) => !f.isMissing && !f.isCorrupted);
    if (onReorderFiles) {
      onReorderFiles(filtered);
    }
    if (filtered.length === 0) {
      onClearFiles();
    }
  };

  const currentMediaKind = files.length > 0 ? getFileKind(files[0].path) : 'unknown';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, gap: '14px' }}>
      <QueueDropArea
        currentMediaKind={currentMediaKind}
        isDragOverProp={isDragOver}
        onAddFiles={onAddFiles}
      />

      <QueueHeader
        files={files}
        currentMediaKind={currentMediaKind}
        sortOption={sortOption}
        onSortChange={handleSortChange}
        onClearInvalid={handleClearInvalid}
        onClearFiles={onClearFiles}
      />

      <QueueFileList
        files={files}
        cardsContainerRef={cardsContainerRef}
        draggedIndex={draggedIndex}
        dragOffsetY={dragOffsetY}
        itemHeight={itemHeight}
        isJustDropped={isJustDropped}
        activeTargetIndex={activeTargetIndex}
        handleCardPointerDown={handleCardPointerDown}
        onRemoveFile={onRemoveFile}
        onOpenTrimmer={onOpenTrimmer}
      />
    </div>
  );
};
