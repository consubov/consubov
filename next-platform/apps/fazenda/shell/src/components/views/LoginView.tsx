import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, Button, Input, Card, LanguageSwitch, colorTokens } from '@consubov/ui';
import { LAB_DEFAULT_PASSWORD } from '@consubov/auth-client';

const SAVED_EMAIL_KEY = 'consubov:saved-email';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
    } catch {
      // Ignora erro em ambientes sem localStorage
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage(t('auth.login.fieldRequired', 'Este campo é de preenchimento obrigatório.'));
      return;
    }

    const res = await login({ email: email.trim(), password });
    if (!res.success) {
      setErrorMessage(res.error ?? t('shell.login.errorInvalid', 'E-mail ou senha inválidos. Verifique suas credenciais.'));
    } else {
      try {
        if (rememberEmail) {
          localStorage.setItem(SAVED_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }
      } catch {
        // Ignora
      }
    }
  };

  const handleQuickFill = (syntheticEmail: string) => {
    setEmail(syntheticEmail);
    setPassword(LAB_DEFAULT_PASSWORD);
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        backgroundColor: colorTokens.surface.canvas
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitch />
      </div>

      <div style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🐂</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: colorTokens.brand.primary }}>
            {t('shell.app.title', 'CONSUBOV Fazendas')}
          </h1>
          <p style={{ margin: '8px 0 0', color: colorTokens.text.secondary, fontSize: '0.95rem' }}>
            {t('shell.login.subtitle', 'Acesse sua conta para operar em campo ou escritório')}
          </p>
        </div>

        <Card elevation="elevated">
          <form onSubmit={handleSubmit} noValidate>
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

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="login-email"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 6 }}
              >
                {t('shell.login.emailLabel', 'E-mail de Acesso')}
              </label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('shell.login.emailPlaceholder', 'ex: gerente@consubov.local')}
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="login-password"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 6 }}
              >
                {t('shell.login.passwordLabel', 'Senha')}
              </label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('shell.login.passwordPlaceholder', '••••••••')}
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input
                id="remember-email"
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
              <label htmlFor="remember-email" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                {t('shell.login.rememberEmail', 'Lembrar meu e-mail neste aparelho')}
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              loadingText={t('shell.login.submitting', 'Autenticando sessão...')}
              style={{ width: '100%' }}
            >
              {t('shell.login.submitButton', 'Entrar no Sistema')}
            </Button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${colorTokens.surface.border}` }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700, color: colorTokens.text.secondary }}>
              {t('shell.login.quickFillTitle', 'Acesso Rápido de Bancada (Sintético)')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleQuickFill('gerente@consubov.local')}
                style={{ fontSize: '0.75rem', padding: '0 10px', minHeight: 36 }}
              >
                Gerente
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleQuickFill('capataz@consubov.local')}
                style={{ fontSize: '0.75rem', padding: '0 10px', minHeight: 36 }}
              >
                Capataz
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleQuickFill('escritorio@consubov.local')}
                style={{ fontSize: '0.75rem', padding: '0 10px', minHeight: 36 }}
              >
                Escritório
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleQuickFill('fabrica@consubov.local')}
                style={{ fontSize: '0.75rem', padding: '0 10px', minHeight: 36 }}
              >
                Fábrica
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleQuickFill('multirole@consubov.local')}
                style={{ fontSize: '0.75rem', padding: '0 10px', minHeight: 36 }}
              >
                Multi-Perfil
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
