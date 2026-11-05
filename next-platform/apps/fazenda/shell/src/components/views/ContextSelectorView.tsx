import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, Button, Card, LanguageSwitch, colorTokens } from '@consubov/ui';
import { UserProfileId } from '@consubov/contracts';

const PROFILE_COLORS: Record<UserProfileId, { bg: string; text: string }> = {
  gerente: { bg: '#DCFCE7', text: '#15803D' },
  capataz: { bg: '#FEF3C7', text: '#B45309' },
  escritorio: { bg: '#E0F2FE', text: '#0369A1' },
  fabrica: { bg: '#F1F5F9', text: '#475569' },
  administrador: { bg: '#F3E8FF', text: '#7E22CE' }
};

export const ContextSelectorView: React.FC = () => {
  const { session, availableMemberships, selectContext, logout, isLoading } = useAuth();
  const { t } = useTranslation();
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = async (membershipId: string) => {
    setSelectedMembershipId(membershipId);
    setErrorMessage(null);
    const res = await selectContext(membershipId);
    if (!res.success) {
      setErrorMessage(res.error ?? t('auth.context.unauthorizedRole', 'Você não tem autorização para operar o perfil selecionado.'));
      setSelectedMembershipId(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '32px 16px',
        backgroundColor: colorTokens.surface.canvas
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitch />
      </div>

      <div style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: colorTokens.text.primary }}>
            {t('shell.context.title', 'Selecione o Contexto Operacional')}
          </h1>
          <p style={{ margin: '8px 0 0', color: colorTokens.text.secondary, fontSize: '1rem' }}>
            {session ? `${session.user_name} (${session.user_email})` : ''}
          </p>
          <p style={{ margin: '4px 0 0', color: colorTokens.text.secondary, fontSize: '0.9rem' }}>
            {t('shell.context.subtitle', 'Escolha a fazenda e a função com a qual deseja trabalhar agora:')}
          </p>
        </div>

        {/* Notificação Anti-First-Match ISO-004 */}
        <div
          role="note"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: '#EFF6FF',
            border: `1px solid #93C5FD`,
            color: '#1E40AF',
            fontSize: '0.825rem',
            marginBottom: 20,
            lineHeight: 1.4
          }}
        >
          <strong>ISO-004: </strong>
          {t('auth.context.antiFirstMatchNotice', 'Regra de Segurança ISO-004: Nenhum perfil ou fazenda é selecionado automaticamente. A escolha explícita é obrigatória.')}
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#FEE2E2',
              border: `1px solid ${colorTokens.status.danger}`,
              color: '#991B1B',
              fontSize: '0.875rem',
              marginBottom: 16,
              fontWeight: 600
            }}
          >
            {errorMessage}
          </div>
        )}

        {availableMemberships.length === 0 ? (
          <Card elevation="elevated">
            <p style={{ textAlign: 'center', color: colorTokens.text.secondary, margin: '20px 0' }}>
              {t('shell.context.noMemberships', 'Nenhum vínculo ativo encontrado para este usuário.')}
            </p>
            <Button variant="secondary" onClick={logout} style={{ width: '100%' }}>
              {t('auth.context.switchUser', 'Trocar de Usuário')}
            </Button>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {availableMemberships.map((membership) => {
              const profileColors = PROFILE_COLORS[membership.profile_id] ?? { bg: '#E2E8F0', text: '#0F172A' };
              const isSelected = selectedMembershipId === membership.membership_id;

              return (
                <Card
                  key={membership.membership_id}
                  elevation="elevated"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    border: isSelected ? `2px solid ${colorTokens.brand.primary}` : undefined
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.25rem' }}>🏡</span>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: colorTokens.text.primary }}>
                          {membership.fazenda_nome}
                        </h2>
                      </div>
                      <p style={{ margin: '4px 0 0 32px', color: colorTokens.text.secondary, fontSize: '0.9rem' }}>
                        {membership.retiro_nome
                          ? `${t('shell.context.cardRetiro', 'Retiro / Unidade')}: ${membership.retiro_nome}`
                          : t('auth.context.allUnits', 'Todos os retiros da fazenda')}
                      </p>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 16,
                        backgroundColor: profileColors.bg,
                        color: profileColors.text,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {t(`role.${membership.profile_id}`, membership.profile_id)}
                    </span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={isLoading}
                      isLoading={isLoading && isSelected}
                      onClick={() => handleSelect(membership.membership_id)}
                      style={{ width: '100%' }}
                    >
                      {t('shell.context.btnSelect', 'Acessar Este Contexto')}
                    </Button>
                  </div>
                </Card>
              );
            })}

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Button variant="ghost" onClick={logout}>
                {t('auth.context.switchUser', 'Trocar de Usuário')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
