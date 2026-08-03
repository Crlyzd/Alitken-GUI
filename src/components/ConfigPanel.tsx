import React, { useState } from 'react';
import { Scissors, RefreshCw, Zap, Folder, FolderOpen, RotateCcw } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export interface ConfigState {
  videoAction: 'CONVERT' | 'SPLIT';
  splitMode: 'DURATION' | 'PARTS';
  splitValue: number | '';
  splitFastCopy: boolean;
  targetHeight: string;
  targetBitrate: string;
  codecChoice: string; // "1"=H264, "2"=HEVC, "3"=AV1
  outputDir: string | null;
}

interface ConfigPanelProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  onStart: () => void;
  disabled: boolean;
}

const PRESET_HEIGHTS = ['ORIGINAL', '2160', '1440', '1080', '720', '480'];
const PRESET_BITRATES = ['ORIGINAL', '12000', '8000', '5000', '2500', '1200'];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onChange,
  onStart,
  disabled,
}) => {
  const [isCustomHeight, setIsCustomHeight] = useState<boolean>(
    !PRESET_HEIGHTS.includes(config.targetHeight)
  );
  const [isCustomBitrate, setIsCustomBitrate] = useState<boolean>(
    !PRESET_BITRATES.includes(config.targetBitrate)
  );

  const isFastCopyActive = config.videoAction === 'SPLIT' && config.splitFastCopy;

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.outputDir || undefined,
      });
      if (selected && typeof selected === 'string') {
        onChange({ outputDir: selected });
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const handleOpenFolder = async () => {
    if (config.outputDir) {
      try {
        await invoke('open_folder', { folderPath: config.outputDir });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '16px',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          minHeight: 0,
        }}
      >
        {/* Mode Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--input-bg)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
            TARGET CODEC
          </label>
          {isFastCopyActive && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              Original Codec Preserved
            </span>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            opacity: isFastCopyActive ? 0.45 : 1,
            pointerEvents: isFastCopyActive ? 'none' : 'auto',
            filter: isFastCopyActive ? 'grayscale(0.5)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {[
            { id: '1', label: 'H.264', desc: 'Universal' },
            { id: '2', label: 'H.265', desc: 'HEVC High Comp' },
            { id: '3', label: 'AV1', desc: 'Next-Gen Open' },
          ].map((item) => (
            <button
              key={item.id}
              disabled={isFastCopyActive}
              onClick={() => onChange({ codecChoice: item.id })}
              style={{
                padding: '10px 8px',
                borderRadius: '10px',
                border: `1px solid ${config.codecChoice === item.id ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                background: config.codecChoice === item.id ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-glass-card)',
                color: config.codecChoice === item.id ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: isFastCopyActive ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                boxShadow: config.codecChoice === item.id && !isFastCopyActive ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{item.desc}</div>
            </button>
          ))}
        </div>
        {isFastCopyActive && (
          <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: 0 }}>
            🔒 Stream copying passes raw packets directly without re-encoding.
          </p>
        )}
      </div>

      {/* SPLIT OPTIONS CONTROLS */}
      {config.videoAction === 'SPLIT' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '14px',
            background: 'var(--bg-glass-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
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
              onClick={() =>
                onChange({
                  splitMode: 'DURATION',
                  splitValue: config.splitValue === '' ? 60 : config.splitValue,
                })
              }
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${config.splitMode === 'DURATION' ? 'var(--accent-cyan)' : 'var(--border-glass)'}`,
                background: config.splitMode === 'DURATION' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              By Duration (Sec)
            </button>
            <button
              onClick={() =>
                onChange({
                  splitMode: 'PARTS',
                  splitValue: typeof config.splitValue === 'number' && config.splitValue === 60 ? '' : config.splitValue,
                })
              }
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${config.splitMode === 'PARTS' ? 'var(--accent-cyan)' : 'var(--border-glass)'}`,
                background: config.splitMode === 'PARTS' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: 'var(--text-main)',
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
              value={config.splitMode === 'PARTS' && config.splitValue === 60 ? '' : config.splitValue}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ splitValue: val === '' ? '' : parseFloat(val) });
              }}
              placeholder={config.splitMode === 'DURATION' ? 'e.g. 60' : 'e.g. 4'}
              min={1}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--text-main)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>
      )}

      {/* RESOLUTION & BITRATE CONTROLS (IF NOT FAST COPY) */}
      {(!config.splitFastCopy || config.videoAction === 'CONVERT') && (
        <>
          {/* Target Resolution */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
              TARGET RESOLUTION
            </label>
            <select
              value={isCustomHeight ? 'CUSTOM' : config.targetHeight}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setIsCustomHeight(true);
                  const currentCustom = PRESET_HEIGHTS.includes(config.targetHeight) ? '1080' : config.targetHeight;
                  onChange({ targetHeight: currentCustom });
                } else {
                  setIsCustomHeight(false);
                  onChange({ targetHeight: val });
                }
              }}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'var(--text-main)',
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
              <option value="CUSTOM">Custom Resolution (Height)...</option>
            </select>
            {isCustomHeight && (
              <input
                type="number"
                value={config.targetHeight}
                onChange={(e) => onChange({ targetHeight: e.target.value })}
                placeholder="Enter custom height in px (e.g. 1080)"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              />
            )}
          </div>

          {/* Target Bitrate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
              TARGET BITRATE / QUALITY
            </label>
            <select
              value={isCustomBitrate ? 'CUSTOM' : config.targetBitrate}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setIsCustomBitrate(true);
                  const currentCustom = PRESET_BITRATES.includes(config.targetBitrate) ? '6000' : config.targetBitrate;
                  onChange({ targetBitrate: currentCustom });
                } else {
                  setIsCustomBitrate(false);
                  onChange({ targetBitrate: val });
                }
              }}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'var(--text-main)',
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
              <option value="CUSTOM">Custom Bitrate (kbps)...</option>
            </select>
            {isCustomBitrate && (
              <input
                type="number"
                value={config.targetBitrate}
                onChange={(e) => onChange({ targetBitrate: e.target.value })}
                placeholder="Enter custom bitrate in kbps (e.g. 6000)"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              />
            )}
          </div>
        </>
      )}

      {/* OUTPUT FOLDER SELECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
            OUTPUT FOLDER
          </label>
          {config.outputDir && (
            <button
              onClick={() => onChange({ outputDir: null })}
              title="Reset to source directory"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              color: config.outputDir ? 'var(--text-main)' : 'var(--text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            title={config.outputDir || 'Output files will be saved in the same directory as source files'}
          >
            <Folder size={14} color={config.outputDir ? 'var(--accent-cyan)' : 'var(--text-dim)'} />
            <span>{config.outputDir || 'Same as Source File Directory'}</span>
          </div>

          <button
            onClick={handleBrowseFolder}
            title="Browse Destination Folder"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen size={14} /> Browse
          </button>

          {config.outputDir && (
            <button
              onClick={handleOpenFolder}
              title="Open Selected Folder in Explorer"
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
              }}
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <button
          onClick={onStart}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: disabled ? 'var(--input-bg)' : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            color: disabled ? 'var(--text-dim)' : '#fff',
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
  </div>
);
};
