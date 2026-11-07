/**
 * F23 compatibility transport. The v2.0.61 UI stays unchanged; only GET/HEAD
 * PostgREST reads may reach the new Bun API. No auth, writes, RPC or uploads.
 */
export const READ_ONLY_SDK_URL = 'https://read-only.consubov.invalid';

export function localReadOnlyOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createReadOnlyTransport(
  localOrigin: string,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): typeof fetch {
  if (localReadOnlyOrigin(localOrigin) !== localOrigin) throw new Error('Read-only gateway origin must be local.');
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) throw new Error('READ_ONLY_BRIDGE: writes and authentication sessions are disabled.');
    if (originalUrl.origin !== READ_ONLY_SDK_URL) throw new Error('READ_ONLY_BRIDGE: untrusted request origin.');
    const path = /^\/rest\/v1\/([a-z][a-z0-9_]*)$/.exec(originalUrl.pathname);
    if (!path) throw new Error('READ_ONLY_BRIDGE: endpoint blocked.');
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const forwarded = new Headers();
    const authorization = headers.get('authorization');
    if (authorization) forwarded.set('authorization', authorization);
    const prefer = headers.get('prefer');
    if (prefer) forwarded.set('prefer', prefer);
    const proxy = new URL(`/api/v1/legacy/data/${path[1]}`, localOrigin);
    proxy.search = originalUrl.search;
    return fetcher(proxy, { method, headers: forwarded, redirect: 'error', credentials: 'omit' });
  };
}
