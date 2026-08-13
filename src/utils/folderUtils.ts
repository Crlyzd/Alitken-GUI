import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../components/Dropzone';

export async function openDestinationFolder(
  outputDir: string | null,
  files: FileItem[]
): Promise<void> {
  let targetDir = outputDir;
  if (!targetDir && files.length > 0) {
    const firstPath = files[0].path;
    const lastSlash = Math.max(firstPath.lastIndexOf('/'), firstPath.lastIndexOf('\\'));
    if (lastSlash !== -1) {
      targetDir = firstPath.substring(0, lastSlash);
    }
  }
  if (targetDir) {
    try {
      await invoke('open_folder', { folderPath: targetDir });
    } catch (err) {
      console.error('Failed to open destination folder:', err);
    }
  }
}

export async function showFileInFolder(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    await invoke('show_in_folder', { filePath });
  } catch (err) {
    console.error('Failed to show file in folder:', err);
  }
}

export async function openFileWithDefaultApp(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    await invoke('open_file', { filePath });
  } catch (err) {
    console.error('Failed to open file with default app:', err);
  }
}

