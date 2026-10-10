import React from 'react';
import { ExternalLink, FolderOpen, Trash2 } from 'lucide-react';
import { openFileWithDefaultApp, showFileInFolder } from '../../utils/folderUtils';
import { FileItem } from '../../types/queue';

interface QueueCardActionsProps {
  file: FileItem;
  idx: number;
  onRemoveFile: (index: number) => void;
}

export const QueueCardActions: React.FC<QueueCardActionsProps> = ({ file, idx, onRemoveFile }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openFileWithDefaultApp(file.path);
        }}
        disabled={file.isMissing || file.isCorrupted}
        title="Open File (Default Viewer)"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          opacity: file.isMissing || file.isCorrupted ? 0.3 : 0.7,
          cursor: file.isMissing || file.isCorrupted ? 'not-allowed' : 'pointer',
          padding: '4px 5px',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!file.isMissing && !file.isCorrupted) {
            e.currentTarget.style.color = 'var(--accent-cyan)';
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!file.isMissing && !file.isCorrupted) {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <ExternalLink size={14} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          showFileInFolder(file.path);
        }}
        disabled={file.isMissing}
        title="Open Containing Folder"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          opacity: file.isMissing ? 0.3 : 0.7,
          cursor: file.isMissing ? 'not-allowed' : 'pointer',
          padding: '4px 5px',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!file.isMissing) {
            e.currentTarget.style.color = 'var(--accent-cyan)';
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!file.isMissing) {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <FolderOpen size={14} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveFile(idx);
        }}
        title="Remove from Queue"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          opacity: 0.7,
          cursor: 'pointer',
          padding: '4px 5px',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent-rose)';
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-dim)';
          e.currentTarget.style.opacity = '0.7';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
