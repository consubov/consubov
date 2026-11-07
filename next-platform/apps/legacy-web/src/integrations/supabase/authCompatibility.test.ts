import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createStagingTransport } from './stagingTransport';

const STAGE = 'http://127.0.0.1:3333';
const USER = { id: '550e8400-e29b-41d4-a716-446655440000', aud: 'authenticated', role: 'authenticated',
  email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

describe('F23 original Supabase SDK auth via isolated Bun compatibility port', () => {
  it('signs in, refreshes, gets user and signs out against synthetic HTTP only', async () => {
    const paths: string[] = [];
    const stub = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); paths.push(url.pathname);
      if (url.pathname === '/api/v1/compat/auth/token') return new Response(JSON.stringify({
        access_token: 'fake-access-token', refresh_token: 'fake-refresh-token', token_type: 'bearer', expires_in: 3600,
        user: USER
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.pathname === '/api/v1/compat/auth/user') return new Response(JSON.stringify(USER), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.pathname === '/api/v1/compat/auth/logout') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ message: 'Route not found' }), { status: 404 });
    });
    const client = createClient(STAGE, 'sb_publishable_synthetic-only', {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: createStagingTransport(STAGE, stub) }
    });
    try {
      const signedIn = await client.auth.signInWithPassword({ email: 'synthetic@example.invalid', password: 'test-only' });
      expect(signedIn.error).toBeNull();
      expect(signedIn.data.session?.refresh_token).toBe('fake-refresh-token');
      const refreshed = await client.auth.refreshSession();
      expect(refreshed.error).toBeNull();
      const profile = await client.auth.getUser();
      expect(profile.data.user?.id).toBe(USER.id);
      expect((await client.auth.signOut()).error).toBeNull();
      expect(paths).toEqual([
        '/api/v1/compat/auth/token', '/api/v1/compat/auth/token',
        '/api/v1/compat/auth/user', '/api/v1/compat/auth/logout'
      ]);
      expect(paths.every(p => p.startsWith('/api/v1/compat/'))).toBe(true);
    } finally {
      client.auth.stopAutoRefresh();
    }
  });
});
