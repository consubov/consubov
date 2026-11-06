import React from 'react';
import { I18nProvider } from '@consubov/ui';
import { AuthProvider } from './auth/AuthContext';
import { ShellLayout } from './components/layout/ShellLayout';
import { AppRouter } from './router/AppRouter';
import { UpdateConsentNotice } from './pwa/UpdateConsentNotice';

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AuthProvider>
        <ShellLayout>
          <AppRouter />
        </ShellLayout>
        <UpdateConsentNotice />
      </AuthProvider>
    </I18nProvider>
  );
};

export default App;
