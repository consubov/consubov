// Independent wire implementation: no React, TypeScript or CONSUBOV imports.
export async function startPortableModule({ wasmBytes, parentWindow, nonce, moduleId, onResult }) {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const protocolVersion = instance.exports.protocol_version();
  let bound = false;
  const checks = [];
  const check = (name, valid) => { if (!valid) throw new Error(name); checks.push(name); };
  const receive = async event => {
    const init = event.data;
    if (bound || event.source !== parentWindow || event.ports.length !== 1 || init?.kind !== 'shell:init' ||
        init.protocolVersion !== protocolVersion || init.nonce !== nonce || init.moduleId !== moduleId ||
        init.context?.moduleId !== moduleId || init.context?.profileId !== moduleId ||
        !init.capabilities?.includes('local-data.read')) return;
    bound = true;
    const port = event.ports[0];
    const pending = new Map();
    port.onmessage = ({ data }) => {
      if (data?.kind !== 'response' || data.protocolVersion !== protocolVersion || data.nonce !== nonce || data.moduleId !== moduleId) return;
      const resolve = pending.get(data.requestId);
      if (resolve) { pending.delete(data.requestId); resolve(data); }
    };
    port.start();
    const trace = value => parentWindow.postMessage({ kind: 'fixture:trace', nonce, value }, '*');
    const request = async (method, payload = {}, overrides = {}) => {
      const value = { kind: 'request', protocolVersion, moduleId, nonce, requestId: crypto.randomUUID(), method, payload, ...overrides };
      trace(value);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(value.requestId); reject(new Error(`RPC timeout: ${method}`)); }, 8000);
        pending.set(value.requestId, response => { clearTimeout(timer); resolve(response); });
        port.postMessage(value);
      });
    };
    const call = async (method, payload = {}) => {
      const response = await request(method, payload);
      if (!response.ok) throw new Error(`${method}: ${response.error?.code}`);
      return response.result;
    };
    const control = action => new Promise(resolve => {
      const receiveControl = event => {
        if (event.source === parentWindow && event.data?.kind === 'fixture:controlled' && event.data.nonce === nonce) {
          window.removeEventListener('message', receiveControl); resolve();
        }
      };
      window.addEventListener('message', receiveControl);
      parentWindow.postMessage({ kind: 'fixture:control', nonce, action }, '*');
    });
    const ready = { kind: 'module:ready', protocolVersion, moduleId, profileId: moduleId, nonce };
    trace(ready); port.postMessage(ready);
    try {
      check('Rust protocol/schema validator', protocolVersion === 1 && instance.exports.supports_local_schema(1) === 1 && instance.exports.supports_local_schema(2) === 1 && instance.exports.supports_local_schema(3) === 0);
      check('getSchemaVersion', instance.exports.supports_local_schema(await call('getSchemaVersion')) === 1);
      check('readSnapshot empty', await call('readSnapshot', { aggregateType: 'cocho', aggregateId: 'portable-cocho' }) === null);
      check('listSnapshots empty', (await call('listSnapshots')).length === 0);
      check('getCursor empty', await call('getCursor') === null);
      check('listOperationIssues empty', (await call('listOperationIssues', { limit: 10 })).length === 0);
      const ref = { attachment_id: crypto.randomUUID(), mime_type: 'image/jpeg', size_bytes: 4,
        hash_sha256: '32461d5bd1773012acef0ba15636752949bd7c2ce50a7a418b7ce7d57b177d09', local_blob_ref: 'portable-photo' };
      // JPEG marker bytes; hash supplied externally below after WebCrypto in the shell-free module.
      const bytes = new Uint8Array([255, 216, 255, 217]);
      ref.hash_sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      const c = init.context;
      const mutation = {
        command: { command_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID(), command_type: 'capataz.cocho.registrar_escore',
          aggregate_type: 'cocho', aggregate_id: 'portable-cocho', base_version: 0, user_id: c.userId, tenant_id: c.tenantId,
          product_id: c.productId, fazenda_id: c.farmId, retiro_id: c.retreatId, profile_id: c.profileId, device_id: c.deviceId,
          schema_version: 1, payload: { score: 2 }, correlation_id: crypto.randomUUID(), attachment_refs: [ref],
          occurred_at_local: new Date().toISOString(), status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null },
        snapshot: { aggregateType: 'cocho', aggregateId: 'portable-cocho', version: 1, data: { score: 2 }, modifiedAt: new Date().toISOString() },
        attachments: [{ ref, blob: new Blob([bytes], { type: ref.mime_type }) }]
      };
      if (!init.capabilities.includes('local-data.write')) {
        check('missing write capability rejected', (await request('commitMutation', mutation)).error?.code === 'FORBIDDEN');
        check('forbidden write leaves snapshots empty', (await call('listSnapshots')).length === 0);
        check('forbidden write leaves outbox empty', (await call('listPendingCommands', { limit: 10 })).length === 0);
      } else {
        check('commitMutation atomic success', (await call('commitMutation', mutation)).committed === true);
        check('readSnapshot committed', (await call('readSnapshot', { aggregateType: 'cocho', aggregateId: 'portable-cocho' })).data.score === 2);
        check('listSnapshots filtered', (await call('listSnapshots', { aggregateType: 'cocho' })).length === 1);
        const pendingCommands = await call('listPendingCommands', { limit: 10 });
        check('outbox and shared attachment refs', pendingCommands.length === 1 && pendingCommands[0].command.command_id === mutation.command.command_id && pendingCommands[0].attachmentRefs[0].attachment_id === ref.attachment_id);
        const photo = await call('readAttachment', { attachmentId: ref.attachment_id });
        check('photo native Blob bytes', photo.blob instanceof Blob && Array.from(new Uint8Array(await photo.blob.arrayBuffer())).join(',') === bytes.join(',') && photo.ref.hash_sha256 === ref.hash_sha256);
        // New command ID with stale aggregate base must fail without a second outbox entry.
        const stale = structuredClone(mutation); stale.command.command_id = crypto.randomUUID(); stale.command.idempotency_key = crypto.randomUUID();
        stale.snapshot.data.score = 99;
        check('stale mutation rejected', (await request('commitMutation', stale)).error?.code === 'MODULE_FAILURE');
        check('failed mutation preserves snapshot/outbox', (await call('listSnapshots'))[0].data.score === 2 && (await call('listPendingCommands', { limit: 10 })).length === 1);
        const foreign = structuredClone(mutation); foreign.command.tenant_id = 'foreign-tenant';
        check('foreign tenant mutation rejected', (await request('commitMutation', foreign)).error?.code === 'MODULE_FAILURE');
      }
      check('readAttachment missing', await call('readAttachment', { attachmentId: crypto.randomUUID() }) === null);
      check('foreign nonce rejected', (await request('getCursor', {}, { nonce: crypto.randomUUID() })).error?.code === 'INVALID_MESSAGE');
      check('foreign module rejected', (await request('getCursor', {}, { moduleId: 'gerente' })).error?.code === 'INVALID_MESSAGE');
      check('unsupported protocol rejected', (await request('getCursor', {}, { protocolVersion: 2 })).error?.code === 'UNSUPPORTED_PROTOCOL');
      check('injected caller context rejected', (await request('getCursor', { context: c })).error?.code === 'INVALID_MESSAGE');
      check('invalid method rejected', (await request('eraseEverything')).error?.code === 'INVALID_MESSAGE');
      await control('expire-session');
      check('expired session rejected', (await request('getCursor')).error?.code === 'UNAUTHORIZED');
      onResult({ ok: true, checks });
    } catch (error) { onResult({ ok: false, checks, error: String(error) }); }
    finally { port.close(); }
  };
  window.addEventListener('message', receive);
  const hello = { kind: 'module:hello', protocolVersion, moduleId, profileId: moduleId, version: '0.1.0', nonce };
  parentWindow.postMessage({ kind: 'fixture:trace', nonce, value: hello }, '*');
  parentWindow.postMessage(hello, '*');
}
