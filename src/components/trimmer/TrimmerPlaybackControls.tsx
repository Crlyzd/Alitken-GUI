import React from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Volume2,
  VolumeX,
  Gauge,
  Zap,
  ChevronsRight,
  ChevronsLeft,
  Check,
} from 'lucide-react';
import { GlassSelect, GlassSelectOption } from '../GlassSelect';
import { slowMoOptions, controlButtonStyle } from '../../utils/trimmerUtils';

interface TrimmerPlaybackControlsProps {
  isEditingCustomSpeed: boolean;
  customSpeedInput: string;
  setCustomSpeedInput: (val: string) => void;
  onCustomSpeedSubmit: () => void;
  dynamicSpeedOptions: GlassSelectOption[];
  speedSelectVal: string;
  onSpeedSelectChange: (val: string) => void;
  onSetIn: () => void;
  onTogglePlayPause: () => void;
  isNativeSupported: boolean;
  isPlaying: boolean;
  onSetOut: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  playbackSpeed: number;
  slowMoMode: 'FRAME_DUP' | 'OPTICAL_SMOOTH';
  onSlowMoModeChange: (mode: 'FRAME_DUP' | 'OPTICAL_SMOOTH') => void;
}

export const TrimmerPlaybackControls: React.FC<TrimmerPlaybackControlsProps> = ({
  isEditingCustomSpeed,
  customSpeedInput,
  setCustomSpeedInput,
  onCustomSpeedSubmit,
  dynamicSpeedOptions,
  speedSelectVal,
  onSpeedSelectChange,
  onSetIn,
  onTogglePlayPause,
  isNativeSupported,
  isPlaying,
  onSetOut,
  isMuted,
  onToggleMute,
  playbackSpeed,
  slowMoMode,
  onSlowMoModeChange,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        width: '100%',
        padding: '6px 0',
        gap: '12px',
      }}
    >
      {/* LEFT COLUMN: Speed Glass Dropdown / In-Place Custom Speed Input */}
      <div
        style={{
          justifySelf: 'end',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {isEditingCustomSpeed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              value={customSpeedInput}
              onChange={(e) => setCustomSpeedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCustomSpeedSubmit()}
              placeholder="1.0"
              autoFocus
              style={{
                width: '48px',
                padding: '4px 6px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-cyan)',
                color: 'var(--accent-cyan)',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={onCustomSpeedSubmit}
              title="Set Speed"
              style={{
                padding: '5px 7px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid var(--accent-cyan)',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              borderRadius: '8px',
              background: 'var(--input-bg, rgba(255, 255, 255, 0.08))',
              border: '1px solid var(--border-glass)',
              minWidth: '78px',
            }}
          >
            <Gauge size={13} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <GlassSelect
              options={dynamicSpeedOptions}
              value={speedSelectVal}
              onChange={onSpeedSelectChange}
              placement="top"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* CENTER COLUMN: Central Core Playback Cluster [ Set In ] ( Play ) [ Set Out ] */}
      <div
        style={{
          justifySelf: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Set In Button */}
        <button
          type="button"
          onClick={onSetIn}
          title="Set In-Point at Playhead (Hotkey: [ )"
          style={{
            ...controlButtonStyle,
            background: 'rgba(6, 182, 212, 0.15)',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            color: 'var(--accent-cyan)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(6, 182, 212, 0.2)',
          }}
        >
          <ChevronsRight size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>Set In [</span>
        </button>

        {/* Main Play/Pause Button */}
        <button
          type="button"
          onClick={onTogglePlayPause}
          disabled={!isNativeSupported}
          title={isNativeSupported ? 'Play/Pause (Space)' : 'Direct playback unavailable for this raw codec'}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: isNativeSupported
              ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)'
              : 'var(--input-bg)',
            border: isNativeSupported ? 'none' : '1px solid var(--border-glass)',
            color: isNativeSupported ? '#ffffff' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isNativeSupported ? 'pointer' : 'not-allowed',
            boxShadow: isNativeSupported ? '0 4px 18px rgba(99, 102, 241, 0.45)' : 'none',
            opacity: isNativeSupported ? 1 : 0.6,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            flexShrink: 0,
          }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
        </button>

        {/* Set Out Button */}
        <button
          type="button"
          onClick={onSetOut}
          title="Set Out-Point at Playhead (Hotkey: ] )"
          style={{
            ...controlButtonStyle,
            background: 'rgba(99, 102, 241, 0.15)',
            borderColor: 'rgba(99, 102, 241, 0.4)',
            color: '#818cf8',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
          }}
        >
          <span>Set Out ]</span>
          <ChevronsLeft size={14} style={{ color: '#818cf8' }} />
        </button>
      </div>

      {/* RIGHT COLUMN: Audio Toggle & Right-Aligned Slow-Mo Engine */}
      <div
        style={{
          justifySelf: 'start',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={onToggleMute}
          title={
            isMuted
              ? 'Audio Muted in Preview & Export (Click to Unmute)'
              : 'Audio Included in Preview & Export (Click to Mute)'
          }
          style={{
            ...controlButtonStyle,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isMuted ? 'rgba(239, 68, 68, 0.18)' : 'var(--input-bg, rgba(255, 255, 255, 0.08))',
            borderColor: isMuted ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-glass)',
            color: isMuted ? '#f87171' : 'var(--text-main)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {isMuted ? 'Muted' : 'Audio'}
        </button>

        {/* Slow-Mo Engine Dropdown (Appears on the right ONLY when speed < 1.0) */}
        {playbackSpeed < 1.0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 5px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
            }}
          >
            {slowMoMode === 'OPTICAL_SMOOTH' ? (
              <Sparkles size={13} style={{ color: '#a855f7', flexShrink: 0 }} />
            ) : (
              <Zap size={13} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            )}
            <GlassSelect
              options={slowMoOptions}
              value={slowMoMode}
              onChange={(val) => onSlowMoModeChange(val as 'FRAME_DUP' | 'OPTICAL_SMOOTH')}
              placement="top"
              style={{ width: 'auto', minWidth: '80px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
