import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, Button, Input, Card, LanguageSwitch, colorTokens, QuiescentForm } from '@consubov/ui';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage(t('auth.login.fieldRequired', 'Este campo é de preenchimento obrigatório.'));
      return false;
    }

    const result = await login({ email: email.trim(), password });
    if (!result.success) {
      setErrorMessage(result.error ?? t('shell.login.errorInvalid', 'E-mail ou senha inválidos. Verifique suas credenciais.'));
    }
    return result.success;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px 16px', backgroundColor: colorTokens.surface.canvas }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><LanguageSwitch /></div>
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
          <QuiescentForm onSubmit={handleSubmit} noValidate>
            {errorMessage && (
              <div role="alert" style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#FEE2E2', border: `1px solid ${colorTokens.status.danger}`, color: '#991B1B', fontSize: '0.875rem', marginBottom: 16, fontWeight: 600 }}>
                {errorMessage}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 6 }}>
                {t('shell.login.emailLabel', 'E-mail de Acesso')}
              </label>
              <Input id="login-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t('shell.login.emailPlaceholder', 'E-mail')} autoComplete="email" disabled={isLoading} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 6 }}>
                {t('shell.login.passwordLabel', 'Senha')}
              </label>
              <Input id="login-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={t('shell.login.passwordPlaceholder', '••••••••')} autoComplete="current-password" disabled={isLoading} />
            </div>
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} loadingText={t('shell.login.submitting', 'Autenticando sessão...')} style={{ width: '100%' }}>
              {t('shell.login.submitButton', 'Entrar no Sistema')}
            </Button>
          </QuiescentForm>
        </Card>
      </div>
    </div>
  );
};
