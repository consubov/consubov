import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, Button, LanguageSwitch, Dialog, colorTokens } from '@consubov/ui';
import { ContextSwitchModal } from './ContextSwitchModal';

export const ShellAppBar: React.FC = () => {
  const { session, activeContext, availableMemberships, logout } = useAuth();
  const { t } = useTranslation();

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const hasMultipleMemberships = availableMemberships.length > 1;

  return (
    <>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          minHeight: 56,
          backgroundColor: '#FFFFFF',
          borderBottom: `1px solid ${colorTokens.surface.border}`,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minWidth: 0, maxWidth: '100%', flex: '1 1 280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ fontSize: '1.5rem' }}>🐂</span>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: colorTokens.brand.primary, letterSpacing: '-0.02em' }}>
              CONSUBOV
            </h1>
          </div>

          {activeContext && (
            <button
              onClick={() => hasMultipleMemberships && setIsSwitchModalOpen(true)}
              title={hasMultipleMemberships ? t('shell.header.switchContext', 'Trocar Perfil / Fazenda') : undefined}
              style={{
                display: 'inline-flex',
                minWidth: 0,
                maxWidth: '100%',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                border: `1px solid ${colorTokens.surface.borderStrong}`,
                backgroundColor: '#F8FAFC',
                cursor: hasMultipleMemberships ? 'pointer' : 'default',
                fontSize: '0.825rem',
                color: colorTokens.text.primary,
                minHeight: 44
              }}
            >
              <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeContext.fazenda_nome}</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 10,
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}
              >
                {t(`role.${activeContext.profile_id}`, activeContext.profile_id)}
              </span>
              {hasMultipleMemberships && <span style={{ fontSize: '0.7rem', color: colorTokens.text.secondary }}>▼</span>}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minWidth: 0, maxWidth: '100%', marginInlineStart: 'auto' }}>
          <LanguageSwitch />

          {session && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsLogoutModalOpen(true)}
              style={{ minHeight: 44, padding: '0 12px', fontSize: '0.875rem' }}
            >
              {t('shell.logout.button', 'Sair')}
            </Button>
          )}
        </div>
      </header>

      {/* Modal de Troca Rápida de Contexto */}
      {hasMultipleMemberships && (
        <ContextSwitchModal
          isOpen={isSwitchModalOpen}
          onClose={() => setIsSwitchModalOpen(false)}
        />
      )}

      {/* Modal de Confirmação de Logout */}
      <Dialog
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title={t('shell.logout.confirmTitle', 'Confirmar Saída')}
        closeAriaLabel={t('action.close', 'Fechar')}
      >
        <p style={{ margin: '8px 0 12px', color: colorTokens.text.secondary, fontSize: '0.95rem' }}>
          {t('shell.logout.confirmMessage', 'Deseja realmente encerrar a sessão neste dispositivo?')}
        </p>
        <p style={{ margin: '0 0 20px', color: colorTokens.text.secondary, fontSize: '0.85rem' }}>
          {t('shell.logout.savedDataNotice', 'Seus registros salvos serão mantidos neste dispositivo.')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setIsLogoutModalOpen(false)}>
            {t('shell.logout.cancelAction', 'Continuar no aplicativo')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setIsLogoutModalOpen(false);
              logout();
            }}
          >
            {t('shell.logout.confirmAction', 'Sim, Sair')}
          </Button>
        </div>
      </Dialog>
    </>
  );
};
