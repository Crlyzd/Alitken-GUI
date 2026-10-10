import React from 'react';
import { X, Heart, Coffee, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { APP_VERSION_TITLE } from '../../../utils/version';
import { AboutLinksGrid } from './AboutLinksGrid';

export interface AboutBrandingSectionProps {
  onClose: () => void;
}

export const AboutBrandingSection: React.FC<AboutBrandingSectionProps> = ({ onClose }) => {
  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* Top Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/app-icon.ico"
            alt="ALITKEN Logo"
            style={{
              width: '32px',
              height: '32px',
              objectFit: 'contain',
              borderRadius: '8px',
              filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))',
            }}
          />
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '17px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                color: 'var(--text-main)',
                lineHeight: '1.2',
              }}
            >
              ALITKEN
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {APP_VERSION_TITLE} &middot; Universal Video, Image & PDF Suite
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close"
          className="no-drag"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f43f5e';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border-glass)' }} />

      {/* Creator & Coffee Section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          textAlign: 'center',
          background: 'var(--bg-glass-card)',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-glass)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            color: 'var(--text-main)',
          }}
        >
          <span>Made with</span>
          <Heart size={13} color="#f43f5e" fill="#f43f5e" />
          <span>
            by{' '}
            <strong
              onClick={() => handleOpenLink('http://kaleksananbagus.com/')}
              title="Visit http://kaleksananbagus.com/"
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-primary)';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'inherit';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Kaleksanan Bagus
            </strong>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Coffee size={13} color="#f59e0b" />
            <span>Buy me a coffee:</span>
          </div>
          <button
            onClick={() => handleOpenLink('https://saweria.co/curlyzed')}
            style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--accent-primary)',
              borderRadius: '5px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-primary)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
          >
            Saweria <ExternalLink size={10} />
          </button>
          <span style={{ color: 'var(--border-glass)' }}>/</span>
          <button
            onClick={() => handleOpenLink('https://paypal.me/BagusMassani')}
            style={{
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: 'var(--accent-cyan)',
              borderRadius: '5px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-cyan)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(6, 182, 212, 0.12)';
              e.currentTarget.style.color = 'var(--accent-cyan)';
            }}
          >
            PayPal <ExternalLink size={10} />
          </button>
        </div>
      </div>

      {/* Action & Resource Grid (2x2) */}
      <AboutLinksGrid onOpenLink={handleOpenLink} />
    </>
  );
};
