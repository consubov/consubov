/**
 * Explicit STAGING-ONLY adapter for the original v2.0.61 Supabase SDK calls.
 * Nothing here points to an existing production database or embeds a key.
 * Mutations without a caller-stable idempotency key fail closed (the old UI
 * must be migrated command-by-command before activating writes).
 */
import { localReadOnlyOrigin } from './readonlyTransport';

const STORAGE_BUCKETS = new Set(['relatorios','mapas','landing','logos-consultor','despesas-consultor-fotos','fotos-salga']);
const SAFE_HEADERS = ['authorization','content-type','accept','prefer','range','range-unit',
  'accept-profile','content-profile','x-upsert','if-match','x-idempotency-key'];

function route(url: URL): string | null {
  let m = /^\/auth\/v1\/(token|user|logout|recover)$/.exec(url.pathname);
  if (m) return '/api/v1/compat/auth/' + m[1];
  m = /^\/rest\/v1\/rpc\/([a-z][a-z0-9_]*)$/.exec(url.pathname);
  if (m) return '/api/v1/compat/rpc/' + m[1];
  m = /^\/rest\/v1\/([a-z][a-z0-9_]*)$/.exec(url.pathname);
  if (m) return '/api/v1/compat/rest/' + m[1];
  m = /^\/functions\/v1\/([a-z][a-z0-9_-]*)$/.exec(url.pathname);
  if (m) return '/api/v1/compat/functions/' + m[1];
  m = /^\/storage\/v1\/object\/(public\/)?([a-z][a-z0-9-]*)\/(.+)$/.exec(url.pathname);
  if (m && STORAGE_BUCKETS.has(m[2]!) && /^[a-zA-Z0-9_./-]{1,420}$/.test(m[3]!)) {
    return '/api/v1/compat/storage/object/' + (m[1] ?? '') + m[2] + '/' + m[3];
  }
  return null;
}

export function createStagingTransport(
  localOrigin: string,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): typeof fetch {
  if (localReadOnlyOrigin(localOrigin) !== localOrigin) throw new Error('STAGING_BRIDGE_MUST_BE_LOCAL');
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const original = input instanceof Request ? input : new Request(input, init);
    const url = new URL(original.url);
    if (url.origin !== localOrigin) throw new Error('STAGING_PROXY_EGRESS_DENIED');
    const backend = route(url);
    if (!backend) throw new Error('STAGING_PROXY_ENDPOINT_NOT_ALLOWED');
    const method = (init?.method ?? original.method).toUpperCase();
    const headers = new Headers(original.headers);
    if (init?.headers) new Headers(init.headers).forEach((value,key) => headers.set(key,value));
    const forwarded = new Headers();
    for (const name of SAFE_HEADERS) {
      const v = headers.get(name);
      if (v) forwarded.set(name,v);
    }
    const authenticating = backend.startsWith('/api/v1/compat/auth/');
    // Existing Capataz offline queue already persists an immutable UUID per
    // launch. Reuse that identity across retries instead of generating a new key.
    if (backend === '/api/v1/compat/rpc/sync_capataz_lancamento' && method === 'POST' &&
        !forwarded.has('x-idempotency-key')) {
      let commandId: unknown;
      try {
        const parsed = JSON.parse(await original.clone().text());
        commandId = parsed?.p_lancamento?.id;
      } catch { throw new Error('CAPATAZ_SYNC_INVALID_PAYLOAD'); }
      if (typeof commandId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) {
        throw new Error('CAPATAZ_SYNC_STABLE_ID_REQUIRED');
      }
      forwarded.set('x-idempotency-key', 'capataz-sync-' + commandId);
    }
    const upload = backend.startsWith('/api/v1/compat/storage/object/') && ['POST','PUT'].includes(method);
    if (upload) {
      const bytes = new Uint8Array(await original.clone().arrayBuffer());
      if (bytes.byteLength > 12_000_000) throw new Error('STAGING_ATTACHMENT_TOO_LARGE');
      if (!globalThis.crypto?.subtle) throw new Error('STAGING_ATTACHMENT_DIGEST_UNAVAILABLE');
      const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(n => n.toString(16).padStart(2, '0')).join('');
      forwarded.set('x-attachment-sha256', hex);
      if (!forwarded.has('x-idempotency-key')) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(method + backend + '\0' + hex));
        const key = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
        forwarded.set('x-idempotency-key', 'attachment-' + key);
      }
    }
    if (!['GET','HEAD'].includes(method) && !authenticating && !forwarded.has('x-idempotency-key')) {
      throw new Error('STAGING_MUTATION_REQUIRES_PERSISTENT_IDEMPOTENCY_KEY');
    }
    const proxied = new URL(backend + url.search, localOrigin);
    return fetcher(proxied, {
      method, headers: forwarded, redirect: 'error', credentials: 'omit',
      ...(!['GET','HEAD'].includes(method) ? { body: init?.body ?? (input instanceof Request ? input.body : original.body) } : {})
    });
  };
}
