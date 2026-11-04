import React, { useState, useRef, useEffect } from 'react';
import { colorTokens } from '../tokens/colors';
import { spacingTokens } from '../tokens/spacing';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'lg';
  isLoading?: boolean;
  debounceMs?: number;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  debounceMs = 300,
  onClick,
  disabled,
  children,
  style,
  ...rest
}) => {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading || isDebouncing) return;

    if (debounceMs > 0) {
      setIsDebouncing(true);
      timerRef.current = setTimeout(() => setIsDebouncing(false), debounceMs);
    }

    if (onClick) {
      onClick(e);
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return colorTokens.surface.borderStrong;
    switch (variant) {
      case 'primary': return colorTokens.brand.primary;
      case 'secondary': return colorTokens.brand.secondary;
      case 'danger': return colorTokens.status.danger;
      case 'ghost': return 'transparent';
    }
  };

  const getTextColor = () => {
    if (variant === 'ghost') return colorTokens.text.primary;
    return colorTokens.text.inverse;
  };

  const minHeight = size === 'lg' ? 56 : spacingTokens.touch.buttonHeightPx;

  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        minWidth: spacingTokens.touch.minTargetSizePx,
        padding: '0 20px',
        fontSize: '1rem',
        fontWeight: 600,
        borderRadius: 8,
        border: variant === 'ghost' ? `1px solid ${colorTokens.surface.borderStrong}` : 'none',
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        touchAction: 'manipulation',
        opacity: disabled || isLoading ? 0.6 : 1,
        ...style
      }}
    >
      {isLoading ? 'Aguarde...' : children}
    </button>
  );
};
