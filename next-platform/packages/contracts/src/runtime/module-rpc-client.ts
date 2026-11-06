import {
  moduleRpcResponseSchema,
  shellDataChangedSchema,
  type FazendaModuleId,
  type ModuleRpcMethod,
  type ModuleRpcPayloads,
  type ModuleRpcResults
} from './module-protocol';
import type { LocalMutation, LocalPendingCommand, LocalSnapshot, LocalMutationResult } from './local-data';
import type { AttachmentRef } from '../envelope';
import type { OperationIssue } from './operation-issues';

export interface ModuleLocalDataAPI {
  readSnapshot<T = Record<string, unknown>>(aggregateType: string, aggregateId: string): Promise<LocalSnapshot<T> | null>;
  listSnapshots<T = Record<string, unknown>>(aggregateType?: string): Promise<readonly LocalSnapshot<T>[]>;
  commitMutation<T>(mutation: LocalMutation<T>): Promise<LocalMutationResult>;
  readAttachment(attachmentId: string): Promise<{ ref: AttachmentRef; blob: Blob } | null>;
  listPendingCommands(limit: number): Promise<readonly LocalPendingCommand[]>;
  listOperationIssues?(limit: number): Promise<readonly OperationIssue[]>;
  getCursor(): Promise<string | null>;
  getSchemaVersion(): Promise<number>;
  /** Optional for older protocol-v1 clients; carries no data or sync status. */
  subscribeToChanges?(listener: () => void): () => void;
}

export interface ModuleRpcClient {
  call<M extends ModuleRpcMethod>(method: M, payload: ModuleRpcPayloads[M]): Promise<ModuleRpcResults[M]>;
  close(reason?: string): void;
  subscribeToChanges?(listener: () => void): () => void;
}

export function createModuleLocalDataAPI(client: ModuleRpcClient): ModuleLocalDataAPI {
  return {
    readSnapshot: <T>(aggregateType: string, aggregateId: string) => client.call('readSnapshot', { aggregateType, aggregateId }) as Promise<LocalSnapshot<T> | null>,
    listSnapshots: <T>(aggregateType?: string) => client.call('listSnapshots', { aggregateType }) as Promise<readonly LocalSnapshot<T>[]>,
    commitMutation: mutation => client.call('commitMutation', mutation),
    readAttachment: attachmentId => client.call('readAttachment', { attachmentId }),
    listPendingCommands: limit => client.call('listPendingCommands', { limit }),
    listOperationIssues: limit => client.call('listOperationIssues', { limit }),
    getCursor: () => client.call('getCursor', {}),
    getSchemaVersion: () => client.call('getSchemaVersion', {}),
    subscribeToChanges: listener => client.subscribeToChanges?.(listener) ?? (() => undefined)
  };
}

export function createModuleRpcClient(
  port: MessagePort,
  identity: { moduleId: FazendaModuleId; nonce: string },
  options: { timeoutMs?: number; maxInFlight?: number; onMutationStart?: () => (() => void) } = {}
): ModuleRpcClient {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxInFlight = options.maxInFlight ?? 32;
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: number }>();
  let closed = false;
  const changeListeners = new Set<() => void>();

  const failAll = (reason: string) => {
    closed = true;
    for (const request of pending.values()) {
      window.clearTimeout(request.timer);
      request.reject(new Error(reason));
    }
    pending.clear();
    changeListeners.clear();
  };
  port.addEventListener('message', event => {
    const changed = shellDataChangedSchema.safeParse(event.data);
    if (changed.success) {
      if (closed || changed.data.moduleId !== identity.moduleId || changed.data.nonce !== identity.nonce) return;
      for (const listener of changeListeners) {
        try { listener(); } catch { /* Consumer failures must not break RPC delivery. */ }
      }
      return;
    }
    const parsed = moduleRpcResponseSchema.safeParse(event.data);
    if (!parsed.success || parsed.data.moduleId !== identity.moduleId || parsed.data.nonce !== identity.nonce) return;
    const request = pending.get(parsed.data.requestId);
    if (!request) return;
    pending.delete(parsed.data.requestId);
    window.clearTimeout(request.timer);
    if (parsed.data.ok) request.resolve(parsed.data.result);
    else {
      const error = new Error(`${parsed.data.error.code}: ${parsed.data.error.message}`);
      if (parsed.data.error.code === 'STORAGE_QUOTA') error.name = 'QuotaExceededError';
      request.reject(error);
    }
  });
  port.onmessageerror = () => failAll('A resposta do shell não pôde ser lida.');
  port.start();

  return {
    subscribeToChanges(listener) {
      if (closed) return () => undefined;
      changeListeners.add(listener);
      return () => { changeListeners.delete(listener); };
    },
    call<M extends ModuleRpcMethod>(method: M, payload: ModuleRpcPayloads[M]): Promise<ModuleRpcResults[M]> {
      if (closed) return Promise.reject(new Error('Canal do shell encerrado.'));
      if (pending.size >= maxInFlight) return Promise.reject(new Error('Limite de solicitações locais simultâneas atingido.'));
      let release: (() => void) | undefined;
      try { if (method === 'commitMutation') release = options.onMutationStart?.(); }
      catch (error) { return Promise.reject(error); }
      const requestId = crypto.randomUUID();
      return new Promise<ModuleRpcResults[M]>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending.delete(requestId);
          release?.();
          reject(new Error('TIMEOUT: Solicitação local expirou.'));
        }, timeoutMs);
        pending.set(requestId, {
          resolve: value => { release?.(); resolve(value as ModuleRpcResults[M]); },
          reject: error => { release?.(); reject(error); }, timer
        });
        try {
          port.postMessage({ protocolVersion: 1, kind: 'request', moduleId: identity.moduleId, nonce: identity.nonce, requestId, method, payload });
        } catch {
          const request = pending.get(requestId);
          if (request) window.clearTimeout(request.timer);
          pending.delete(requestId);
          release?.();
          reject(new Error('INVALID_MESSAGE: Solicitação local não pôde ser enviada.'));
        }
      });
    },
    close(reason = 'Canal do shell encerrado.') {
      failAll(reason);
      port.close();
    }
  };
}
