import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';

interface OutputFolderSectionProps {
  outputDir: string | null;
  handleBrowseFolder: () => void;
  handleOpenFolder: () => void;
  fileCount: number;
}

export const OutputFolderSection: React.FC<OutputFolderSectionProps> = ({
  outputDir,
  handleBrowseFolder,
  handleOpenFolder,
  fileCount,
}) => {
  return (
    <div>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.8px',
          display: 'block',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}
      >
        Output Folder
      </span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div
          onClick={handleBrowseFolder}
          style={{
            flex: 1,
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '12px',
            color: outputDir ? 'var(--text-main)' : 'var(--text-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'all 0.15s ease',
          }}
          title="Click to browse destination folder"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <Folder
              size={14}
              color={outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'}
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {outputDir || 'Same as Source File Directory'}
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              opacity: 0.8,
              flexShrink: 0,
            }}
          >
            Browse
          </span>
        </div>

        {(outputDir || fileCount > 0) && (
          <button
            type="button"
            onClick={handleOpenFolder}
            title="Open Destination Folder in Explorer"
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--accent-cyan)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FolderOpen size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
