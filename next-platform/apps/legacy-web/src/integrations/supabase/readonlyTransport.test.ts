import { describe, expect, it, vi } from 'vitest';
import { createReadOnlyTransport, localReadOnlyOrigin, READ_ONLY_SDK_URL } from './readonlyTransport';

describe('F23 legacy app read-only backend transport', () => {
  it('enforces local-only origin', () => {
    expect(localReadOnlyOrigin('http://127.0.0.1:3333')).toBe('http://127.0.0.1:3333');
    expect(localReadOnlyOrigin('https://app.consubov.com.br')).toBeNull();
    expect(localReadOnlyOrigin('http://127.0.0.1:3333/other')).toBeNull();
    expect(localReadOnlyOrigin('http://user:pass@127.0.0.1:3333')).toBeNull();
  });
  it('routes PostgREST reads through API, without leaking keys or cookies', async () => {
    const forward = vi.fn(async () => new Response('[{"id":"existing-farm"}]', { status: 200 }));
    const request = createReadOnlyTransport('http://127.0.0.1:3333', forward);
    const response = await request(`${READ_ONLY_SDK_URL}/rest/v1/fazendas?select=id,nome`, {
      headers: { authorization: 'Bearer existing-user-token', apikey: 'private-test', cookie: 'secret' },
    });
    expect(response.status).toBe(200);
    const [url, init] = forward.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.href).toBe('http://127.0.0.1:3333/api/v1/legacy/data/fazendas?select=id,nome');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer existing-user-token');
    expect(headers.has('apikey')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(init.credentials).toBe('omit');
  });
  it('blocks all writes and sign-in before network activity', async () => {
    const forward = vi.fn(async () => new Response('bad'));
    const request = createReadOnlyTransport('http://127.0.0.1:3333', forward);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await expect(request(`${READ_ONLY_SDK_URL}/rest/v1/fazendas`, { method })).rejects.toThrow('READ_ONLY_BRIDGE');
    }
    await expect(request(`${READ_ONLY_SDK_URL}/auth/v1/token?grant_type=password`, { method: 'POST' })).rejects.toThrow('READ_ONLY_BRIDGE');
    await expect(request(`${READ_ONLY_SDK_URL}/storage/v1/object/file`, { method: 'GET' })).rejects.toThrow('READ_ONLY_BRIDGE');
    expect(forward).not.toHaveBeenCalled();
  });
  it('blocks direct access to production host even for GET', async () => {
    const forward = vi.fn(async () => new Response('bad'));
    await expect(createReadOnlyTransport('http://127.0.0.1:3333', forward)('https://project.supabase.co/rest/v1/fazendas')).rejects.toThrow('READ_ONLY_BRIDGE');
    expect(forward).not.toHaveBeenCalled();
  });
});
