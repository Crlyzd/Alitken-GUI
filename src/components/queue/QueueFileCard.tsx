import React from 'react';
import { FileVideo, FileImage, Film, Clock, HardDrive, Activity, Scissors, GripVertical } from 'lucide-react';
import { getFileKind } from '../../utils/mediaType';
import { FileItem, formatBitrate } from '../../types/queue';
import { QueueCardBadges } from './QueueCardBadges';
import { QueueCardActions } from './QueueCardActions';

export interface QueueFileCardProps {
  file: FileItem;
  idx: number;
  isBeingDragged: boolean;
  translateY: number;
  isJustDropped: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemoveFile: (index: number) => void;
  onOpenTrimmer?: (file: FileItem) => void;
}

const formatDuration = (sec?: number) => {
  if (sec === undefined || sec === null || isNaN(sec) || sec < 0) return 'N/A';
  if (sec === 0) return '0m 0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
};

export const QueueFileCard: React.FC<QueueFileCardProps> = ({
  file,
  idx,
  isBeingDragged,
  translateY,
  isJustDropped,
  onPointerDown,
  onRemoveFile,
  onOpenTrimmer,
}) => {
  const isImg = getFileKind(file.path) === 'image';
  const trimmedDuration =
    file.trimStartSec !== undefined && file.trimEndSec !== undefined
      ? Math.max(0, file.trimEndSec - file.trimStartSec)
      : (file.durationSec ?? 0);

  const hasTrim =
    !isImg &&
    file.trimStartSec !== undefined &&
    file.trimEndSec !== undefined &&
    trimmedDuration > 0 &&
    (file.trimStartSec > 0.05 ||
      (file.durationSec !== undefined && file.trimEndSec < file.durationSec - 0.05));

  const hasCrop =
    Boolean(file.isCropApplied) ||
    (file.crop_w !== undefined && file.crop_h !== undefined) ||
    Boolean(file.aspectRatio && file.aspectRatio !== 'ORIGINAL');

  return (
    <div
      className="glass-card"
      onPointerDown={onPointerDown}
      style={{
        padding: '10px 10px 10px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        border: isBeingDragged
          ? '1.5px solid var(--accent-cyan)'
          : file.isMissing || file.isCorrupted
          ? '1px solid rgba(244, 63, 94, 0.45)'
          : undefined,
        boxShadow: isBeingDragged
          ? '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(6, 182, 212, 0.35)'
          : undefined,
        background: isBeingDragged
          ? 'rgba(6, 182, 212, 0.14)'
          : file.isMissing || file.isCorrupted
          ? 'rgba(244, 63, 94, 0.06)'
          : undefined,
        transform: `translateY(${translateY}px)`,
        zIndex: isBeingDragged ? 50 : 1,
        opacity: 1,
        cursor:
          file.isMissing || file.isCorrupted
            ? 'default'
            : isBeingDragged
            ? 'grabbing'
            : 'grab',
        transition:
          isBeingDragged || isJustDropped
            ? 'none'
            : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), border 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
        touchAction: 'none',
        position: 'relative',
      }}
    >
      {/* Compact Left Grip & Trim Action Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: isBeingDragged ? 'var(--accent-cyan)' : 'var(--text-dim)',
            opacity: isBeingDragged ? 1 : 0.4,
            flexShrink: 0,
            cursor: 'grab',
            padding: '2px 0 2px 2px',
          }}
          title="Drag to reorder queue"
        >
          <GripVertical size={14} />
        </div>

        {!isImg && onOpenTrimmer && !file.isMissing && !file.isCorrupted && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTrimmer(file);
            }}
            title={hasTrim ? 'Edit Video Trim Selection' : 'Open Video in Trimmer'}
            className={`queue-trim-btn ${hasTrim ? 'has-trim' : ''}`}
          >
            <Scissors size={15} />
          </button>
        )}
      </div>

      {/* Middle Media Icon and Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background:
              file.isMissing || file.isCorrupted
                ? 'rgba(244, 63, 94, 0.2)'
                : isImg
                ? 'rgba(168, 85, 247, 0.15)'
                : 'rgba(6, 182, 212, 0.15)',
            border: `1px solid ${
              file.isMissing || file.isCorrupted
                ? 'rgba(244, 63, 94, 0.4)'
                : isImg
                ? 'rgba(168, 85, 247, 0.25)'
                : 'rgba(6, 182, 212, 0.25)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:
              file.isMissing || file.isCorrupted
                ? '#fb7185'
                : isImg
                ? '#c084fc'
                : 'var(--accent-cyan)',
            flexShrink: 0,
          }}
        >
          {isImg ? <FileImage size={20} /> : <FileVideo size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: file.isMissing || file.isCorrupted ? '#fb7185' : 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
            }}
            title={file.name}
          >
            {file.name}
          </h4>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-dim)',
              marginTop: '3px',
            }}
          >
            {file.resolution && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Film size={11} /> {file.resolution}
              </span>
            )}
            {!isImg && file.durationSec !== undefined && file.durationSec > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={11} /> {formatDuration(file.durationSec)}
              </span>
            )}
            {file.sizeMb > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <HardDrive size={11} /> {file.sizeMb.toFixed(1)} MB
              </span>
            ) : file.isCorrupted ? (
              <span
                style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fb7185' }}
              >
                <HardDrive size={11} /> 0 B
              </span>
            ) : null}
            {!isImg && file.bitrateKbps !== undefined && file.bitrateKbps > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Activity size={11} /> {formatBitrate(file.bitrateKbps)}
              </span>
            )}
            {file.codec && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: isImg ? '#c084fc' : 'var(--accent-cyan)',
                }}
              >
                {file.codec}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Column: Badges & Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '4px',
          flexShrink: 0,
        }}
      >
        <QueueCardBadges
          file={file}
          hasTrim={hasTrim}
          hasCrop={hasCrop}
          trimmedDuration={trimmedDuration}
          formatDuration={formatDuration}
        />
        <QueueCardActions file={file} idx={idx} onRemoveFile={onRemoveFile} />
      </div>
    </div>
  );
};
