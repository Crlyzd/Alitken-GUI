import React from 'react';
import { Scissors, RefreshCw, Zap } from 'lucide-react';

export interface ConfigState {
  videoAction: 'CONVERT' | 'SPLIT';
  splitMode: 'DURATION' | 'PARTS';
  splitValue: number;
  splitFastCopy: boolean;
  targetHeight: string;
  targetBitrate: string;
  codecChoice: string; // "1"=H264, "2"=HEVC, "3"=AV1
}

interface ConfigPanelProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  onStart: () => void;
  disabled: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onChange,
  onStart,
  disabled,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '16px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: '100%',
      }}
    >
      {/* Mode Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <button
          onClick={() => onChange({ videoAction: 'CONVERT' })}
          style={{
            padding: '10px',
            borderRadius: '9px',
            border: 'none',
            background: config.videoAction === 'CONVERT' ? 'var(--accent-primary)' : 'transparent',
            color: config.videoAction === 'CONVERT' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: config.videoAction === 'CONVERT' ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={14} /> Transcode
        </button>
        <button
          onClick={() => onChange({ videoAction: 'SPLIT' })}
          style={{
            padding: '10px',
            borderRadius: '9px',
            border: 'none',
            background: config.videoAction === 'SPLIT' ? 'var(--accent-primary)' : 'transparent',
            color: config.videoAction === 'SPLIT' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: config.videoAction === 'SPLIT' ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Scissors size={14} /> Split Video
        </button>
      </div>

      {/* Target Codec Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
          TARGET CODEC
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { id: '1', label: 'H.264', desc: 'Universal' },
            { id: '2', label: 'H.265', desc: 'HEVC High Comp' },
            { id: '3', label: 'AV1', desc: 'Next-Gen Open' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onChange({ codecChoice: item.id })}
              style={{
                padding: '10px 8px',
                borderRadius: '10px',
                border: `1px solid ${config.codecChoice === item.id ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                background: config.codecChoice === item.id ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                color: config.codecChoice === item.id ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: config.codecChoice === item.id ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* SPLIT OPTIONS CONTROLS */}
      {config.videoAction === 'SPLIT' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '14px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Fast Copy Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Fast Stream Copy (-c copy)
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.splitFastCopy}
              onChange={(e) => onChange({ splitFastCopy: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            0% quality loss, 100x rendering speed with zero CPU/GPU encoding overhead.
          </p>

          {/* Split Mode Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={() => onChange({ splitMode: 'DURATION' })}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${config.splitMode === 'DURATION' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
                background: config.splitMode === 'DURATION' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              By Duration (Sec)
            </button>
            <button
              onClick={() => onChange({ splitMode: 'PARTS' })}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${config.splitMode === 'PARTS' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
                background: config.splitMode === 'PARTS' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              By Equal Parts
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {config.splitMode === 'DURATION' ? 'Segment Length (Seconds):' : 'Number of Equal Parts:'}
            </label>
            <input
              type="number"
              value={config.splitValue}
              onChange={(e) => onChange({ splitValue: parseFloat(e.target.value) || 1 })}
              min={1}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
              }}
            />
          </div>
        </div>
      )}

      {/* RESOLUTION & BITRATE CONTROLS (IF NOT FAST COPY) */}
      {(!config.splitFastCopy || config.videoAction === 'CONVERT') && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
              TARGET RESOLUTION
            </label>
            <select
              value={config.targetHeight}
              onChange={(e) => onChange({ targetHeight: e.target.value })}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="ORIGINAL">Original Resolution</option>
              <option value="2160">4K Ultra HD (2160p)</option>
              <option value="1440">2K QHD (1440p)</option>
              <option value="1080">Full HD (1080p)</option>
              <option value="720">HD (720p)</option>
              <option value="480">SD (480p)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
              TARGET BITRATE / QUALITY
            </label>
            <select
              value={config.targetBitrate}
              onChange={(e) => onChange({ targetBitrate: e.target.value })}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="ORIGINAL">Auto / Quality Preserving (CRF 23)</option>
              <option value="12000">12,000 kbps (High Bitrate 4K/2K)</option>
              <option value="8000">8,000 kbps (1080p High)</option>
              <option value="5000">5,000 kbps (1080p Standard)</option>
              <option value="2500">2,500 kbps (720p HD)</option>
              <option value="1200">1,200 kbps (Low Size)</option>
            </select>
          </div>
        </>
      )}

      <div style={{ marginTop: 'auto' }}>
        <button
          onClick={onStart}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: disabled ? 'rgba(255, 255, 255, 0.08)' : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            color: disabled ? 'rgba(255, 255, 255, 0.3)' : '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: disabled ? 'none' : '0 6px 24px rgba(99, 102, 241, 0.45)',
            transition: 'all 0.2s ease',
          }}
        >
          <Zap size={16} /> START {config.videoAction}
        </button>
      </div>
    </div>
  );
};
