import { expect, it } from 'bun:test';
import { createModuleLocalDataAPI, createModuleRpcClient, shellDataChangedSchema } from '@consubov/contracts';

it('binds projection notifications to the current port identity and releases subscriptions', async () => {
  const channel = new MessageChannel();
  const nonce = crypto.randomUUID();
  const client = createModuleRpcClient(channel.port1, { moduleId: 'gerente', nonce });
  const local = createModuleLocalDataAPI(client);
  let changes = 0;
  const unsubscribe = local.subscribeToChanges!(() => { changes += 1; });
  const changed = { kind: 'shell:data-changed', protocolVersion: 1, moduleId: 'gerente', nonce };
  expect(shellDataChangedSchema.safeParse(changed).success).toBe(true);
  expect(shellDataChangedSchema.safeParse({ ...changed, context: {} }).success).toBe(false);
  try {
    const delivered = new Promise<void>(resolve => {
      const stop = client.subscribeToChanges!(() => { stop(); resolve(); });
    });
    channel.port2.postMessage({ ...changed, nonce: crypto.randomUUID() });
    channel.port2.postMessage({ ...changed, moduleId: 'capataz' });
    channel.port2.postMessage({ ...changed, protocolVersion: 2 });
    channel.port2.postMessage(changed);
    await delivered;
    expect(changes).toBe(1);
    unsubscribe();
    const next = new Promise<void>(resolve => {
      const stop = client.subscribeToChanges!(() => { stop(); resolve(); });
    });
    channel.port2.postMessage(changed);
    await next;
    expect(changes).toBe(1);
  } finally { client.close(); channel.port2.close(); }
});
