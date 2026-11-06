import { describe, expect, it } from 'bun:test';
import {
  commandApiResponseSchema,
  moduleHelloSchema,
  shellModuleInitSchema,
  moduleReadySchema,
  moduleRpcRequestSchema,
  moduleRpcResponseSchema,
  syncPullRequestSchema,
  syncPullResponseSchema
} from '@consubov/contracts';

const executionContext = {
  userId: 'user-a', tenantId: 'tenant-a', farmId: 'farm-a', retreatId: null,
  moduleId: 'capataz' as const, profileId: 'capataz' as const,
  deviceId: 'device-a', productId: 'consubov' as const
};

const validRequest = {
  kind: 'request' as const,
  protocolVersion: 1 as const,
  moduleId: 'capataz' as const,
  requestId: '0190c4ea-7a7b-7cf3-a72d-68f1c7c8e66c',
  nonce: '0190c4ea-7a7b-7cf3-a72d-68f1c7c8e66c',
  method: 'readSnapshot' as const,
  payload: { aggregateType: 'pasto', aggregateId: 'pasture-a' }
};

describe('F23 T01 public runtime contracts', () => {
  it('validates the versioned module handshake and authenticated bootstrap context', () => {
    const hello = { kind: 'module:hello', protocolVersion: 1, moduleId: 'capataz', profileId: 'capataz', version: '0.1.0', nonce: '0190c4ea-7a7b-7cf3-a72d-68f1c7c8e66c' };
    expect(moduleHelloSchema.safeParse(hello).success).toBe(true);
    expect(moduleHelloSchema.safeParse({ ...hello, version: 'latest' }).success).toBe(false);
    expect(moduleHelloSchema.safeParse({ ...hello, profileId: 'gerente' }).success).toBe(false);

    const init = {
      kind: 'shell:init', protocolVersion: 1, moduleId: 'capataz', profileId: 'capataz',
      version: '0.1.0', nonce: hello.nonce, capabilities: ['local-data.read'], language: 'pt-BR',
      context: executionContext
    };
    expect(shellModuleInitSchema.safeParse(init).success).toBe(true);
    expect(shellModuleInitSchema.safeParse({ ...init, context: { ...executionContext, userId: '' } }).success).toBe(false);
    expect(shellModuleInitSchema.safeParse({ ...init, capabilities: ['admin.tenants.write'] }).success).toBe(false);
    expect(moduleReadySchema.safeParse({ kind: 'module:ready', protocolVersion: 1, moduleId: 'capataz', profileId: 'capataz', nonce: hello.nonce }).success).toBe(true);
  });
  it('accepts a versioned request bound to a nonce and allowlisted method', () => {
    expect(moduleRpcRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rejects caller-supplied context and unknown fields', () => {
    expect(moduleRpcRequestSchema.safeParse({
      ...validRequest, context: { ...executionContext, profileId: 'gerente' }
    }).success).toBe(false);
    expect(moduleRpcRequestSchema.safeParse({
      ...validRequest, context: { ...executionContext, tenantId: '   ' }
    }).success).toBe(false);
    expect(moduleRpcRequestSchema.safeParse({ ...validRequest, preload: true }).success).toBe(false);
  });

  it('rejects caller capabilities, invalid method payloads and cyclic RPC data', () => {
    expect(moduleRpcRequestSchema.safeParse({ ...validRequest, capability: 'Unknown Capability' }).success).toBe(false);
    expect(moduleRpcRequestSchema.safeParse({ ...validRequest, payload: { data: 'x'.repeat(65 * 1024) } }).success).toBe(false);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(moduleRpcRequestSchema.safeParse({ ...validRequest, payload: circular }).success).toBe(false);
  });

  it('accepts only protocol v1 and a typed success or error response', () => {
    expect(moduleRpcRequestSchema.safeParse({ ...validRequest, protocolVersion: 2 }).success).toBe(false);
    expect(moduleRpcResponseSchema.safeParse({
      kind: 'response', protocolVersion: 1, moduleId: 'capataz', requestId: validRequest.requestId, nonce: validRequest.nonce,
      ok: true, result: { saved: true }
    }).success).toBe(true);
    expect(moduleRpcResponseSchema.safeParse({
      kind: 'response', protocolVersion: 1, moduleId: 'capataz', requestId: validRequest.requestId, nonce: validRequest.nonce,
      ok: false, error: { code: 'FORBIDDEN', message: 'Capability denied' }, result: {}
    }).success).toBe(false);
  });

  it('accepts an opaque cursor and rejects numeric cursor coercion', () => {
    const request = {
      tenant_id: 'tenant-a', fazenda_id: 'farm-a', profile_id: 'capataz',
      since_cursor: 'opaque:cursor:v1', limit: 100
    };
    expect(syncPullRequestSchema.safeParse(request).success).toBe(true);
    expect(syncPullRequestSchema.safeParse({ ...request, since_cursor: 123 }).success).toBe(false);
  });

  it('validates ACK and pull DTOs strictly, including tombstones', () => {
    expect(commandApiResponseSchema.safeParse({
      success: true,
      ack: {
        command_id: 'command-a', status: 'COMMITTED', aggregate_id: 'pasto-a',
        aggregate_version: 2, committed_at: '2026-11-05T12:00:00.000Z', correlation_id: 'correlation-a'
      }
    }).success).toBe(true);
    const pull = {
      tenant_id: 'tenant-a', fazenda_id: 'farm-a', next_cursor: 'opaque:cursor:v2', has_more: false,
      deltas: [{ delta_id: 'delta-a', aggregate_type: 'pasto', aggregate_id: 'pasto-a',
        operation: 'TOMBSTONE', version: 3, data: null, modified_at: '2026-11-05T12:00:00.000Z' }],
      server_timestamp: '2026-11-05T12:00:00.000Z'
    };
    expect(syncPullResponseSchema.safeParse(pull).success).toBe(true);
    expect(syncPullResponseSchema.safeParse({ ...pull, next_cursor: 2 }).success).toBe(false);
  });
});

