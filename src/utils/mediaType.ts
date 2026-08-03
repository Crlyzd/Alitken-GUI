export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mkv',
  '.webm',
  '.mov',
  '.avi',
  '.flv',
  '.3gp',
  '.m4v',
  '.wmv',
  '.ts',
];

export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.gif',
  '.heic',
];

export type FileKind = 'video' | 'image' | 'unknown';

export function getFileKind(filePath: string): FileKind {
  if (!filePath) return 'unknown';
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return 'unknown';
}

export interface BatchValidationResult {
  isValid: boolean;
  detectedType: FileKind;
  errorMessage?: string;
}

export function validateSingleMediaBatch(
  newPaths: string[],
  existingFiles: { path: string }[]
): BatchValidationResult {
  if (newPaths.length === 0) {
    return { isValid: true, detectedType: 'none' as any };
  }

  let hasVideo = false;
  let hasImage = false;
  let unknownCount = 0;

  for (const path of newPaths) {
    const kind = getFileKind(path);
    if (kind === 'video') hasVideo = true;
    else if (kind === 'image') hasImage = true;
    else unknownCount++;
  }

  // Check 1: Mixed drop batch (both video and image in same drop)
  if (hasVideo && hasImage) {
    return {
      isValid: false,
      detectedType: 'unknown',
      errorMessage:
        'Mixed media selection is not allowed. Please drop either only video files or only image files at one time.',
    };
  }

  const batchType: FileKind = hasVideo ? 'video' : hasImage ? 'image' : 'unknown';

  if (batchType === 'unknown') {
    return {
      isValid: false,
      detectedType: 'unknown',
      errorMessage: 'Unsupported file format detected. Please select supported video or image files.',
    };
  }

  // Check 2: Adding to an existing queue of a different media type
  if (existingFiles.length > 0) {
    const existingKind = getFileKind(existingFiles[0].path);
    if (existingKind !== 'unknown' && existingKind !== batchType) {
      const existingTypeName = existingKind === 'video' ? 'video' : 'image';
      const newTypeName = batchType === 'video' ? 'video' : 'image';
      return {
        isValid: false,
        detectedType: batchType,
        errorMessage: `Cannot add ${newTypeName} files to an active ${existingTypeName} queue. Please clear the queue first.`,
      };
    }
  }

  return {
    isValid: true,
    detectedType: batchType,
  };
}
