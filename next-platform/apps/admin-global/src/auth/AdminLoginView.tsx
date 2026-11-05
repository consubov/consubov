import React, { useState } from 'react';
import { useTranslation, Button, Input, Card, LanguageSwitch } from '@consubov/ui';
import { useAdminAuth, SYNTHETIC_ADMIN_USERS } from './AdminAuthContext';

export const AdminLoginView: React.FC = () => {
  const { t } = useTranslation();
  const {
    currentStep,
    isLoading,
    errorMessageKey,
    submitCredentials,
    verifyMfa,
    cancelMfa
  } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await submitCredentials(email, password);
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode) return;
    await verifyMfa(totpCode);
  };

  const quickFill = (userEmail: string) => {
    const cred = SYNTHETIC_ADMIN_USERS[userEmail];
    if (cred) {
      setEmail(cred.email);
      setPassword(cred.defaultPassword);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#0F172A'
      }}
    >
      <header
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px'
        }}
      >
        <LanguageSwitch />
      </header>

      <Card
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '32px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0F172A',
              margin: '0 0 8px 0'
            }}
          >
            {t('admin.auth.title')}
          </h1>
          <p
            style={{
              fontSize: '0.925rem',
              color: '#64748B',
              margin: 0
            }}
          >
            {t('admin.auth.subtitle')}
          </p>
        </div>

        {errorMessageKey && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '0.875rem',
              marginBottom: '20px',
              fontWeight: 600
            }}
          >
            {t(errorMessageKey)}
          </div>
        )}

        {currentStep === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} role="form">
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '16px'
              }}
            >
              {t('admin.auth.step1Title')}
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="admin-email"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px'
                }}
              >
                {t('admin.auth.emailLabel')}
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="admin-password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px'
                }}
              >
                {t('admin.auth.passwordLabel')}
              </label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%' }}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: '#0284C7',
                color: '#FFFFFF'
              }}
            >
              {isLoading ? t('admin.common.loading') : t('admin.auth.submitStep1')}
            </Button>

            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid #E2E8F0'
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}
              >
                {t('shell.login.quickFillTitle')}
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => quickFill('admin.lab@consubov.local')}
                  style={{ flex: 1, minWidth: '100px', fontSize: '0.75rem', border: '1px solid #CBD5E1' }}
                >
                  {t('admin.auth.quickFillSuper')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => quickFill('suporte.lab@consubov.local')}
                  style={{ flex: 1, minWidth: '100px', fontSize: '0.75rem', border: '1px solid #CBD5E1' }}
                >
                  {t('admin.auth.quickFillSupport')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => quickFill('financeiro.lab@consubov.local')}
                  style={{ flex: 1, minWidth: '100px', fontSize: '0.75rem', border: '1px solid #CBD5E1' }}
                >
                  {t('admin.auth.quickFillFinancial')}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} role="form">
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '16px'
              }}
            >
              {t('admin.auth.step2Title')}
            </h2>

            <div
              style={{
                padding: '12px',
                backgroundColor: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                color: '#0369A1'
              }}
            >
              {t('admin.auth.totpHelp')}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="admin-totp"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px'
                }}
              >
                {t('admin.auth.totpLabel')}
              </label>
              <Input
                id="admin-totp"
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('admin.auth.totpPlaceholder')}
                required
                autoFocus
                style={{
                  width: '100%',
                  fontSize: '1.5rem',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontWeight: 800
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF'
                }}
              >
                {isLoading ? t('admin.common.loading') : t('admin.auth.submitStep2')}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={cancelMfa}
                disabled={isLoading}
                style={{ width: '100%', border: '1px solid #CBD5E1' }}
              >
                {t('admin.auth.backToStep1')}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
