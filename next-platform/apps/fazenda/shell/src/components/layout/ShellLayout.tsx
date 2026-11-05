import React, { useState, useEffect } from 'react';
import { ShellAppBar } from './ShellAppBar';
import { ShellNavigation } from './ShellNavigation';
import { SyncStatusBar, colorTokens } from '@consubov/ui';
import { useAuth } from '../../auth/useAuth';

export interface ShellLayoutProps {
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {
  const { isAuthenticated, activeContext } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: colorTokens.surface.canvas
      }}
    >
      <ShellAppBar />

      {isAuthenticated && activeContext && (
        <SyncStatusBar
          status={isOnline ? 'SINCRONIZADO' : 'PENDENTE'}
          pendingCount={0}
          isOnline={isOnline}
        />
      )}

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isAuthenticated && activeContext ? 72 : 16
        }}
      >
        {children}
      </main>

      {isAuthenticated && activeContext && <ShellNavigation />}
    </div>
  );
};
