import React from 'react';
import { GlassSelectOption } from '../components/GlassSelect';

export const speedOptions: GlassSelectOption[] = [
  { value: '0.25', label: '0.25x' },
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1.0', label: '1.0x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '2.0', label: '2.0x' },
  { value: '5.0', label: '5.0x' },
  { value: 'CUSTOM', label: 'Custom...' },
];

export const slowMoOptions: GlassSelectOption[] = [
  { value: 'FRAME_DUP', label: 'Standard' },
  { value: 'OPTICAL_SMOOTH', label: 'AI Motion' },
];

export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length === 1) {
    const num = parseFloat(parts[0]);
    return isNaN(num) ? null : num;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    if (isNaN(hrs) || isNaN(mins) || isNaN(secs)) return null;
    return hrs * 3600 + mins * 60 + secs;
  }
  return null;
}

export function parseAndClampSpeed(raw: string): number {
  if (!raw || !raw.trim()) return 1.0;
  const clean = raw.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const val = parseFloat(clean);
  if (isNaN(val) || val <= 0) return 0.1;
  const clamped = Math.max(0.1, Math.min(50.0, val));
  return Math.round(clamped * 100) / 100;
}

export const controlButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'var(--input-bg, rgba(255, 255, 255, 0.08))',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-main)',
  fontSize: '11.5px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.15s ease',
};

export const timeInputStyle: React.CSSProperties = {
  width: '88px',
  padding: '3px 6px',
  borderRadius: '6px',
  background: 'var(--input-bg, rgba(0, 0, 0, 0.25))',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-main)',
  fontSize: '11.5px',
  fontFamily: 'monospace',
  textAlign: 'center',
  outline: 'none',
};
