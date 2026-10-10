import React from 'react';
import { Film, Music, Activity, Layers } from 'lucide-react';
import { FullMediaInfoPayload } from '../../../types/media';

interface MediaSpecsVisualViewProps {
  data: FullMediaInfoPayload;
}

export const MediaSpecsVisualView: React.FC<MediaSpecsVisualViewProps> = ({ data }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* General Section */}
      {data.general && Object.keys(data.general).length > 0 && (
        <SpecSection
          title="General & Container"
          icon={<Film size={14} color="var(--accent-cyan)" />}
        >
          {Object.entries(data.general).map(([k, v]) => (
            <SpecRow key={k} label={k} value={v} />
          ))}
        </SpecSection>
      )}

      {/* Video Section */}
      {data.video && Object.keys(data.video).length > 0 && (
        <SpecSection title="Video Track" icon={<Activity size={14} color="var(--accent-cyan)" />}>
          {Object.entries(data.video).map(([k, v]) => (
            <SpecRow key={k} label={k} value={v} />
          ))}
        </SpecSection>
      )}

      {/* Audio Section */}
      {data.audio && Object.keys(data.audio).length > 0 && (
        <SpecSection title="Audio Track" icon={<Music size={14} color="var(--accent-cyan)" />}>
          {Object.entries(data.audio).map(([k, v]) => (
            <SpecRow key={k} label={k} value={v} />
          ))}
        </SpecSection>
      )}

      {/* Other Tracks Section */}
      {data.other_tracks && data.other_tracks.length > 0 && (
        <SpecSection
          title="Metadata & Other Tracks"
          icon={<Layers size={14} color="var(--accent-cyan)" />}
        >
          {data.other_tracks.map((track, i) => (
            <div
              key={i}
              style={{
                gridColumn: 'span 2',
                padding: '6px 0',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 12px',
                }}
              >
                {Object.entries(track).map(([k, v]) => (
                  <SpecRow key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          ))}
        </SpecSection>
      )}
    </div>
  );
};

const SpecSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
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
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
        {title}
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
      {children}
    </div>
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
