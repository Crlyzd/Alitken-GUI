const STORAGE_KEY_IMPORT = 'alitken_last_import_folder';
const STORAGE_KEY_EXPORT = 'alitken_last_export_folder';

export function extractDirectoryPath(filePath: string): string | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return null;
  const dir = normalized.substring(0, lastSlash);
  return dir || null;
}

export function getLastImportFolder(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_IMPORT) || null;
  } catch {
    return null;
  }
}

export function setLastImportFolder(path: string | null): void {
  try {
    if (path) {
      localStorage.setItem(STORAGE_KEY_IMPORT, path);
    } else {
      localStorage.removeItem(STORAGE_KEY_IMPORT);
    }
  } catch (err) {
    console.error('Failed to set last import folder:', err);
  }
}

export function updateImportFolderFromFilePath(filePath: string): void {
  const dir = extractDirectoryPath(filePath);
  if (dir) {
    setLastImportFolder(dir);
  }
}

export function getLastExportFolder(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_EXPORT) || null;
  } catch {
    return null;
  }
}

export function setLastExportFolder(path: string | null): void {
  try {
    if (path) {
      localStorage.setItem(STORAGE_KEY_EXPORT, path);
    } else {
      localStorage.removeItem(STORAGE_KEY_EXPORT);
    }
  } catch (err) {
    console.error('Failed to set last export folder:', err);
  }
}
