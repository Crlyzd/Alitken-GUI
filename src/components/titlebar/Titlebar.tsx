import React from 'react';
import { TitlebarBranding } from './TitlebarBranding';
import { HardwareAccelPill } from './HardwareAccelPill';
import { WindowControls } from './WindowControls';

export interface TitlebarProps {
  hardwareName?: string;
  encoderName?: string;
  hardwareDetails?: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  isMaximizable?: boolean;
  onOpenAbout?: () => void;
  onOpenSettings?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  hardwareName,
  encoderName,
  hardwareDetails,
  hasUpdate,
  latestVersion,
  isMaximizable,
  onOpenAbout,
  onOpenSettings,
}) => {
  return (
    <div
      style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 16px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-titlebar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* Brand & App Name — drag region only, not clickable */}
      <TitlebarBranding />

      {/* Flexible Drag Region Spacer */}
      <div data-tauri-drag-region style={{ flex: 1, minWidth: '40px', height: '100%', cursor: 'default' }} />

      {/* GPU Hardware Status Badge & Control Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 1, minWidth: 0 }}>
        <HardwareAccelPill
          hardwareName={hardwareName}
          encoderName={encoderName}
          hardwareDetails={hardwareDetails}
        />

        <WindowControls
          hasUpdate={hasUpdate}
          latestVersion={latestVersion}
          isMaximizable={isMaximizable}
          onOpenAbout={onOpenAbout}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};
