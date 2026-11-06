import { describe, expect, it } from 'bun:test';
import type { AtomicCommandEnvelope, ModuleExecutionContext } from '@consubov/contracts';
import { createHttpSyncTransport } from './HttpSyncTransport';
import { SyncAuthorizationError } from './SilentSyncRunner';

const context: ModuleExecutionContext = { userId: 'user', tenantId: 'tenant', farmId: 'farm', retreatId: null, profileId: 'capataz', moduleId: 'capataz', deviceId: 'device', productId: 'consubov' };
const signal = () => new AbortController().signal;
const settings = { baseUrl: 'http://127.0.0.1:12345', context, getAccessToken: () => 'synthetic-shell-token', isActive: () => true };
const pull = { tenant_id: 'tenant', fazenda_id: 'farm', next_cursor: 'new-opaque', has_more: false, deltas: [], server_timestamp: new Date().toISOString() };

describe('shell HTTP sync boundary', () => {
  it('uses scoped bearer headers and retries an expired opaque cursor without erasing local data', async () => {
    const urls: URL[] = [];
    const transport = createHttpSyncTransport({ ...settings, fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(new URL(String(input)));
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-shell-token');
      expect(init?.redirect).toBe('error');
      return urls.length === 1 ? Response.json({ error: 'INVALID_CURSOR' }, { status: 400 }) : Response.json(pull);
    }) as unknown as typeof fetch });
    expect((await transport.pull('opaque-old', signal())).next_cursor).toBe('new-opaque');
    expect(urls[0]!.searchParams.get('since_cursor')).toBe('opaque-old');
    expect(urls[1]!.searchParams.has('since_cursor')).toBe(false);
    expect(urls[1]!.searchParams.get('profile_id')).toBe('capataz');
  });

  it('rejects authorization before parsing untrusted error bodies', async () => {
    const transport = createHttpSyncTransport({ ...settings, fetch: (async () => new Response('not-json', { status: 403 })) as unknown as typeof fetch });
    await expect(transport.pull(null, signal())).rejects.toBeInstanceOf(SyncAuthorizationError);
  });

  it('returns only strict, correctly identified command security DTOs for durable issue recording', async () => {
    const command = { command_id: 'security-command' } as AtomicCommandEnvelope;
    for (const status of [401, 403]) {
      const response = { success: false as const, security: { error: status === 401 ? 'UNAUTHORIZED_401' as const : 'FORBIDDEN_403' as const, command_id: command.command_id, reason: 'Grant no longer active' } };
      const valid = createHttpSyncTransport({ ...settings, fetch: (async () => Response.json(response, { status })) as unknown as typeof fetch });
      expect(await valid.push(command, signal())).toEqual(response);
      const foreign = createHttpSyncTransport({ ...settings, fetch: (async () => Response.json({ ...response, security: { ...response.security, command_id: 'foreign-command' } }, { status })) as unknown as typeof fetch });
      await expect(foreign.push(command, signal())).rejects.toBeInstanceOf(SyncAuthorizationError);
      const malformed = createHttpSyncTransport({ ...settings, fetch: (async () => new Response('not-json', { status })) as unknown as typeof fetch });
      await expect(malformed.push(command, signal())).rejects.toBeInstanceOf(SyncAuthorizationError);
    }
    const stalled = createHttpSyncTransport({ ...settings, requestTimeoutMs: 10, fetch: (async () => new Response(new ReadableStream({ start() { /* Rejection body never completes. */ } }), { status: 403 })) as unknown as typeof fetch });
    await expect(stalled.push(command, signal())).rejects.toBeInstanceOf(SyncAuthorizationError);
  });

  it('rejects a cross-farm response and insecure remote API URLs', async () => {
    const transport = createHttpSyncTransport({ ...settings, fetch: (async () => Response.json({ ...pull, fazenda_id: 'another-farm' })) as unknown as typeof fetch });
    await expect(transport.pull(null, signal())).rejects.toThrow('scope mismatch');
    expect(() => createHttpSyncTransport({ ...settings, baseUrl: 'http://remote.example' })).toThrow('HTTPS');
  });

  it('bounds a stalled fetch and a stalled response body with the same operation deadline', async () => {
    const fetchStall = createHttpSyncTransport({ ...settings, requestTimeoutMs: 10, fetch: (() => new Promise(() => undefined)) as unknown as typeof fetch });
    await expect(fetchStall.pull(null, signal())).rejects.toThrow('deadline');
    const bodyStall = createHttpSyncTransport({ ...settings, requestTimeoutMs: 10, fetch: (async () => new Response(new ReadableStream({ start() { /* Intentionally open body. */ } }))) as unknown as typeof fetch });
    await expect(bodyStall.pull(null, signal())).rejects.toThrow('deadline');
  });

  it('verifies downloaded binary hash/MIME/size and checks session after asynchronous reads', async () => {
    const blob = new Blob(['photo fixture'], { type: 'image/jpeg' });
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const ref = { attachment_id: 'photo', hash_sha256: hash, mime_type: blob.type, size_bytes: blob.size, local_blob_ref: 'photo-local' };
    const response = () => new Response(blob, { headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size), 'X-Attachment-Sha256': hash } });
    const transport = createHttpSyncTransport({ ...settings, fetch: (async () => response()) as unknown as typeof fetch });
    expect(await (await transport.download!(ref, signal())).text()).toBe('photo fixture');
    const corrupt = createHttpSyncTransport({ ...settings, fetch: (async () => new Response('wrong bytes!!', { headers: response().headers })) as unknown as typeof fetch });
    await expect(corrupt.download!(ref, signal())).rejects.toThrow();
    let active = true;
    const stale = createHttpSyncTransport({ ...settings, isActive: () => active, fetch: (async () => { active = false; return response(); }) as unknown as typeof fetch });
    await expect(stale.download!(ref, signal())).rejects.toThrow('Session ended');
  });
});

