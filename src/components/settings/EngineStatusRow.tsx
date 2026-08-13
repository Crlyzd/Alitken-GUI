import React from 'react';
import { Download } from 'lucide-react';
import { formatEngineVersion } from '../../hooks/useSettingsState';

interface EngineStatusRowProps {
  engineName: string;
  icon: React.ReactNode;
  version?: string;
  exists?: boolean;
  valid?: boolean;
  hasUpdate?: boolean;
  latestVersion?: string;
  minVersionLabel: string;
  defaultLatestVersion: string;
  theme: 'dark' | 'light';
  onBadgeClick: () => void;
}

export const EngineStatusRow: React.FC<EngineStatusRowProps> = ({
  engineName,
  icon,
  version,
  exists,
  valid,
  hasUpdate,
  latestVersion,
  minVersionLabel,
  defaultLatestVersion,
  theme,
  onBadgeClick,
}) => {
  const isActionable = !exists || !valid || hasUpdate;

  const tooltipTitle = !exists
    ? `Click to download and install ${engineName} binary`
    : hasUpdate
    ? `Click to download & install ${engineName} v${formatEngineVersion(latestVersion || defaultLatestVersion)} update`
    : valid
    ? `${engineName} is valid and up to date`
    : `Click to download valid ${engineName} binary`;

  const badgeText = !exists
    ? 'Not Installed'
    : !valid
    ? `Outdated (< ${minVersionLabel})`
    : hasUpdate
    ? `Update → v${formatEngineVersion(latestVersion || defaultLatestVersion)}`
    : `Valid (≥ ${minVersionLabel})`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', minWidth: 0 }}>
      <span
        style={{
          fontWeight: 600,
          color: 'var(--text-main)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flexShrink: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
        title={version ? `${engineName} v${version}` : undefined}
      >
        {icon}
        <span>{engineName}:</span>{' '}
        {version
          ? `v${formatEngineVersion(version)}`
          : exists
          ? 'Installed'
          : 'Not Installed'}
      </span>

      {/* Right Aligned Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
        <span
          onClick={isActionable ? onBadgeClick : undefined}
          title={tooltipTitle}
          style={{
            fontSize: '9px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: isActionable ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'all 0.2s ease',
            background: valid
              ? (hasUpdate
                ? 'var(--warning-bg)'
                : (theme === 'light' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)'))
              : (theme === 'light' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.15)'),
            color: valid
              ? (hasUpdate
                ? 'var(--warning-text)'
                : (theme === 'light' ? '#047857' : '#34d399'))
              : (theme === 'light' ? '#e11d48' : '#fb7185'),
            border: `1px solid ${
              valid
                ? (hasUpdate
                  ? 'var(--warning-border)'
                  : (theme === 'light' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)'))
                : (theme === 'light' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.3)')
            }`,
          }}
        >
          <span
            className="status-dot-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: valid
                ? (hasUpdate ? (theme === 'light' ? '#b45309' : '#fbbf24') : '#10b981')
                : '#f43f5e',
              boxShadow: valid
                ? (hasUpdate
                  ? (theme === 'light' ? '0 0 6px rgba(180, 83, 9, 0.7)' : '0 0 6px rgba(251, 191, 36, 0.9)')
                  : '0 0 6px rgba(16, 185, 129, 0.8)')
                : '0 0 6px rgba(244, 63, 94, 0.8)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span>{badgeText}</span>
          {isActionable && (
            <Download size={9} style={{ marginLeft: '1px' }} />
          )}
        </span>
      </div>
    </div>
  );
};
