import React, { useEffect } from 'react';
import { AboutBrandingSection } from './AboutBrandingSection';
import { UpdateCheckerSection } from './UpdateCheckerSection';
import { HardwareInfoSection } from './HardwareInfoSection';
import { UpdateInfo, UpdateProgressPayload } from '../../../types/update';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  hardwareInfo?: {
    name: string;
    encoder: string;
    details?: string;
  };
  updateInfo: UpdateInfo | null;
  onCheckUpdate: () => Promise<void>;
  onInstallUpdate: (downloadUrl: string) => Promise<void>;
  isCheckingUpdate: boolean;
  updateProgress: UpdateProgressPayload | null;
  updateError: string | null;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  hardwareInfo,
  updateInfo,
  onCheckUpdate,
  onInstallUpdate,
  isCheckingUpdate,
  updateProgress,
  updateError,
}) => {
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
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        <AboutBrandingSection onClose={onClose} />

        <UpdateCheckerSection
          updateInfo={updateInfo}
          onCheckUpdate={onCheckUpdate}
          onInstallUpdate={onInstallUpdate}
          isCheckingUpdate={isCheckingUpdate}
          updateProgress={updateProgress}
          updateError={updateError}
        />

        <HardwareInfoSection hardwareInfo={hardwareInfo} />
      </div>
    </div>
  );
};
