import React from 'react';
import { useAuth } from './useAuth';
import { UserProfileId } from '@consubov/contracts';
import { AccessDeniedView } from '../components/views/AccessDeniedView';
import { ContextSelectorView } from '../components/views/ContextSelectorView';
import { LoginView } from '../components/views/LoginView';
import { StateBoundary } from '@consubov/ui';

export interface ProtectedRouteProps {
  requiredProfile?: UserProfileId;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredProfile, children }) => {
  const { isAuthenticated, activeContext, requiresContextSelection, isLoading } = useAuth();

  if (isLoading) {
    return <StateBoundary state="loading">{null}</StateBoundary>;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (requiresContextSelection || !activeContext) {
    return <ContextSelectorView />;
  }

  // Validação estrita de perfil autorizado para a rota (Fail-Closed)
  if (
    requiredProfile &&
    activeContext.profile_id !== requiredProfile &&
    activeContext.profile_id !== 'administrador'
  ) {
    return (
      <AccessDeniedView
        activeProfile={activeContext.profile_id}
        requiredProfile={requiredProfile}
      />
    );
  }

  return <>{children}</>;
};
