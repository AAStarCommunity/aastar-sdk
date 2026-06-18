import type { CSSProperties } from 'react';
import { brand } from '../config';

const { colors } = brand;

export const card: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  marginBottom: 10,
  boxSizing: 'border-box',
  fontSize: 14,
};

export const primaryButton: CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 8,
  border: 'none',
  background: colors.primary,
  color: colors.primaryText,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

export const label: CSSProperties = {
  color: colors.muted,
  fontSize: 13,
  marginBottom: 4,
};
