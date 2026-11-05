import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { signSyntheticJwt, SYNTHETIC_JWT_SECRET_LAB } from '@consubov/auth-client';

export type AdminRole = 'super_admin' | 'support_admin' | 'financial_admin';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  profile_id: 'administrador';
  tenant_id: string;
  fazenda_id: null;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
  mfa_verified: boolean;
  authenticated_at: string;
}

export const ADMIN_SESSION_STORAGE_KEY = 'consubov:admin-session';
export const LAB_MFA_CODE = '123456';

export interface SyntheticAdminCredential {
  email: string;
  name: string;
  role: AdminRole;
  defaultPassword: string;
}

export const SYNTHETIC_ADMIN_USERS: Record<string, SyntheticAdminCredential> = {
  'admin.lab@consubov.local': {
    email: 'admin.lab@consubov.local',
    name: 'Super Administrador Global',
    role: 'super_admin',
    defaultPassword: 'lab@123456'
  },
  'suporte.lab@consubov.local': {
    email: 'suporte.lab@consubov.local',
    name: 'Suporte Técnico N3',
    role: 'support_admin',
    defaultPassword: 'lab@123456'
  },
  'financeiro.lab@consubov.local': {
    email: 'financeiro.lab@consubov.local',
    name: 'Gestor Financeiro Corporativo',
    role: 'financial_admin',
    defaultPassword: 'lab@123456'
  }
};

export interface AdminAuthContextValue {
  session: AdminSession | null;
  pendingEmail: string | null;
  currentStep: 'credentials' | 'mfa';
  isLoading: boolean;
  errorMessageKey: string | null;
  submitCredentials: (email: string, password: string) => Promise<boolean>;
  verifyMfa: (code: string) => Promise<boolean>;
  cancelMfa: () => void;
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [session, setSession] = useState<AdminSession | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // Ignora falhas em testes ou ambientes restritos
    }
    return null;
  });

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'credentials' | 'mfa'>('credentials');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (session) {
          window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
        } else {
          window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        }
      }
    } catch {
      // noop
    }
  }, [session]);

  const submitCredentials = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessageKey(null);

    const normalizedEmail = email.trim().toLowerCase();
    const cred = SYNTHETIC_ADMIN_USERS[normalizedEmail];

    if (!cred || password !== cred.defaultPassword) {
      setIsLoading(false);
      setErrorMessageKey('admin.auth.errorInvalid');
      return false;
    }

    setPendingEmail(normalizedEmail);
    setCurrentStep('mfa');
    setIsLoading(false);
    return true;
  }, []);

  const verifyMfa = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessageKey(null);

    if (!pendingEmail) {
      setIsLoading(false);
      setCurrentStep('credentials');
      setErrorMessageKey('admin.auth.errorForbidden');
      return false;
    }

    const cleanCode = code.trim().replace(/\D/g, '');
    if (cleanCode !== LAB_MFA_CODE) {
      setIsLoading(false);
      setErrorMessageKey('admin.auth.errorTotp');
      return false;
    }

    const cred = SYNTHETIC_ADMIN_USERS[pendingEmail];
    if (!cred) {
      setIsLoading(false);
      setCurrentStep('credentials');
      setErrorMessageKey('admin.auth.errorForbidden');
      return false;
    }

    const user: AdminUser = {
      id: `usr-admin-${cred.role}`,
      email: cred.email,
      name: cred.name,
      role: cred.role,
      profile_id: 'administrador',
      tenant_id: '00000000-0000-4000-8000-000000000000',
      fazenda_id: null
    };

    // Assina JWT com claims globais administrativas
    const token = await signSyntheticJwt(
      {
        sub: user.id,
        user_id: user.id,
        email: user.email,
        name: user.name,
        profile_id: 'administrador',
        tenant_id: user.tenant_id,
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        product_id: 'consubov',
        roles: [cred.role],
        exp: Math.floor(Date.now() / 1000) + 86400
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    const newSession: AdminSession = {
      token,
      user,
      mfa_verified: true,
      authenticated_at: new Date().toISOString()
    };

    setSession(newSession);
    setPendingEmail(null);
    setCurrentStep('credentials');
    setIsLoading(false);
    return true;
  }, [pendingEmail]);

  const cancelMfa = useCallback(() => {
    setPendingEmail(null);
    setCurrentStep('credentials');
    setErrorMessageKey(null);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setPendingEmail(null);
    setCurrentStep('credentials');
    setErrorMessageKey(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      }
    } catch {
      // noop
    }
  }, []);

  const value: AdminAuthContextValue = {
    session,
    pendingEmail,
    currentStep,
    isLoading,
    errorMessageKey,
    submitCredentials,
    verifyMfa,
    cancelMfa,
    logout
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
