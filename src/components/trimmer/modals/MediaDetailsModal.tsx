import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../../../types';
import { FullMediaInfoPayload } from '../../../types/media';
import { MediaSpecsVisualView } from './MediaSpecsVisualView';
import { MediaDetailsToolbar } from './MediaDetailsToolbar';

export interface MediaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [data, setData] = useState<FullMediaInfoPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    invoke<FullMediaInfoPayload>('get_full_media_info', { filePath: file.path })
      .then((res) => setData(res))
      .catch((err) => {
        console.error('Failed to probe full MediaInfo:', err);
        setError(typeof err === 'string' ? err : 'Failed to retrieve detailed MediaInfo');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, file.path]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1800);
  };

  const handleRevealInExplorer = () => {
    invoke('show_in_folder', { filePath: file.path }).catch((err) =>
      console.error('Failed to reveal file:', err)
    );
  };

  const handleCopyMediaInfo = () => {
    if (!data?.mediainfo_text) return;
    navigator.clipboard.writeText(data.mediainfo_text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  };

  const handleCopyJson = () => {
    if (!data?.raw_json) return;
    navigator.clipboard.writeText(data.raw_json);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.70)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '88vh',
          background: 'var(--bg-glass-dropdown, rgba(18, 22, 36, 0.95))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.15))',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-main)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
                flexShrink: 0,
              }}
            >
              <FileText size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                MediaInfo Specifications
              </h3>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '520px',
                }}
                title={file.name}
              >
                {file.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Tabs & Copy Actions */}
        <MediaDetailsToolbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onCopyPath={handleCopyPath}
          copiedPath={copiedPath}
          onRevealInExplorer={handleRevealInExplorer}
          onCopyMediaInfo={handleCopyMediaInfo}
          copiedText={copiedText}
          onCopyJson={handleCopyJson}
          copiedJson={copiedJson}
        />

        {/* Body Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: '340px' }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '280px',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              Loading comprehensive MediaInfo specifications...
            </div>
          ) : error ? (
            <div
              style={{
                color: '#ef4444',
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          ) : activeTab === 'visual' ? (
            data ? (
              <MediaSpecsVisualView data={data} />
            ) : null
          ) : (
            /* MediaInfo Text View */
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '14px 18px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '11px',
                lineHeight: '1.6',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                userSelect: 'text',
              }}
            >
              {data?.mediainfo_text || 'No MediaInfo text generated.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
