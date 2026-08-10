import React, { useState, useRef, useEffect } from 'react';
import { Crop, Check, ChevronUp } from 'lucide-react';
import { AspectRatioOption } from '../../types/media';

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatioOption;
  onSelectRatio: (ratio: AspectRatioOption) => void;
}

const RATIO_OPTIONS: { id: AspectRatioOption; label: string; sub: string }[] = [
  { id: 'ORIGINAL', label: 'Original', sub: 'Full Fit' },
  { id: '16:9', label: '16 : 9', sub: 'Widescreen / YT' },
  { id: '9:16', label: '9 : 16', sub: 'Shorts / TikTok' },
  { id: '1:1', label: '1 : 1', sub: 'Square / Feed' },
  { id: '4:5', label: '4 : 5', sub: 'Portrait / Feed' },
  { id: '4:3', label: '4 : 3', sub: 'Standard TV' },
  { id: '21:9', label: '21 : 9', sub: 'Ultrawide' },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedRatio,
  onSelectRatio,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeOption = RATIO_OPTIONS.find((opt) => opt.id === selectedRatio) || RATIO_OPTIONS[0];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            right: 0,
            width: '145px',
            maxHeight: '210px',
            overflowY: 'auto',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '10px',
            boxShadow: 'none',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
          }}
        >
          <div
            style={{
              padding: '4px 6px 2px 6px',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-dim, rgba(255, 255, 255, 0.5))',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Aspect Ratio
          </div>

          {RATIO_OPTIONS.map((opt) => {
            const isSelected = opt.id === selectedRatio;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectRatio(opt.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected ? 'rgba(6, 182, 212, 0.22)' : 'transparent',
                  color: isSelected ? 'var(--accent-cyan, #06b6d4)' : '#ffffff',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.2 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '1px' }}>
                    {opt.sub}
                  </span>
                </div>
                {isSelected && <Check size={12} style={{ color: 'var(--accent-cyan, #06b6d4)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Choose Aspect Ratio Crop"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          height: '26px',
          borderRadius: '7px',
          background: isOpen ? 'rgba(6, 182, 212, 0.3)' : 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid ' + (isOpen ? 'var(--accent-cyan, #06b6d4)' : 'rgba(255, 255, 255, 0.18)'),
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: 'none',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
        }}
      >
        <Crop size={12} style={{ color: 'var(--accent-cyan, #06b6d4)' }} />
        <span>{activeOption.label}</span>
        <ChevronUp
          size={11}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        />
      </button>
    </div>
  );
};
