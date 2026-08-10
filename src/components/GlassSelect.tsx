import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  options: GlassSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placement?: 'bottom' | 'top';
  style?: React.CSSProperties;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placement = 'bottom',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--input-bg, rgba(255, 255, 255, 0.08))',
          border: isOpen
            ? '1px solid var(--accent-cyan)'
            : '1px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--text-main)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : ''}
        </span>
        <ChevronDown
          size={14}
          style={{
            marginLeft: '6px',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
          }}
        />
      </button>

      {/* FROSTED GLASS DROPDOWN POPOVER */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 4px)' }
              : { top: 'calc(100% + 4px)' }),
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'var(--bg-glass-dropdown, rgba(18, 22, 36, 0.95))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.15))',
            borderRadius: '10px',
            padding: '4px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-main)',
                  background: isSelected
                    ? 'rgba(6, 182, 212, 0.15)'
                    : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--bg-dropdown-item-hover, rgba(255, 255, 255, 0.08))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={13} style={{ color: 'var(--accent-cyan)' }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
