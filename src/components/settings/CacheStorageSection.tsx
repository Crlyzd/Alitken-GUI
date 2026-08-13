import React from 'react';
import { HardDrive, Trash2, Folder, RotateCcw, RefreshCw } from 'lucide-react';
import { CacheInfo } from '../../types/media';
import { formatBytes } from '../../hooks/useSettingsState';

interface CacheStorageSectionProps {
  cacheInfo: CacheInfo | null;
  loadingCache: boolean;
  handleOpenCacheFolder: () => Promise<void>;
  handleClearCache: () => Promise<void>;
  handleChangeCacheFolder: () => Promise<void>;
  handleResetCacheFolder: () => Promise<void>;
}

export const CacheStorageSection: React.FC<CacheStorageSectionProps> = ({
  cacheInfo,
  loadingCache,
  handleOpenCacheFolder,
  handleClearCache,
  handleChangeCacheFolder,
  handleResetCacheFolder,
}) => {
  return (
    <div style={{ marginTop: '14px', marginBottom: '14px' }}>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '6px',
        }}
      >
        Cache &amp; Storage
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <button
              type="button"
              onClick={handleOpenCacheFolder}
              disabled={!cacheInfo?.path}
              title="Click to open temp cache folder in Windows Explorer"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: cacheInfo?.path ? 'pointer' : 'default',
                color: 'var(--accent-cyan)',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (cacheInfo?.path) {
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(6, 182, 212, 0.35)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <HardDrive size={14} />
            </button>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                Temp Cache
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>
                {cacheInfo ? formatBytes(cacheInfo.size_bytes) : '...'}
              </div>
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={loadingCache || cacheInfo?.size_bytes === 0}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--btn-danger-bg, rgba(244, 63, 94, 0.15))',
              color: 'var(--btn-danger-text, #fb7185)',
              border: '1px solid var(--btn-danger-border, rgba(244, 63, 94, 0.3))',
              fontSize: '11px',
              fontWeight: 600,
              cursor: loadingCache || cacheInfo?.size_bytes === 0 ? 'not-allowed' : 'pointer',
              opacity: cacheInfo?.size_bytes === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease',
            }}
          >
            {loadingCache ? <RefreshCw size={11} className="spin" /> : <Trash2 size={11} />}
            <span>Clear Cache</span>
          </button>
        </div>

        <div style={{ height: '1px', background: 'var(--border-glass)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              flex: 1,
            }}
          >
            <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              title={cacheInfo?.path || ''}
              style={{
                fontSize: '10.5px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cacheInfo?.path || 'Loading path...'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={handleChangeCacheFolder}
              disabled={loadingCache}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                fontSize: '10.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Change
            </button>
            {cacheInfo?.is_custom && (
              <button
                onClick={handleResetCacheFolder}
                disabled={loadingCache}
                title="Reset cache folder to default AppData directory"
                style={{
                  padding: '3px 6px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
