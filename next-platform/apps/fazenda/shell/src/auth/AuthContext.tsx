import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  LocalAuthService,
  SessionManager,
  SyntheticUserSession,
  AuthorizedContext,
  MembershipRecord,
  TokenPair,
  AuthCredentials
} from '@consubov/auth-client';

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
  authService: LocalAuthService;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  authService?: LocalAuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService: providedAuthService }) => {
  const authService = useMemo(() => providedAuthService ?? new LocalAuthService(), [providedAuthService]);
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
      setIsLoading(true);
      try {
        const result = await authService.login(credentials);
        if (result.success && result.session) {
          setSession(result.session);
          setAvailableMemberships(result.available_memberships ?? []);
          setRequiresContextSelection(true);
          setActiveContext(null);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        setIsLoading(false);
      }
    },
    [authService]
  );

  const selectContext = useCallback(
    async (membershipId: string) => {
      setIsLoading(true);
      try {
        const result = await authService.selectContext(membershipId);
        if (result.success && result.session) {
          setSession(result.session);
          setActiveContext(result.session.active_context);
          setTokens(result.tokens ?? null);
          setRequiresContextSelection(false);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        setIsLoading(false);
      }
    },
    [authService]
  );

  const switchContext = useCallback(
    async (membershipId: string) => {
      setIsLoading(true);
      try {
        const result = await authService.switchContext(membershipId);
        if (result.success && result.session) {
          setSession(result.session);
          setActiveContext(result.session.active_context);
          setTokens(result.tokens ?? null);
          setRequiresContextSelection(false);
          return { success: true };
        }
        return { success: false, error: result.error };
      } finally {
        setIsLoading(false);
      }
    },
    [authService]
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
