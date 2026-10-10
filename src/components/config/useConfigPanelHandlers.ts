import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ConfigState } from '../../types/config';
import {
  getLastExportFolder,
  setLastExportFolder,
  getLastImportFolder,
  updateImportFolderFromFilePath,
} from '../../utils/folderHistory';

interface UseConfigPanelHandlersProps {
  config: ConfigState;
  onChange: (updated: Partial<ConfigState>) => void;
  onOpenDestination?: () => void;
}

export function useConfigPanelHandlers({
  config,
  onChange,
  onOpenDestination,
}: UseConfigPanelHandlersProps) {
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.outputDir || getLastExportFolder() || undefined,
      });
      if (selected && typeof selected === 'string') {
        setLastExportFolder(selected);
        onChange({ outputDir: selected });
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const handleBrowseAudio = async () => {
    try {
      const selected = await open({
        multiple: false,
        defaultPath: config.audioPath || getLastImportFolder() || undefined,
        filters: [
          {
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma'],
          },
        ],
      });
      if (selected && typeof selected === 'string') {
        updateImportFolderFromFilePath(selected);
        onChange({ audioPath: selected });
      }
    } catch (err) {
      console.error('Failed to open audio file dialog:', err);
    }
  };

  const handleClearAudio = () => {
    onChange({ audioPath: null, audioFadeIn: false, audioFadeOut: false });
  };

  const handleOpenFolder = async () => {
    if (onOpenDestination) {
      onOpenDestination();
    } else if (config.outputDir) {
      try {
        await invoke('open_folder', { folderPath: config.outputDir });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  return {
    handleBrowseFolder,
    handleBrowseAudio,
    handleClearAudio,
    handleOpenFolder,
  };
}
