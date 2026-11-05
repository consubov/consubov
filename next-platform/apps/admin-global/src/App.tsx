import React from 'react';
import { I18nProvider } from '@consubov/ui';
import { AdminAuthProvider } from './auth/AdminAuthContext';
import { AdminRouter } from './router/AdminRouter';

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AdminAuthProvider>
        <AdminRouter />
      </AdminAuthProvider>
    </I18nProvider>
  );
};

export default App;
