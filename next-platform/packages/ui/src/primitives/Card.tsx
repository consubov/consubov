import React from 'react';
import { colorTokens } from '../tokens/colors';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'elevated';
}

export const Card: React.FC<CardProps> = ({ elevation = 'flat', children, style, ...rest }) => {
  return (
    <div
      {...rest}
      style={{
        backgroundColor: colorTokens.surface.card,
        borderRadius: 12,
        border: `1px solid ${colorTokens.surface.border}`,
        boxShadow: elevation === 'elevated' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
        padding: 16,
        ...style
      }}
    >
      {children}
    </div>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, style, ...rest }) => {
  const getColors = () => {
    switch (variant) {
      case 'success': return { bg: '#DCFCE7', text: colorTokens.status.success };
      case 'warning': return { bg: '#FEF3C7', text: colorTokens.status.warning };
      case 'danger': return { bg: '#FEE2E2', text: colorTokens.status.danger };
      case 'info': return { bg: '#E0F2FE', text: colorTokens.status.info };
      case 'neutral': return { bg: '#F1F5F9', text: colorTokens.text.secondary };
    }
  };

  const { bg, text } = getColors();

  return (
    <span
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        ...style
      }}
    >
      {children}
    </span>
  );
};
