import React from 'react';
import { RefreshCw, Scissors, Link2, Image } from 'lucide-react';
import { ConfigState } from '../ConfigPanel';

interface VideoActionRailProps {
  videoAction: ConfigState['videoAction'];
  onChange: (updated: Partial<ConfigState>) => void;
  isTrimmerMode?: boolean;
  fileCount: number;
}

export const VideoActionRail: React.FC<VideoActionRailProps> = ({
  videoAction,
  onChange,
  isTrimmerMode = false,
  fileCount,
}) => {
  return (
    <div
      style={{
        width: '42px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '6px 4px',
        borderRadius: '12px',
        background: 'var(--input-bg)',
        border: '1px solid var(--border-glass)',
        alignItems: 'center',
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      {/* Button 1: Transcode Video */}
      <button
        type="button"
        onClick={() => onChange({ videoAction: 'CONVERT' })}
        title="Transcode Video (Convert format, resolution & bitrate)"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          border: 'none',
          background:
            videoAction === 'CONVERT' || isTrimmerMode
              ? 'var(--accent-primary)'
              : 'transparent',
          color:
            videoAction === 'CONVERT' || isTrimmerMode
              ? '#ffffff'
              : 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow:
            videoAction === 'CONVERT' || isTrimmerMode
              ? '0 2px 10px rgba(99, 102, 241, 0.4)'
              : 'none',
        }}
      >
        <RefreshCw size={16} />
      </button>

      {/* Button 2: Split Video */}
      <button
        type="button"
        onClick={() => !isTrimmerMode && onChange({ videoAction: 'SPLIT' })}
        disabled={isTrimmerMode}
        title={
          isTrimmerMode
            ? 'Split Video is disabled in single clip trimmer'
            : 'Split Video into segments'
        }
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          border: 'none',
          background:
            !isTrimmerMode && videoAction === 'SPLIT'
              ? 'var(--accent-primary)'
              : 'transparent',
          color:
            !isTrimmerMode && videoAction === 'SPLIT'
              ? '#ffffff'
              : 'var(--text-muted)',
          opacity: isTrimmerMode ? 0.35 : 1,
          cursor: isTrimmerMode ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow:
            !isTrimmerMode && videoAction === 'SPLIT'
              ? '0 2px 10px rgba(99, 102, 241, 0.4)'
              : 'none',
        }}
      >
        <Scissors size={16} />
      </button>

      {/* Button 3: Combine Queue */}
      <button
        type="button"
        onClick={() => !isTrimmerMode && fileCount >= 2 && onChange({ videoAction: 'COMBINE' })}
        disabled={isTrimmerMode || fileCount < 2}
        title={
          isTrimmerMode
            ? 'Combine is disabled in single clip trimmer'
            : fileCount < 2
            ? 'Add at least 2 videos to combine'
            : 'Combine Queue Videos into One File'
        }
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          border: 'none',
          background:
            !isTrimmerMode && videoAction === 'COMBINE'
              ? 'var(--accent-primary)'
              : 'transparent',
          color:
            !isTrimmerMode && videoAction === 'COMBINE'
              ? '#ffffff'
              : 'var(--text-muted)',
          opacity: isTrimmerMode || fileCount < 2 ? 0.35 : 1,
          cursor: isTrimmerMode || fileCount < 2 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow:
            !isTrimmerMode && videoAction === 'COMBINE'
              ? '0 2px 10px rgba(99, 102, 241, 0.4)'
              : 'none',
        }}
      >
        <Link2 size={16} />
      </button>

      {/* Button 4: Extract Frames */}
      <button
        type="button"
        onClick={() =>
          !isTrimmerMode && fileCount > 0 && onChange({ videoAction: 'EXTRACT_FRAMES' })
        }
        disabled={isTrimmerMode || fileCount === 0}
        title={
          isTrimmerMode
            ? 'Extract Frames is disabled in single clip trimmer'
            : fileCount === 0
            ? 'Add a video to extract frames'
            : 'Extract Video Frames to Images'
        }
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          border: 'none',
          background:
            !isTrimmerMode && videoAction === 'EXTRACT_FRAMES'
              ? 'var(--accent-primary)'
              : 'transparent',
          color:
            !isTrimmerMode && videoAction === 'EXTRACT_FRAMES'
              ? '#ffffff'
              : 'var(--text-muted)',
          opacity: isTrimmerMode || fileCount === 0 ? 0.35 : 1,
          cursor: isTrimmerMode || fileCount === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow:
            !isTrimmerMode && videoAction === 'EXTRACT_FRAMES'
              ? '0 2px 10px rgba(99, 102, 241, 0.4)'
              : 'none',
        }}
      >
        <Image size={16} />
      </button>
    </div>
  );
};
