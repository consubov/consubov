import { createIsolatedModuleDocument } from '../../../apps/fazenda/shell/src/pwa/isolatedModuleDocument';
import type { PinnedModuleGeneration } from '../src/generation';
import { IndexedDbLocalData } from '../../local-data/src';
import type { ModuleExecutionContext } from '@consubov/contracts';
const target = window as unknown as { readPinnedDocument: typeof createIsolatedModuleDocument; releaseMessage: (type: string, payload?: Record<string, unknown>, waiting?: boolean) => Promise<any>; fixtureVersions: string[] };
target.readPinnedDocument = createIsolatedModuleDocument;
target.fixtureVersions = [];
window.addEventListener('message', event => { if (event.data?.kind === 'fixture-version') target.fixtureVersions.push(event.data.version); });
target.releaseMessage = async (type, payload = {}, waiting = false) => {
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = waiting ? (registration?.waiting ?? registration?.active) : navigator.serviceWorker.controller;
  if (!worker) throw new Error('Worker unavailable');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(); const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Worker fixture operation timed out')); }, 15000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    worker.postMessage({ type, ...(type === 'ACTIVATE_WITH_CONSENT' ? { clientDeadline: Date.now() + 10000 } : {}), ...payload }, [channel.port2]);
  });
};
export type FixtureGeneration = PinnedModuleGeneration;

(window as any).seedPreservationFixture = async () => {
  const context: ModuleExecutionContext = { userId: crypto.randomUUID(), tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null, moduleId: 'capataz', profileId: 'capataz', deviceId: crypto.randomUUID(), productId: 'consubov' };
  const local = new IndexedDbLocalData(context);
  const blob = new Blob([new Uint8Array([255,216,255,1])], { type: 'image/jpeg' });
  const commandId = crypto.randomUUID(); const attachmentId = crypto.randomUUID();
  const ref = { attachment_id: attachmentId, mime_type: blob.type, size_bytes: blob.size, hash_sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''), local_blob_ref: 'fixture-photo' };
  await local.commitMutation(context, {
    command: { command_id: commandId, idempotency_key: crypto.randomUUID(), command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho', aggregate_id: 'fixture-aggregate', base_version: 0, user_id: context.userId, tenant_id: context.tenantId, fazenda_id: context.farmId, retiro_id: context.retreatId, product_id: context.productId, profile_id: context.profileId, device_id: context.deviceId, schema_version: 1, payload: { score: 2 }, correlation_id: crypto.randomUUID(), attachment_refs: [ref], occurred_at_local: new Date().toISOString(), status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null },
    snapshot: { aggregateType: 'cocho', aggregateId: 'fixture-aggregate', version: 1, data: { score: 2 }, modifiedAt: new Date().toISOString() }, attachments: [{ ref, blob }]
  });
  return { context, commandId, attachmentId };
};
(window as any).checkPreservationFixture = async (fixture: { context: ModuleExecutionContext; commandId: string; attachmentId: string }) => {
  const local = new IndexedDbLocalData(fixture.context);
  const pending = await local.listPendingCommands(fixture.context, 10); const photo = await local.readAttachment(fixture.context, fixture.attachmentId);
  const snapshot = await local.readSnapshot(fixture.context, 'cocho', 'fixture-aggregate');
  return pending.length === 1 && pending[0]!.command.command_id === fixture.commandId && pending[0]!.command.attempts === 0 && snapshot?.version === 1 && photo && JSON.stringify([...new Uint8Array(await photo.blob.arrayBuffer())]) === '[255,216,255,1]';
};
