import React from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, Dialog, Button, colorTokens } from '@consubov/ui';

export interface ContextSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContextSwitchModal: React.FC<ContextSwitchModalProps> = ({ isOpen, onClose }) => {
  const { availableMemberships, activeContext, switchContext, isLoading } = useAuth();
  const { t } = useTranslation();

  const handleSelect = async (membershipId: string) => {
    await switchContext(membershipId);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('shell.context.switchModalTitle', 'Trocar de Fazenda ou Perfil')}
      closeAriaLabel={t('action.close', 'Fechar')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {availableMemberships.map((m) => {
          const isCurrent =
            activeContext &&
            activeContext.fazenda_id === m.fazenda_id &&
            activeContext.profile_id === m.profile_id &&
            (activeContext.retiro_id ?? null) === (m.retiro_id ?? null);

          return (
            <div
              key={m.membership_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 8,
                border: isCurrent
                  ? `2px solid ${colorTokens.brand.primary}`
                  : `1px solid ${colorTokens.surface.borderStrong}`,
                backgroundColor: isCurrent ? '#F0FDF4' : colorTokens.surface.card
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: '0.95rem' }}>
                  {m.fazenda_nome}
                </div>
                <div style={{ fontSize: '0.8rem', color: colorTokens.text.secondary }}>
                  {m.retiro_nome ? `${m.retiro_nome} • ` : ''}
                  <span style={{ fontWeight: 600 }}>{t(`role.${m.profile_id}`, m.profile_id)}</span>
                </div>
              </div>

              {isCurrent ? (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: colorTokens.brand.primary }}>
                  ✓ {t('shell.nav.currentContext', 'Contexto Ativo')}
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isLoading}
                  onClick={() => handleSelect(m.membership_id)}
                  style={{ minHeight: 40 }}
                >
                  {t('action.confirm', 'Confirmar')}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
};
