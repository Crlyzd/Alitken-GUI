import { open } from '@tauri-apps/plugin-dialog';
import { ImageConfig } from '../types/media';
import {
  getLastExportFolder,
  setLastExportFolder,
  getLastImportFolder,
  updateImportFolderFromFilePath,
} from '../utils/folderHistory';

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
        defaultPath: config.outputDir || getLastExportFolder() || undefined,
      });
      if (selected && typeof selected === 'string') {
        setLastExportFolder(selected);
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
        defaultPath: getLastImportFolder() || undefined,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] }],
      });
      if (selected && typeof selected === 'string') {
        updateImportFolderFromFilePath(selected);
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
