import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getFileKind } from '../utils/mediaType';

export function useNativeDragDrop(
  activeViewRef: React.MutableRefObject<'main' | 'trimmer'>,
  handleAddFiles: (paths: string[]) => Promise<void>,
  handleOpenTrimmerFromWelcome: (filePath: string) => Promise<void>,
  setValidationError: (err: string | null) => void
) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragTargetZone, setDragTargetZone] = useState<'batch' | 'trimmer' | null>(null);

  const welcomeZoneRef = useRef<'batch' | 'trimmer' | null>(null);

  const handleAddFilesRef = useRef(handleAddFiles);
  useEffect(() => {
    handleAddFilesRef.current = handleAddFiles;
  }, [handleAddFiles]);

  const handleOpenTrimmerFromWelcomeRef = useRef(handleOpenTrimmerFromWelcome);
  useEffect(() => {
    handleOpenTrimmerFromWelcomeRef.current = handleOpenTrimmerFromWelcome;
  }, [handleOpenTrimmerFromWelcome]);

  useEffect(() => {
    let isMounted = true;
    const appWindow = getCurrentWindow();
    const lastDropTimeRef = { current: 0 };
    const lastDropPathsRef = { current: '' };

    const unlistenPromise = appWindow.onDragDropEvent((event: any) => {
      if (!isMounted) return;
      if (event.payload.type === 'drop') {
        setIsDragOver(false);
        setDragTargetZone(null);
        const paths: string[] = event.payload.paths || [];
        if (paths.length > 0) {
          const now = Date.now();
          const fingerprint = paths.map((p) => p.replace(/\\/g, '/').toLowerCase()).join('|');
          if (now - lastDropTimeRef.current < 300 && lastDropPathsRef.current === fingerprint) {
            return;
          }
          lastDropTimeRef.current = now;
          lastDropPathsRef.current = fingerprint;

          const processTrimmerDrop = (pathsToProcess: string[]) => {
            const videoCount = pathsToProcess.filter((p) => getFileKind(p) === 'video').length;
            const totalCount = pathsToProcess.length;

            if (totalCount === 1 && videoCount === 1) {
              setValidationError(null);
              handleOpenTrimmerFromWelcomeRef.current(pathsToProcess[0]);
            } else if (totalCount > 1 && videoCount === totalCount) {
              setValidationError(
                'Video Trimmer only supports a single video file at a time. Please drop one video file.'
              );
            } else {
              setValidationError(
                'Video Trimmer only supports a single video file. Non-video or mixed file drops are not supported in Trimmer mode.'
              );
            }
          };

          if (activeViewRef.current === 'trimmer' || welcomeZoneRef.current === 'trimmer') {
            processTrimmerDrop(paths);
          } else {
            handleAddFilesRef.current(paths);
          }
        }
        welcomeZoneRef.current = null;
      } else if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragOver(true);
        const pos = event.payload.position;
        if (pos && typeof pos.y === 'number') {
          const windowHeight = window.innerHeight || 440;
          if (pos.y > windowHeight * 0.72) {
            setDragTargetZone('trimmer');
            welcomeZoneRef.current = 'trimmer';
          } else {
            setDragTargetZone('batch');
            welcomeZoneRef.current = 'batch';
          }
        } else {
          setDragTargetZone('batch');
          welcomeZoneRef.current = 'batch';
        }
      } else if (event.payload.type === 'leave' || event.payload.type === 'cancel') {
        setIsDragOver(false);
        setDragTargetZone(null);
        welcomeZoneRef.current = null;
      }
    });

    return () => {
      isMounted = false;
      unlistenPromise
        .then((unlisten) => {
          if (typeof unlisten === 'function') unlisten();
        })
        .catch((err) => console.error('Failed to cleanup drag-drop listener:', err));
    };
  }, [activeViewRef, setValidationError]);

  return {
    isDragOver,
    dragTargetZone,
    welcomeZoneRef,
  };
}
