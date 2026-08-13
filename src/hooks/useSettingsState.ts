import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { CacheInfo, DependencyStatus, IntegrationStatus } from '../types/media';

export const formatEngineVersion = (versionStr?: string): string => {
  if (!versionStr) return '';
  if (versionStr.includes('-g')) {
    const match = versionStr.match(/^v?(\d+\.\d+(\.\d+)?)/i);
    if (match) return match[1];
  }
  return versionStr;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export interface UseSettingsStateReturn {
  status: IntegrationStatus | null;
  deps: DependencyStatus | null;
  cacheInfo: CacheInfo | null;
  loadingSendTo: boolean;
  loadingDeps: boolean;
  loadingCache: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  fetchStatus: () => Promise<void>;
  handleFetchCacheInfo: () => Promise<void>;
  handleOpenCacheFolder: () => Promise<void>;
  handleClearCache: () => Promise<void>;
  handleChangeCacheFolder: () => Promise<void>;
  handleResetCacheFolder: () => Promise<void>;
  handleToggleSendTo: () => Promise<void>;
  handleInstallAppData: () => Promise<void>;
  handleUninstallDeps: () => Promise<void>;
  handleOpenAppDataFolder: (e?: React.MouseEvent) => Promise<void>;
}

export const useSettingsState = (isOpen: boolean): UseSettingsStateReturn => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loadingSendTo, setLoadingSendTo] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingCache, setLoadingCache] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFetchCacheInfo = useCallback(async () => {
    try {
      const res = await invoke<CacheInfo>('get_temp_cache_info');
      setCacheInfo(res);
    } catch (err) {
      console.error('Failed to fetch cache info:', err);
    }
  }, []);

  const handleOpenCacheFolder = useCallback(async () => {
    if (cacheInfo?.path) {
      try {
        await invoke('open_folder', { folderPath: cacheInfo.path });
      } catch (err) {
        console.error('Failed to open cache folder:', err);
      }
    }
  }, [cacheInfo?.path]);

  const handleClearCache = useCallback(async () => {
    if (loadingCache) return;
    setLoadingCache(true);
    try {
      const res = await invoke<CacheInfo>('clear_temp_cache');
      setCacheInfo(res);
      if (res.preserved_active_files && res.preserved_active_files > 0) {
        setSuccessMsg(`Temporary cache cleared (${res.preserved_active_files} active preview preserved).`);
      } else {
        setSuccessMsg('Temporary cache cleared.');
      }
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to clear cache.');
    } finally {
      setLoadingCache(false);
    }
  }, [loadingCache]);

  const handleChangeCacheFolder = useCallback(async () => {
    if (loadingCache) return;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Custom Temp Cache Directory',
      });
      if (selected && typeof selected === 'string') {
        setLoadingCache(true);
        const res = await invoke<CacheInfo>('set_custom_temp_dir', { path: selected });
        setCacheInfo(res);
        setSuccessMsg('Cache directory updated.');
      }
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to update cache directory.');
    } finally {
      setLoadingCache(false);
    }
  }, [loadingCache]);

  const handleResetCacheFolder = useCallback(async () => {
    if (loadingCache) return;
    setLoadingCache(true);
    try {
      const res = await invoke<CacheInfo>('set_custom_temp_dir', { path: null });
      setCacheInfo(res);
      setSuccessMsg('Cache directory reset to default AppData path.');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to reset cache directory.');
    } finally {
      setLoadingCache(false);
    }
  }, [loadingCache]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await invoke<IntegrationStatus>('get_system_integration_status');
      setStatus(res);
      const depRes = await invoke<DependencyStatus>('check_app_dependencies');
      setDeps(depRes);
      handleFetchCacheInfo();
    } catch (err) {
      console.error('Failed to fetch system integration status:', err);
    }
  }, [handleFetchCacheInfo]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const handleToggleSendTo = useCallback(async () => {
    if (loadingSendTo) return;
    setLoadingSendTo(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetState = !(status?.sendto_active ?? false);

    // Optimistic update
    setStatus((prev) =>
      prev ? { ...prev, sendto_active: targetState } : prev
    );

    try {
      const res = await invoke<boolean>('set_sendto_status', { enable: targetState });
      setStatus((prev) =>
        prev
          ? { ...prev, sendto_active: res }
          : { sendto_active: res, executable_path: '' }
      );
      setSuccessMsg(res ? 'Added to Windows "Send to" menu!' : 'Removed from Windows "Send to" menu.');
    } catch (err: any) {
      setStatus((prev) =>
        prev ? { ...prev, sendto_active: !targetState } : prev
      );
      setErrorMsg(err?.toString() || 'Failed to update SendTo shortcut.');
    } finally {
      setLoadingSendTo(false);
    }
  }, [loadingSendTo, status?.sendto_active]);

  const handleInstallAppData = useCallback(async () => {
    if (loadingDeps) return;
    setLoadingDeps(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await invoke<DependencyStatus>('install_to_appdata');
      setDeps(res);
      setSuccessMsg('Binaries successfully installed to AppData!');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to install binaries to AppData.');
    } finally {
      setLoadingDeps(false);
    }
  }, [loadingDeps]);

  const handleUninstallDeps = useCallback(async () => {
    if (loadingDeps) return;
    setLoadingDeps(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await invoke<DependencyStatus>('uninstall_appdata');
      setDeps(res);
      setSuccessMsg('Binaries uninstalled from AppData.');
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to uninstall binaries.');
    } finally {
      setLoadingDeps(false);
    }
  }, [loadingDeps]);

  const handleOpenAppDataFolder = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await invoke('open_folder', { folderPath: deps?.appdata_path });
    } catch (err) {
      console.error('Failed to open AppData folder:', err);
    }
  }, [deps?.appdata_path]);

  return {
    status,
    deps,
    cacheInfo,
    loadingSendTo,
    loadingDeps,
    loadingCache,
    errorMsg,
    successMsg,
    setErrorMsg,
    setSuccessMsg,
    fetchStatus,
    handleFetchCacheInfo,
    handleOpenCacheFolder,
    handleClearCache,
    handleChangeCacheFolder,
    handleResetCacheFolder,
    handleToggleSendTo,
    handleInstallAppData,
    handleUninstallDeps,
    handleOpenAppDataFolder,
  };
};
