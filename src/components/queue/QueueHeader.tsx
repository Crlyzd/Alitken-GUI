import React from 'react';
import { ArrowUpDown, Trash2 } from 'lucide-react';
import { GlassSelect, GlassSelectOption } from '../ui/GlassSelect';
import { FileItem, SortOption } from '../../types/queue';

export interface QueueHeaderProps {
  files: FileItem[];
  currentMediaKind: string;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onClearInvalid?: () => void;
  onClearFiles: () => void;
}

export const QueueHeader: React.FC<QueueHeaderProps> = ({
  files,
  currentMediaKind,
  sortOption,
  onSortChange,
  onClearInvalid,
  onClearFiles,
}) => {
  if (files.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
        QUEUE ({files.length} {currentMediaKind.toUpperCase()} {files.length === 1 ? 'FILE' : 'FILES'})
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Frosted Glass Sorting Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '175px' }}>
          <ArrowUpDown size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
          <GlassSelect
            value={sortOption}
            onChange={(val) => onSortChange(val as SortOption)}
            options={[
              { value: 'DEFAULT', label: 'Original Order' },
              ...(sortOption === 'CUSTOM' ? [{ value: 'CUSTOM', label: 'Custom Order' }] : []),
              { value: 'NAME_ASC', label: 'Name (A → Z / 0 → 9)' },
              { value: 'NAME_DESC', label: 'Name (Z → A / 9 → 0)' },
              { value: 'SIZE_ASC', label: 'Size (Smallest)' },
              { value: 'SIZE_DESC', label: 'Size (Largest)' },
              ...(currentMediaKind === 'video'
                ? [
                    { value: 'DURATION_ASC', label: 'Duration (Shortest)' },
                    { value: 'DURATION_DESC', label: 'Duration (Longest)' },
                  ]
                : []),
            ] as GlassSelectOption[]}
          />
        </div>

        {files.some((f) => f.isMissing || f.isCorrupted) && onClearInvalid && (
          <button
            onClick={onClearInvalid}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '6px',
              padding: '3px 8px',
              color: '#fb7185',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Remove missing, 0-byte, and corrupted files from queue"
          >
            <Trash2 size={12} /> Clear Invalid
          </button>
        )}

        <button
          onClick={onClearFiles}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-rose)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Trash2 size={13} /> Clear All
        </button>
      </div>
    </div>
  );
};
