import React from 'react';
import { useTranslation, Button, Card, colorTokens } from '@consubov/ui';
import { UserProfileId } from '@consubov/contracts';

export interface AccessDeniedViewProps {
  activeProfile: UserProfileId;
  requiredProfile?: UserProfileId;
  onNavigateHome?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  activeProfile,
  requiredProfile,
  onNavigateHome
}) => {
  const { t } = useTranslation();

  const handleReturn = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.hash = `#/fazenda/${activeProfile}`;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '24px 16px',
        backgroundColor: colorTokens.surface.canvas
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <Card elevation="elevated">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px', color: colorTokens.status.danger }}>
            {t('shell.denied.title', 'Acesso Não Autorizado')}
          </h1>
          <p style={{ margin: '0 0 16px', color: colorTokens.text.secondary, fontSize: '0.95rem' }}>
            {t('shell.denied.message', 'Seu perfil ativo não possui permissão para acessar este módulo.')}
          </p>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#F8FAFC',
              border: `1px solid ${colorTokens.surface.border}`,
              fontSize: '0.85rem',
              color: colorTokens.text.secondary,
              marginBottom: 24,
              textAlign: 'left'
            }}
          >
            <div>
              <strong>{t('shell.header.activeProfile', 'Perfil:')} </strong>
              <span style={{ color: colorTokens.text.primary, fontWeight: 600 }}>
                {t(`role.${activeProfile}`, activeProfile)}
              </span>
            </div>
            {requiredProfile && (
              <div style={{ marginTop: 4 }}>
                <strong>Requerido: </strong>
                <span style={{ color: colorTokens.status.danger, fontWeight: 600 }}>
                  {t(`role.${requiredProfile}`, requiredProfile)}
                </span>
              </div>
            )}
          </div>

          <Button variant="primary" size="lg" onClick={handleReturn} style={{ width: '100%' }}>
            {t('shell.denied.back', 'Voltar ao Meu Módulo')}
          </Button>
        </Card>
      </div>
    </div>
  );
};
