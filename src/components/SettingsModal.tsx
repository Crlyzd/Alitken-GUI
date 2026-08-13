import React, { useEffect } from 'react';
import { useSettingsState } from '../hooks/useSettingsState';
import {
  SettingsHeader,
  SettingsAlertBanners,
  ThemeSection,
  MediaEnginesSection,
  CacheStorageSection,
  WindowsIntegrationSection,
  SettingsFooter,
} from './settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onUpdateEngine?: (engine: 'ffmpeg' | 'magick' | 'all') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onUpdateEngine,
}) => {
  const {
    status,
    deps,
    cacheInfo,
    loadingSendTo,
    loadingDeps,
    loadingCache,
    errorMsg,
    successMsg,
    handleOpenCacheFolder,
    handleClearCache,
    handleChangeCacheFolder,
    handleResetCacheFolder,
    handleToggleSendTo,
    handleInstallAppData,
    handleUninstallDeps,
    handleOpenAppDataFolder,
  } = useSettingsState(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: 'calc(100vh - 28px)',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <SettingsHeader onClose={onClose} />

        {/* Feedback Messages */}
        <SettingsAlertBanners successMsg={successMsg} errorMsg={errorMsg} />

        {/* Section 1: Appearance & Theme Mode */}
        <ThemeSection theme={theme} onToggleTheme={onToggleTheme} />

        {/* Section 2: Media Processing Engines */}
        <MediaEnginesSection
          deps={deps}
          loadingDeps={loadingDeps}
          theme={theme}
          onClose={onClose}
          onUpdateEngine={onUpdateEngine}
          handleInstallAppData={handleInstallAppData}
          handleUninstallDeps={handleUninstallDeps}
          handleOpenAppDataFolder={handleOpenAppDataFolder}
        />

        {/* Section 3: Cache & Storage */}
        <CacheStorageSection
          cacheInfo={cacheInfo}
          loadingCache={loadingCache}
          handleOpenCacheFolder={handleOpenCacheFolder}
          handleClearCache={handleClearCache}
          handleChangeCacheFolder={handleChangeCacheFolder}
          handleResetCacheFolder={handleResetCacheFolder}
        />

        {/* Section 4: Windows Context Menu Integrations */}
        <WindowsIntegrationSection
          status={status}
          loadingSendTo={loadingSendTo}
          theme={theme}
          handleToggleSendTo={handleToggleSendTo}
        />

        {/* Footer Info */}
        <SettingsFooter executablePath={status?.executable_path} />
      </div>
    </div>
  );
};
