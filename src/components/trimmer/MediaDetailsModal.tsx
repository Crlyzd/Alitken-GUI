import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FolderOpen, Film, Music, FileText, Activity, Layers, Terminal } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../Dropzone';
import { FullMediaInfoPayload } from '../../types/media';

interface MediaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({ isOpen, onClose, file }) => {
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>MediaInfo Specifications</h3>
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
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <TabButton
              active={activeTab === 'visual'}
              onClick={() => setActiveTab('visual')}
              icon={<Layers size={13} />}
              label="Visual Specs"
            />
            <TabButton
              active={activeTab === 'text'}
              onClick={() => setActiveTab('text')}
              icon={<Terminal size={13} />}
              label="MediaInfo Text"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <ActionButton
              onClick={handleCopyPath}
              icon={copiedPath ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              label={copiedPath ? 'Path Copied!' : 'Copy Path'}
            />
            <ActionButton
              onClick={handleRevealInExplorer}
              icon={<FolderOpen size={12} />}
              label="Explorer"
            />
            <ActionButton
              onClick={handleCopyMediaInfo}
              icon={copiedText ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              label={copiedText ? 'Report Copied!' : 'Copy Report'}
            />
            <ActionButton
              onClick={handleCopyJson}
              icon={copiedJson ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              label={copiedJson ? 'JSON Copied!' : 'Copy JSON'}
            />
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: '340px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading comprehensive MediaInfo specifications...
            </div>
          ) : error ? (
            <div style={{ color: '#ef4444', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '12px' }}>
              {error}
            </div>
          ) : activeTab === 'visual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* General Section */}
              {data?.general && Object.keys(data.general).length > 0 && (
                <SpecSection title="General & Container" icon={<Film size={14} color="var(--accent-cyan)" />}>
                  {Object.entries(data.general).map(([k, v]) => (
                    <SpecRow key={k} label={k} value={v} />
                  ))}
                </SpecSection>
              )}

              {/* Video Section */}
              {data?.video && Object.keys(data.video).length > 0 && (
                <SpecSection title="Video Track" icon={<Activity size={14} color="var(--accent-cyan)" />}>
                  {Object.entries(data.video).map(([k, v]) => (
                    <SpecRow key={k} label={k} value={v} />
                  ))}
                </SpecSection>
              )}

              {/* Audio Section */}
              {data?.audio && Object.keys(data.audio).length > 0 && (
                <SpecSection title="Audio Track" icon={<Music size={14} color="var(--accent-cyan)" />}>
                  {Object.entries(data.audio).map(([k, v]) => (
                    <SpecRow key={k} label={k} value={v} />
                  ))}
                </SpecSection>
              )}

              {/* Other Tracks Section */}
              {data?.other_tracks && data.other_tracks.length > 0 && (
                <SpecSection title="Metadata & Other Tracks" icon={<Layers size={14} color="var(--accent-cyan)" />}>
                  {data.other_tracks.map((track, i) => (
                    <div key={i} style={{ gridColumn: 'span 2', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                        {Object.entries(track).map(([k, v]) => (
                          <SpecRow key={k} label={k} value={v} />
                        ))}
                      </div>
                    </div>
                  ))}
                </SpecSection>
              )}
            </div>
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

const SpecSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div
    style={{
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '10px',
      padding: '12px 16px',
      border: '1px solid var(--border-glass)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      {icon}
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{title}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>{children}</div>
  </div>
);

const SpecRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
      {label}
    </span>
    <span
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-main)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={value}
    >
      {value}
    </span>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '5px 12px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      background: active ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
      border: active ? '1px solid var(--accent-cyan)' : '1px solid transparent',
      color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
      transition: 'all 0.15s ease',
    }}
  >
    {icon} {label}
  </button>
);

const ActionButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({
  onClick,
  icon,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 9px',
      borderRadius: '7px',
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid var(--border-glass)',
      color: 'var(--text-main)',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
    }}
  >
    {icon} {label}
  </button>
);
