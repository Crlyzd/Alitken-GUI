import React from 'react';
import { ArrowLeft, Sparkles, Film, Clock, HardDrive } from 'lucide-react';
import { FileItem } from '../Dropzone';
import { formatTimeWithMs } from '../TimelineSlider';

interface TrimmerHeaderProps {
  file: FileItem;
  onSaveAndBack: () => void;
}

export const TrimmerHeader: React.FC<TrimmerHeaderProps> = ({ file, onSaveAndBack }) => {
  return (
    <div
      className="glass-card"
      style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderRadius: '14px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          type="button"
          onClick={onSaveAndBack}
          title="Return to File Queue (Saves Trim Markers)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-main)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-cyan)';
            e.currentTarget.style.color = 'var(--accent-cyan)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glass)';
            e.currentTarget.style.color = 'var(--text-main)';
          }}
        >
          <ArrowLeft size={14} /> Back to Queue
        </button>

        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={file.name}
          >
            {file.name}
          </h3>
        </div>
      </div>

      {/* Metadata Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-cyan)',
          }}
        >
          <Sparkles size={11} /> 60 FPS Live Preview
        </span>

        {file.resolution && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '11px',
              color: 'var(--text-dim)',
            }}
          >
            <Film size={11} /> {file.resolution}
          </span>
        )}
        {file.durationSec && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '11px',
              color: 'var(--text-dim)',
            }}
          >
            <Clock size={11} /> {formatTimeWithMs(file.durationSec)}
          </span>
        )}
        {file.sizeMb > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '11px',
              color: 'var(--text-dim)',
            }}
          >
            <HardDrive size={11} /> {file.sizeMb.toFixed(1)} MB
          </span>
        )}
      </div>
    </div>
  );
};
