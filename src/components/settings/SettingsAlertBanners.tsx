import React from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

interface SettingsAlertBannersProps {
  successMsg: string | null;
  errorMsg: string | null;
}

export const SettingsAlertBanners: React.FC<SettingsAlertBannersProps> = ({
  successMsg,
  errorMsg,
}) => {
  return (
    <>
      {successMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--accent-emerald)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ShieldAlert size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
    </>
  );
};
