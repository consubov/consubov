import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { FAZENDA_MODULES } from './moduleRegistry';
import { ModuleFrame } from './ModuleFrame';
import { LoginView } from '../components/views/LoginView';
import { ContextSelectorView } from '../components/views/ContextSelectorView';
import { AccessDeniedView } from '../components/views/AccessDeniedView';
import { StateBoundary } from '@consubov/ui';
import { UserProfileId } from '@consubov/contracts';

function parseCurrentRoute(): { path: string; profile?: UserProfileId } {
  if (typeof window === 'undefined') return { path: '/' };
  const rawHash = window.location.hash.replace(/^#/, '');
  const path = rawHash || window.location.pathname || '/';
  const match = path.match(/^\/fazenda\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ? { path, profile: match[1] as UserProfileId } : { path };
}

export const AppRouter: React.FC = () => {
  const { session, isAuthenticated, activeContext, requiresContextSelection, isLoading, authService } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(parseCurrentRoute);

  useEffect(() => {
    const onLocationChange = () => setCurrentRoute(parseCurrentRoute());
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  if (!isAuthenticated || !session) return <LoginView />;
  if (requiresContextSelection || !activeContext) return <ContextSelectorView />;
  // Keep pending forms mounted so their asynchronous errors remain visible.
  if (isLoading) return <StateBoundary state="loading">{null}</StateBoundary>;

  const requestedProfile = currentRoute.profile ?? activeContext.profile_id;
  if (activeContext.profile_id !== requestedProfile) {
    return (
      <AccessDeniedView
        activeProfile={activeContext.profile_id}
        requiredProfile={requestedProfile}
        onNavigateHome={() => { window.location.hash = `#/fazenda/${activeContext.profile_id}`; }}
      />
    );
  }

  if (requestedProfile === 'administrador') return <ContextSelectorView />;
  const descriptor = FAZENDA_MODULES[requestedProfile];
  if (!descriptor || descriptor.profileId !== activeContext.profile_id) return <ContextSelectorView />;

  // The iframe is created only after authentication, explicit context selection and profile authorization.
  return <ModuleFrame descriptor={descriptor} session={session} context={activeContext} isContextCurrent={() => {
    const current = authService.getSessionManager().getSession();
    const authorized = current?.active_context;
    return current?.session_id === session.session_id && current.user_id === session.user_id && current.device_id === session.device_id &&
      Date.parse(current.expires_at) > Date.now() && !!authorized && authorized.context_id === activeContext.context_id &&
      authorized.tenant_id === activeContext.tenant_id && authorized.product_id === activeContext.product_id &&
      authorized.fazenda_id === activeContext.fazenda_id && authorized.retiro_id === activeContext.retiro_id && authorized.profile_id === activeContext.profile_id &&
      JSON.stringify([...authorized.capabilities].sort()) === JSON.stringify([...activeContext.capabilities].sort());
  }} />;
};
