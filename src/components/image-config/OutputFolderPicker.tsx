import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';

export interface OutputFolderPickerProps {
  outputDir: string | null;
  fileCount: number;
  onBrowse: () => void;
  onOpen?: () => void;
}

export const OutputFolderPicker: React.FC<OutputFolderPickerProps> = ({
  outputDir,
  fileCount,
  onBrowse,
  onOpen,
}) => {
  return (
    <div>
      <span className="image-config-section-label">Output Folder</span>
      <div className="image-config-folder-row">
        <div
          onClick={onBrowse}
          className="image-config-folder-box"
          title="Click to browse destination folder"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', minWidth: 0 }}>
            <Folder
              size={14}
              color={outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'}
              style={{ flexShrink: 0 }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {outputDir || 'Same as Source File Directory'}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)', opacity: 0.8, flexShrink: 0 }}>
            Browse
          </span>
        </div>

        {(outputDir || fileCount > 0) && (
          <button
            type="button"
            onClick={onOpen}
            title="Open Destination Folder in Explorer"
            className="image-config-folder-open-btn"
          >
            <FolderOpen size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
