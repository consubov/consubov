import React from 'react';
import { colorTokens } from '../tokens/colors';
import { spacingTokens } from '../tokens/spacing';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  style,
  ...rest
}) => {
  // Labels repeat in split-lot and formula forms; each instance needs its own link.
  const generatedId = React.useId();
  const inputId = id ?? `input-${generatedId}`;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: colorTokens.text.primary
          }}
        >
          {label}
        </label>
      )}
      <input
        {...rest}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={errorId}
        style={{
          minHeight: spacingTokens.touch.inputHeightPx,
          padding: '0 14px',
          fontSize: '1rem',
          borderRadius: 8,
          border: `1.5px solid ${error ? colorTokens.status.danger : colorTokens.surface.borderStrong}`,
          backgroundColor: colorTokens.surface.card,
          color: colorTokens.text.primary,
          outline: 'revert',
          boxSizing: 'border-box',
          ...style
        }}
      />
      {error && (
        <span id={errorId} role="alert" style={{ fontSize: '0.75rem', color: colorTokens.status.danger, fontWeight: 500 }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '0.75rem', color: colorTokens.text.muted }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
