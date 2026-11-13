import React from 'react';
import { Sparkles } from 'lucide-react';

export interface ImageStartButtonProps {
  onStart: () => void;
  disabled: boolean;
  isVideo: boolean;
  videoOutputFormat?: 'MP4' | 'WEBP' | 'GIF';
}

export const ImageStartButton: React.FC<ImageStartButtonProps> = ({
  onStart,
  disabled,
  isVideo,
  videoOutputFormat = 'MP4',
}) => {
  const videoLabel =
    videoOutputFormat === 'WEBP'
      ? 'START CONVERT TO WEBP'
      : videoOutputFormat === 'GIF'
      ? 'START CONVERT TO GIF'
      : 'START CONVERT TO VIDEO';

  return (
    <div className="image-config-start-wrapper">
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className={`image-config-start-btn ${disabled ? 'disabled' : 'enabled'}`}
      >
        <Sparkles size={18} />
        {isVideo ? videoLabel : 'START IMAGE CONVERT'}
      </button>
    </div>
  );
};
