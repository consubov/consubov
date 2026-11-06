import { describe, expect, it } from 'bun:test';
import React, { useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { ProvisionedAuthService, type AuthResult, type SyntheticUserSession } from '@consubov/auth-client/browser';
import { globalQuiescenceRegistry as registry } from '@consubov/module-release';
import { AuthContext, AuthProvider, type AuthContextValue } from './AuthContext';

function callbacks(service: ProvisionedAuthService): AuthContextValue {
  let value!: AuthContextValue;
  function Capture() { value = useContext(AuthContext)!; return null; }
  renderToString(<AuthProvider authService={service}><Capture /></AuthProvider>);
  return value;
}

describe('root authentication quiescence', () => {
  for (const method of ['login', 'selectContext', 'switchContext'] as const) {
    const invoke = (auth: AuthContextValue) => method === 'login'
      ? auth.login({ email: 'local@example.test', password: 'password' }) : auth[method]('membership');

    it(`${method} holds activation until the real operation settles, including rejection`, async () => {
      for (const reject of [false, true]) {
        const service = new ProvisionedAuthService();
        let finish!: () => void;
        const pending = new Promise<void>(resolve => { finish = resolve; });
        service[method] = async () => { await pending; if (reject) throw new Error('storage failed'); return { success: false }; };
        const operation = invoke(callbacks(service));
        expect(registry.hasLockType('LOCAL_DB_TRANSACTION')).toBe(true);
        expect(registry.prepareActivation()).toBeNull();
        finish();
        if (reject) await expect(operation).rejects.toThrow('storage failed');
        else expect((await operation).success).toBe(false);
        expect(registry.isQuiescent()).toBe(true);
      }
    });

    it(`${method} cannot begin while activation is frozen`, async () => {
      const service = new ProvisionedAuthService();
      let calls = 0;
      service[method] = async () => { calls++; return { success: false }; };
      const auth = callbacks(service);
      const lease = registry.prepareActivation()!;
      try {
        expect((await invoke(auth)).success).toBe(false);
        expect(calls).toBe(0);
        expect(registry.validateActivationLease(lease.leaseId)).toBe(true);
      } finally { registry.releaseActivation(lease.leaseId); }
    });

    it(`${method} rejects an otherwise successful stale result after logout`, async () => {
      const service = new ProvisionedAuthService();
      let finish!: (result: AuthResult) => void;
      service[method] = () => new Promise(resolve => { finish = resolve; });
      const auth = callbacks(service);
      const operation = invoke(auth);
      auth.logout();
      finish({ success: true, session: { session_id: 'ended-session' } as SyntheticUserSession });
      expect((await operation).success).toBe(false);
      expect(registry.isQuiescent()).toBe(true);
    });

    it(`${method} reports success only after the current session is committed`, async () => {
      const service = new ProvisionedAuthService();
      const session: SyntheticUserSession = {
        session_id: 'current', user_id: 'user', user_name: 'Local', user_email: 'local@example.test',
        profile_id: 'capataz', memberships: [], active_context: null,
        issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), device_id: 'device'
      };
      service[method] = async () => {
        expect(registry.hasLockType('LOCAL_DB_TRANSACTION')).toBe(true);
        service.getSessionManager().setSession(session);
        return { success: true, session };
      };
      expect((await invoke(callbacks(service))).success).toBe(true);
      expect(registry.isQuiescent()).toBe(true);
    });
  }
});
