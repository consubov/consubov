import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '../auth/useAuth';
import { FAZENDA_MODULES } from './moduleRegistry';
import { LoginView } from '../components/views/LoginView';
import { ContextSelectorView } from '../components/views/ContextSelectorView';
import { AccessDeniedView } from '../components/views/AccessDeniedView';
import { StateBoundary } from '@consubov/ui';
import { UserProfileId } from '@consubov/contracts';

function parseCurrentRoute(): { path: string; profile?: UserProfileId } {
  if (typeof window === 'undefined') {
    return { path: '/' };
  }
  const rawHash = window.location.hash.replace(/^#/, '');
  const path = rawHash || window.location.pathname || '/';

  const match = path.match(/^\/fazenda\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return { path, profile: match[1] as UserProfileId };
  }
  return { path };
}

export const AppRouter: React.FC = () => {
  const { isAuthenticated, activeContext, requiresContextSelection, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(parseCurrentRoute);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onLocationChange = () => {
      setCurrentRoute(parseCurrentRoute());
    };

    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  // Cria dinamicamente componentes lazy para os submódulos registrados
  const LazyComponents = useMemo(() => {
    return {
      gerente: React.lazy(() => FAZENDA_MODULES.gerente.loader()),
      capataz: React.lazy(() => FAZENDA_MODULES.capataz.loader()),
      escritorio: React.lazy(() => FAZENDA_MODULES.escritorio.loader()),
      fabrica: React.lazy(() => FAZENDA_MODULES.fabrica.loader())
    };
  }, []);

  if (isLoading) {
    return <StateBoundary state="loading">{null}</StateBoundary>;
  }

  // 1. Não autenticado -> Login
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 2. Autenticado mas sem contexto explícito -> ISO-004 Seletor de Contexto
  if (requiresContextSelection || !activeContext) {
    return <ContextSelectorView />;
  }

  // 3. Rota de módulo solicitada
  const requestedProfile = currentRoute.profile ?? activeContext.profile_id;

  // 4. Verificação RBAC Fail-Closed
  if (
    requestedProfile &&
    activeContext.profile_id !== requestedProfile &&
    activeContext.profile_id !== 'administrador'
  ) {
    return (
      <AccessDeniedView
        activeProfile={activeContext.profile_id}
        requiredProfile={requestedProfile}
        onNavigateHome={() => {
          if (typeof window !== 'undefined') {
            window.location.hash = `#/fazenda/${activeContext.profile_id}`;
          }
        }}
      />
    );
  }

  // 5. Renderização do submódulo autorizado via Lazy Loading
  const ComponentToRender = LazyComponents[requestedProfile as keyof typeof LazyComponents];

  if (!ComponentToRender) {
    return <ContextSelectorView />;
  }

  return (
    <Suspense fallback={<StateBoundary state="loading">{null}</StateBoundary>}>
      <ComponentToRender />
    </Suspense>
  );
};
