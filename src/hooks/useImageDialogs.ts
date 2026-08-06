import { open } from '@tauri-apps/plugin-dialog';
import { ImageConfig } from '../types/media';

interface UseImageDialogsOptions {
  config: ImageConfig;
  onChange: (newConfig: ImageConfig) => void;
  onBrowseOutputFolder?: () => void;
  onBrowseAudio?: () => void;
}

export function useImageDialogs({
  config,
  onChange,
  onBrowseOutputFolder,
  onBrowseAudio,
}: UseImageDialogsOptions) {
  const handleBrowseOutputFolder = async () => {
    if (onBrowseOutputFolder) {
      onBrowseOutputFolder();
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        onChange({ ...config, outputDir: selected });
      }
    } catch (err) {
      console.error('Directory picker error:', err);
    }
  };

  const handleBrowseAudio = async () => {
    if (onBrowseAudio) {
      onBrowseAudio();
      return;
    }
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] }],
      });
      if (selected && typeof selected === 'string') {
        onChange({ ...config, audioPath: selected });
      }
    } catch (err) {
      console.error('Audio file picker error:', err);
    }
  };

  return {
    handleBrowseOutputFolder,
    handleBrowseAudio,
  };
}
