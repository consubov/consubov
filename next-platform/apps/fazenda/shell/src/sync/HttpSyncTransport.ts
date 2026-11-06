import { commandApiResponseSchema, syncPullResponseSchema, type AtomicCommandEnvelope, type AttachmentRef, type ModuleExecutionContext } from '@consubov/contracts';
import { SyncAuthorizationError, type SyncTransport } from './SilentSyncRunner';

/** The token provider belongs to the shell session and is never passed into an iframe. */
export function createHttpSyncTransport(options: {
  baseUrl: string;
  context: ModuleExecutionContext;
  getAccessToken: () => string | null;
  isActive: () => boolean;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}): SyncTransport {
  const base = new URL(options.baseUrl);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('Sync requires HTTPS outside the local laboratory');
  if (base.username || base.password || base.search || base.hash) throw new Error('Invalid API base URL');
  const context = { ...options.context };
  const request = async <T>(path: string, init: RequestInit, signal: AbortSignal, consume: (response: Response) => Promise<T>, allowCommandSecurity = false): Promise<T> => {
    if (signal.aborted || !options.isActive()) throw new DOMException('Session ended', 'AbortError');
    const token = options.getAccessToken();
    if (!token) throw new SyncAuthorizationError('Session credential unavailable');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Sync HTTP deadline exceeded', 'TimeoutError')), options.requestTimeoutMs ?? 30_000);
    let rejectAbort!: (reason: unknown) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    try {
      const operation = async () => {
        const response = await (options.fetch ?? fetch)(new URL(path, base), { ...init, headers, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
        if (controller.signal.aborted || !options.isActive()) throw new DOMException('Session ended', 'AbortError');
        if (!allowCommandSecurity && (response.status === 401 || response.status === 403)) throw new SyncAuthorizationError('Session authorization requires authentication');
        const result = await consume(response);
        if (controller.signal.aborted || !options.isActive()) throw new DOMException('Session ended', 'AbortError');
        return result;
      };
      return await Promise.race([operation(), aborted]);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', onAbort);
    }
  };
  return {
    async download(ref, signal) {
      return request(`/api/v1/attachments/${encodeURIComponent(ref.attachment_id)}`, { method: 'GET' }, signal, async response => {
      if (!response.ok) throw new Error(`Attachment HTTP ${response.status}`);
      if (response.headers.get('Content-Type') !== ref.mime_type || response.headers.get('X-Attachment-Sha256') !== ref.hash_sha256 || Number(response.headers.get('Content-Length')) !== ref.size_bytes) throw new Error('Attachment response metadata mismatch');
      const blob = await response.blob();
      if (blob.size !== ref.size_bytes || blob.type !== ref.mime_type) throw new Error('Attachment body mismatch');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), value => value.toString(16).padStart(2, '0')).join('');
      if (hash !== ref.hash_sha256.toLowerCase()) throw new Error('Attachment body integrity mismatch');
      if (signal.aborted || !options.isActive()) throw new DOMException('Session ended', 'AbortError');
      return blob;
      });
    },
    async upload(ref: AttachmentRef, blob: Blob, signal) {
      if (blob.type !== ref.mime_type || blob.size !== ref.size_bytes) throw new Error('Attachment metadata mismatch');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (hash !== ref.hash_sha256.toLowerCase()) throw new Error('Attachment integrity mismatch');
      await request(`/api/v1/attachments/${encodeURIComponent(ref.attachment_id)}`, { method: 'PUT', body: blob, headers: {
        'Content-Type': ref.mime_type, 'X-Attachment-Sha256': ref.hash_sha256,
        'X-Attachment-Size': String(ref.size_bytes), 'X-Attachment-Local-Ref': ref.local_blob_ref
      } }, signal, async response => {
      if (!response.ok) throw new Error(`Attachment HTTP ${response.status}`);
      const ack = await response.json() as Record<string, unknown>;
      for (const key of ['attachment_id', 'hash_sha256', 'mime_type', 'size_bytes', 'local_blob_ref'] as const) {
        if (ack[key] !== ref[key]) throw new Error('Attachment ACK mismatch');
      }
      });
    },
    async push(command: AtomicCommandEnvelope, signal) {
      let authorizationDenied = false;
      try { return await request('/api/v1/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) }, signal, async response => {
      if (response.status === 401 || response.status === 403) {
        authorizationDenied = true;
        let body: unknown;
        try { body = await response.json(); } catch { throw new SyncAuthorizationError('Session authorization requires authentication'); }
        const parsed = commandApiResponseSchema.safeParse(body);
        const expectedError = response.status === 401 ? 'UNAUTHORIZED_401' : 'FORBIDDEN_403';
        if (!parsed.success || parsed.data.success || !('security' in parsed.data) || parsed.data.security.command_id !== command.command_id || parsed.data.security.error !== expectedError) throw new SyncAuthorizationError('Session authorization requires authentication');
        return parsed.data;
      }
      if (!response.ok && response.status !== 409 && response.status !== 422) throw new Error(`Command HTTP ${response.status}`);
      const result = commandApiResponseSchema.parse(await response.json());
      if (response.ok !== result.success) throw new Error('Command status mismatch');
      return result;
      }, true); } catch (error) {
        // A rejected credential pauses this session even if its optional error
        // body stalls; an unidentified body must never create a local issue.
        if (authorizationDenied && !signal.aborted && options.isActive()) throw new SyncAuthorizationError('Session authorization requires authentication');
        throw error;
      }
    },
    async pull(cursor, signal) {
      const query = new URLSearchParams({ tenant_id: context.tenantId, fazenda_id: context.farmId, profile_id: context.profileId, limit: '500' });
      if (cursor !== null) query.set('since_cursor', cursor);
      const readPull = () => request(`/api/v1/sync?${query}`, { method: 'GET' }, signal, async response => {
        if (response.status === 400 && cursor !== null && (await response.clone().json() as { error?: string }).error === 'INVALID_CURSOR') return null;
        if (!response.ok) throw new Error(`Pull HTTP ${response.status}`);
        const pull = syncPullResponseSchema.parse(await response.json());
        if (pull.tenant_id !== context.tenantId || pull.fazenda_id !== context.farmId) throw new Error('Pull scope mismatch');
        return pull;
      });
      let pull = await readPull();
      if (pull === null) {
        // Cursors are server/session scoped. Retry from an authoritative full
        // projection without erasing the durable cursor or any optimistic data.
        query.delete('since_cursor');
        pull = await readPull();
      }
      if (pull === null) throw new Error('Pull cursor reset rejected');
      return pull;
    }
  };
}
