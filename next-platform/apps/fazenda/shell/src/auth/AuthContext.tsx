import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  ProvisionedAuthService,
  SessionManager,
  SyntheticUserSession,
  AuthorizedContext,
  MembershipRecord,
  TokenPair,
  AuthCredentials
} from '@consubov/auth-client/browser';
import { FAZENDA_MODULES } from '../router/moduleRegistry';
import { provisionModuleArtifact } from '../pwa/moduleArtifactProvisioning';
import { QuiescentLocalData } from '../pwa/QuiescentLocalData';
import { globalQuiescenceRegistry } from '@consubov/module-release';
import { moduleProvisioningPayloadSchema, type ModuleExecutionContext } from '@consubov/contracts';
import { createHttpSyncTransport } from '../sync/HttpSyncTransport';
import { SilentSyncRunner } from '../sync/SilentSyncRunner';

export interface AuthContextValue {
  session: SyntheticUserSession | null;
  activeContext: AuthorizedContext | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  requiresContextSelection: boolean;
  availableMemberships: readonly MembershipRecord[];
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<{ success: boolean; error?: string }>;
  selectContext: (membershipId: string) => Promise<{ success: boolean; error?: string }>;
  switchContext: (membershipId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  authService: ProvisionedAuthService;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  authService?: ProvisionedAuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService: providedAuthService }) => {
  const authService = useMemo(() => providedAuthService ?? new ProvisionedAuthService({
    provisionAccount: async (provisionedSession, provisionedTokens, initialData, isCurrent) => {
      const context = provisionedSession.active_context;
      if (!context || context.profile_id === 'administrador') throw new Error('Acesso ao aplicativo não autorizado.');
      const descriptor = FAZENDA_MODULES[context.profile_id];
      if (!await provisionModuleArtifact(descriptor.moduleId, descriptor.entryUrl)) throw new Error('Não foi possível preparar o aplicativo.');
      const localContext = {
        userId: provisionedSession.user_id, tenantId: context.tenant_id,
        farmId: context.fazenda_id, retreatId: context.retiro_id,
        moduleId: descriptor.moduleId, profileId: context.profile_id,
        deviceId: provisionedSession.device_id, productId: 'consubov' as const
      };
      const seed = moduleProvisioningPayloadSchema.parse(initialData);
      if ((Object.keys(localContext) as Array<keyof typeof localContext>).some(key => seed.context[key] !== localContext[key])) {
        throw new Error('Dados iniciais não pertencem ao acesso autorizado.');
      }
      const isActive = () => isCurrent() && Date.parse(provisionedSession.expires_at) > Date.now();
      if (!isActive()) throw new Error('Sessão de provisionamento encerrada.');
      const transport = createHttpSyncTransport({ baseUrl: window.location.origin, context: localContext,
        getAccessToken: () => provisionedTokens.access_token, isActive });
      const signal = new AbortController().signal;
      const attachments = [];
      for (const ref of seed.attachment_refs ?? []) {
        if (!isActive()) throw new Error('Sessão de provisionamento encerrada.');
        if (!transport.download) throw new Error('Leitura de anexos indisponível.');
        attachments.push({ ref, blob: await transport.download(ref, signal) });
      }
      // Existing operational data/outbox are preserved by the adapter's atomic seed check.
      await new QuiescentLocalData(localContext, isActive).provisionInitialSnapshot(localContext, seed.snapshot, attachments);
    }
  }), [providedAuthService]);
  const sessionManager = useMemo(() => authService.getSessionManager(), [authService]);

  const [session, setSession] = useState<SyntheticUserSession | null>(() => sessionManager.getSession());
  const [activeContext, setActiveContext] = useState<AuthorizedContext | null>(() => sessionManager.getActiveContext());
  const [tokens, setTokens] = useState<TokenPair | null>(() => sessionManager.getTokens());
  const [availableMemberships, setAvailableMemberships] = useState<readonly MembershipRecord[]>(() => {
    const current = sessionManager.getSession();
    return current ? current.memberships.filter(m => m.is_active) : [];
  });
  const [requiresContextSelection, setRequiresContextSelection] = useState<boolean>(() => {
    const current = sessionManager.getSession();
    return !!current && current.active_context === null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const context = session?.active_context;
    if (!session || !context || context.profile_id === 'administrador' || !tokens?.access_token ||
        !context.capabilities.includes('sync.push') || !context.capabilities.includes('sync.pull')) return;
    const executionContext: ModuleExecutionContext = {
      userId: session.user_id, tenantId: context.tenant_id, farmId: context.fazenda_id,
      retreatId: context.retiro_id, moduleId: context.profile_id, profileId: context.profile_id,
      deviceId: session.device_id, productId: 'consubov'
    };
    let active = true;
    const isActive = () => active && sessionManager.getSession()?.session_id === session.session_id &&
      sessionManager.getActiveContext()?.context_id === context.context_id && Date.parse(session.expires_at) > Date.now();
    const transport = createHttpSyncTransport({ baseUrl: window.location.origin, context: executionContext,
      getAccessToken: () => isActive() ? tokens.access_token : null, isActive });
    const runner = new SilentSyncRunner({ context: executionContext,
      local: new QuiescentLocalData(executionContext, isActive), transport, isActive,
      acquireFlight: () => {
        if (!isActive() || globalQuiescenceRegistry.isFrozen()) return null;
        return globalQuiescenceRegistry.acquireLock(crypto.randomUUID(), 'OUTBOX_SYNCING');
      },
      onAuthorizationRequired: () => {
        if (!isActive()) return;
        const release = globalQuiescenceRegistry.acquireLock(crypto.randomUUID(), 'LOCAL_DB_TRANSACTION');
        void authService.suspendAuthorization().catch(() => undefined).finally(release);
      },
      onCommitted: () => {
        if (isActive()) window.dispatchEvent(new CustomEvent('consubov:local-data-changed', {
          detail: { sessionId: session.session_id, contextId: context.context_id, context: executionContext }
        }));
      }
    });
    runner.start();
    return () => { active = false; runner.stop(); };
  }, [session, tokens, sessionManager, authService]);

  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expires_at) - Date.now();
    const expire = () => {
      if (sessionManager.getSession()?.session_id === session.session_id) authService.logout();
    };
    if (!Number.isFinite(remaining) || remaining <= 0) { expire(); return; }
    const timer = window.setTimeout(expire, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [session?.session_id, session?.expires_at, authService, sessionManager]);

  // Sincroniza estado reativo com alterações do SessionManager
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((newSession: SyntheticUserSession | null) => {
      setSession(newSession);
      setActiveContext(newSession?.active_context ?? null);
      setTokens(sessionManager.getTokens());
      if (newSession) {
        setAvailableMemberships(newSession.memberships.filter((m: MembershipRecord) => m.is_active));
        setRequiresContextSelection(newSession.active_context === null);
      } else {
        setAvailableMemberships([]);
        setRequiresContextSelection(false);
      }
    });
    return unsubscribe;
  }, [sessionManager]);

  const login = useCallback(
    async (credentials: AuthCredentials) => {
      if (globalQuiescenceRegistry.isFrozen()) return { success: false, error: 'Atualização do aplicativo em andamento. Tente novamente.' };
      const release = globalQuiescenceRegistry.acquireLock(crypto.randomUUID(), 'LOCAL_DB_TRANSACTION');
      setIsLoading(true);
      try {
        const result = await authService.login(credentials);
        if (result.success && result.session && sessionManager.getSession() === result.session) {
          setSession(result.session);
          setAvailableMemberships(result.available_memberships ?? []);
          setRequiresContextSelection(result.requires_context_selection ?? result.session.active_context === null);
          setActiveContext(result.session.active_context);
          setTokens(result.tokens ?? null);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        release();
        setIsLoading(false);
      }
    },
    [authService, sessionManager]
  );

  const selectContext = useCallback(
    async (membershipId: string) => {
      if (globalQuiescenceRegistry.isFrozen()) return { success: false, error: 'Atualização do aplicativo em andamento. Tente novamente.' };
      const release = globalQuiescenceRegistry.acquireLock(crypto.randomUUID(), 'LOCAL_DB_TRANSACTION');
      setIsLoading(true);
      try {
        const result = await authService.selectContext(membershipId);
        if (result.success && result.session && sessionManager.getSession() === result.session) {
          setSession(result.session);
          setActiveContext(result.session.active_context);
          setTokens(result.tokens ?? null);
          setRequiresContextSelection(false);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        release();
        setIsLoading(false);
      }
    },
    [authService, sessionManager]
  );

  const switchContext = useCallback(
    async (membershipId: string) => {
      if (globalQuiescenceRegistry.isFrozen()) return { success: false, error: 'Atualização do aplicativo em andamento. Tente novamente.' };
      const release = globalQuiescenceRegistry.acquireLock(crypto.randomUUID(), 'LOCAL_DB_TRANSACTION');
      setIsLoading(true);
      try {
        const result = await authService.switchContext(membershipId);
        if (result.success && result.session && sessionManager.getSession() === result.session) {
          setSession(result.session);
          setActiveContext(result.session.active_context);
          setTokens(result.tokens ?? null);
          setRequiresContextSelection(false);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        release();
        setIsLoading(false);
      }
    },
    [authService, sessionManager]
  );

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
    setActiveContext(null);
    setTokens(null);
    setAvailableMemberships([]);
    setRequiresContextSelection(false);
  }, [authService]);

  const value = useMemo(
    () => ({
      session,
      activeContext,
      tokens,
      isAuthenticated: !!session,
      requiresContextSelection,
      availableMemberships,
      isLoading,
      login,
      selectContext,
      switchContext,
      logout,
      authService
    }),
    [
      session,
      activeContext,
      tokens,
      requiresContextSelection,
      availableMemberships,
      isLoading,
      login,
      selectContext,
      switchContext,
      logout,
      authService
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
