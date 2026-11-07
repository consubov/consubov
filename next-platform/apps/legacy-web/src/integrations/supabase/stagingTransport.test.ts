import { describe, expect, it, vi } from 'vitest';
import { createStagingTransport } from './stagingTransport';

const base = 'http://127.0.0.1:3333';
describe('Legacy v2.0.61 staging-only compatibility transport', () => {
  it('maps password login and refresh to isolated Bun API, not remote Supabase', async () => {
    const seen: Array<[URL, RequestInit | undefined]> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push([input as URL, init]);
      return new Response(JSON.stringify({ access_token: 'synthetic', user: { id: 'synthetic' } }), { status: 200 });
    });
    const run = createStagingTransport(base, fetcher);
    for (const grant of ['password','refresh_token']) {
      const response = await run(`${base}/auth/v1/token?grant_type=${grant}`, {
        method: 'POST', body: JSON.stringify({ email: 'test@example.com', password: 'test-secret' }),
        headers: { 'content-type': 'application/json', apikey: 'not-forwarded', cookie: 'not-forwarded' }
      });
      expect(response.status).toBe(200);
    }
    expect(seen).toHaveLength(2);
    for (const [url, init] of seen) {
      expect(url.origin).toBe(base);
      expect(url.pathname).toBe('/api/v1/compat/auth/token');
      expect(new Headers(init?.headers).has('apikey')).toBe(false);
      expect(new Headers(init?.headers).has('cookie')).toBe(false);
      expect(init?.credentials).toBe('omit');
    }
  });
  it('forwards user-scoped PostgREST SELECT without direct egress', async () => {
    const fetcher = vi.fn(async () => new Response('[{"id":1}]'));
    const response = await createStagingTransport(base, fetcher)(`${base}/rest/v1/fazendas?select=id`, {
      headers: { authorization: 'Bearer fake-token', prefer: 'count=exact' }
    });
    expect(response.status).toBe(200);
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/api/v1/compat/rest/fazendas');
    expect(url.search).toBe('?select=id');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer fake-token');
    expect(new Headers(init.headers).get('prefer')).toBe('count=exact');
  });
  it('rejects table writes without a durable idempotency key', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    await expect(createStagingTransport(base, fetcher)(`${base}/rest/v1/lancamentos`, {
      method: 'POST', body: '{"sacos":1}'
    })).rejects.toThrow('STAGING_MUTATION_REQUIRES_PERSISTENT_IDEMPOTENCY_KEY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards explicitly keyed writes and file uploads to backend only', async () => {
    const fetcher = vi.fn(async () => new Response('{"success":true}', { status: 201 }));
    const t = createStagingTransport(base, fetcher);
    await t(`${base}/rest/v1/lancamentos`, {
      method: 'POST', headers: { 'x-idempotency-key': 'command-fixed-stable-01', 'content-type': 'application/json' }, body: '{"id":"fixed"}'
    });
    await t(`${base}/storage/v1/object/relatorios/fabrica/file.jpg`, {
      method: 'POST', headers: { 'x-idempotency-key': 'attachment-fixed-stable-01', 'content-type': 'image/jpeg' },
      body: new Blob([new Uint8Array([255,216,255])], { type: 'image/jpeg' })
    });
    const calls = fetcher.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[0]![0].pathname).toBe('/api/v1/compat/rest/lancamentos');
    expect(calls[1]![0].pathname).toBe('/api/v1/compat/storage/object/relatorios/fabrica/file.jpg');
    expect(new Headers(calls[1]![1].headers).get('content-type')).toContain('image/jpeg');
  });
  it('never forwards remote URLs, unsupported auth routes or private storage buckets', async () => {
    const fetcher = vi.fn(async () => new Response('bad'));
    const t = createStagingTransport(base, fetcher);
    await expect(t('https://production-example.supabase.co/rest/v1/fazendas')).rejects.toThrow('STAGING_PROXY_EGRESS_DENIED');
    await expect(t(`${base}/auth/v1/signup`, { method: 'POST' })).rejects.toThrow('STAGING_PROXY_ENDPOINT_NOT_ALLOWED');
    await expect(t(`${base}/storage/v1/object/sign/secrets/user.png`)).rejects.toThrow('STAGING_PROXY_ENDPOINT_NOT_ALLOWED');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('creates a stable attachment key and checksum for the same immutable upload', async () => {
    const forwarded: Headers[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      forwarded.push(new Headers(init?.headers));
      return new Response('{"Key":"synthetic"}', { status: 200 });
    });
    const transport = createStagingTransport(base, fetcher);
    const options = () => ({ method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: 'image/png' })
    });
    await transport(`${base}/storage/v1/object/fotos-salga/users/photo.png`, options());
    await transport(`${base}/storage/v1/object/fotos-salga/users/photo.png`, options());
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0]!.get('x-attachment-sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(forwarded[0]!.get('x-idempotency-key')).toMatch(/^attachment-[0-9a-f]{64}$/);
    expect(forwarded[0]!.get('x-idempotency-key')).toBe(forwarded[1]!.get('x-idempotency-key'));
  });

  it('reuses the existing Capataz offline launch UUID as its stable sync key', async () => {
    const forwarded: Array<[URL, RequestInit]> = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      forwarded.push([url as URL, init!]); return new Response('{"ok":true}', {status:200});
    });
    const request = createStagingTransport(base, fetcher);
    const launchId = '550e8400-e29b-41d4-a716-446655440000';
    const options = () => ({ method:'POST', body:JSON.stringify({p_lancamento:{id:launchId,origem:'qr'}}),
      headers:{'content-type':'application/json'} });
    await request(base+'/rest/v1/rpc/sync_capataz_lancamento',options());
    await request(base+'/rest/v1/rpc/sync_capataz_lancamento',options());
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0]![0].pathname).toBe('/api/v1/compat/rpc/sync_capataz_lancamento');
    expect(new Headers(forwarded[0]![1].headers).get('x-idempotency-key')).toBe('capataz-sync-'+launchId);
    expect(new Headers(forwarded[1]![1].headers).get('x-idempotency-key')).toBe('capataz-sync-'+launchId);
  });

});
