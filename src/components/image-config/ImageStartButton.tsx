import React from 'react';
import { Sparkles } from 'lucide-react';

export interface ImageStartButtonProps {
  onStart: () => void;
  disabled: boolean;
  isVideo: boolean;
  isGif?: boolean;
}

export const ImageStartButton: React.FC<ImageStartButtonProps> = ({
  onStart,
  disabled,
  isVideo,
  isGif = false,
}) => {
  return (
    <div className="image-config-start-wrapper">
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className={`image-config-start-btn ${disabled ? 'disabled' : 'enabled'}`}
      >
        <Sparkles size={18} />
        {isVideo ? (isGif ? 'START CONVERT TO GIF' : 'START CONVERT TO VIDEO') : 'START IMAGE CONVERT'}
      </button>
    </div>
  );
};
