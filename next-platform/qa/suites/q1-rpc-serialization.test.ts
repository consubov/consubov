import { expect, it } from 'bun:test';
import { moduleRpcResponseSchema } from '../../packages/contracts/src/runtime/module-protocol';

function response(result: unknown) {
  return { protocolVersion: 1, moduleId: 'capataz', nonce: crypto.randomUUID(), requestId: crypto.randomUUID(), kind: 'response', ok: true, result };
}

it('accepts shared references in pending-command RPC responses', () => {
  const refs: unknown[] = [];
  expect(moduleRpcResponseSchema.safeParse(response([
    { command: { attachment_refs: refs }, attachmentRefs: refs }
  ])).success).toBe(true);
});

it('rejects actual cycles in RPC responses', () => {
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  expect(moduleRpcResponseSchema.safeParse(response(cycle)).success).toBe(false);
});
