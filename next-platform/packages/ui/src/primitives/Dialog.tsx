import React from 'react';
import { colorTokens } from '../tokens/colors';
import { useTranslation } from '../i18n';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  closeAriaLabel?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  closeAriaLabel,
  children
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const ariaLabel = closeAriaLabel ?? t('action.close', 'Fechar');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colorTokens.surface.card,
          borderRadius: 16,
          padding: 24,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 id="dialog-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: colorTokens.text.primary }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={ariaLabel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              minHeight: 48,
              minWidth: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
