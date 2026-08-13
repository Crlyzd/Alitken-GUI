import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { UpdateInfo, UpdateProgressPayload } from '../components/AboutModal';

export function useAppUpdates(
  setIsAboutOpen: (open: boolean) => void,
  handleDownloadDependencies: (mode: 'app', downloadUrl?: string) => Promise<void>
) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressPayload | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    // Register update progress listener
    const unlistenUpdateProgress = listen('update-progress', (event: any) => {
      setUpdateProgress(event.payload as UpdateProgressPayload);
    });

    // Automatic background update check on app launch
    invoke<UpdateInfo>('check_app_update')
      .then((info) => setUpdateInfo(info))
      .catch((err) => console.error('Initial background update check failed:', err));

    return () => {
      unlistenUpdateProgress.then((fn) => fn());
    };
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      const info = await invoke<UpdateInfo>('check_app_update');
      setUpdateInfo(info);
    } catch (err: any) {
      console.error('Update check failed:', err);
      setUpdateError(typeof err === 'string' ? err : 'Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const handleInstallUpdate = useCallback(
    async (downloadUrl: string) => {
      if (!downloadUrl) return;
      setIsAboutOpen(false);
      handleDownloadDependencies('app', downloadUrl);
    },
    [setIsAboutOpen, handleDownloadDependencies]
  );

  return {
    updateInfo,
    isCheckingUpdate,
    updateProgress,
    updateError,
    handleCheckUpdate,
    handleInstallUpdate,
  };
}
