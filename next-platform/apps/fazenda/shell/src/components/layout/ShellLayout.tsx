import React from 'react';
import { ShellAppBar } from './ShellAppBar';
import { ShellNavigation } from './ShellNavigation';
import { colorTokens } from '@consubov/ui';
import { useAuth } from '../../auth/useAuth';

export interface ShellLayoutProps {
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {
  const { isAuthenticated, activeContext } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: colorTokens.surface.canvas }}>
      <ShellAppBar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: isAuthenticated && activeContext ? 72 : 16 }}>
        {children}
      </main>
      {isAuthenticated && activeContext && <ShellNavigation />}
    </div>
  );
};
