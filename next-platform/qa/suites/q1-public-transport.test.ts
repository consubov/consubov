import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  FAZENDA_MODULE_IDS, MODULE_CAPABILITIES, MODULE_RPC_METHODS,
  moduleHelloSchema, shellModuleInitSchema, moduleReadySchema,
  moduleHealthSchema, moduleRuntimeFailureSchema, shellQuiescenceControlSchema, moduleQuiescenceMessageSchema,
  shellLanguageChangeSchema, shellDataChangedSchema, moduleRpcRequestSchema, moduleRpcResponseSchema,
  atomicCommandEnvelopeSchema, ALLOWED_COMMAND_TYPES, moduleProvisioningPayloadSchema
} from '@consubov/contracts';
import { createRouter } from '../../api/src/router';
import { InMemoryLedger } from '../../api/src/ledger/in-memory-ledger';
import { SYNTHETIC_USERS } from '@consubov/auth-client';

const publicDir = new URL('../../packages/contracts/public/v1/', import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, publicDir), 'utf8'));
const protocol = load('module-protocol.schema.json');
const commandSchema = load('atomic-command.schema.json');
const openapi = load('openapi.json');
const baseUri = 'https://contracts.consubov.invalid/f23/v1/';
const nonce = '3411c95a-3a23-4a26-a243-1d77129ecc01';
const identity = { protocolVersion: 1, moduleId: 'capataz', nonce };
const request = { ...identity, kind: 'request', requestId: nonce, method: 'getCursor', payload: {} };
const context = {
  userId: 'account-a', tenantId: 'tenant-a', farmId: 'farm-a', retreatId: null,
  moduleId: 'capataz', profileId: 'capataz', deviceId: 'device-a', productId: 'consubov'
};
const command = {
  command_id: 'command-a', idempotency_key: 'idempotency-key-a', command_type: 'capataz.animais.contagem',
  aggregate_type: 'pasto', aggregate_id: 'pasture-a', base_version: 0,
  user_id: 'account-a', tenant_id: 'tenant-a', product_id: 'consubov', fazenda_id: 'farm-a',
  profile_id: 'capataz', device_id: 'device-a', schema_version: 1,
  payload: {}, correlation_id: 'correlation-a', occurred_at_local: '2026-11-05T12:00:00.000Z',
  status: 'PENDENTE', attempts: 0
};
type Fixture = { name: string; ref: string; value: unknown; valid: boolean };

// Use an independent standards validator, not a second hand-written interpretation.
// Python/jsonschema is a test prerequisite only; no runtime or package dependency is added.
function validateIndependently(fixtures: Fixture[]) {
  const script = `
import json, sys
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
data = json.load(sys.stdin)
store = data['documents']
registry = Registry().with_resources((uri, Resource.from_contents(document, default_specification=DRAFT202012)) for uri, document in store.items())
for uri, document in store.items():
    if uri.endswith('.schema.json'):
        Draft202012Validator.check_schema(document)
for schema in store[data['base'] + 'openapi.json']['components']['schemas'].values():
    Draft202012Validator.check_schema(schema)
results = []
for fixture in data['fixtures']:
    validator = Draft202012Validator({'$ref': fixture['ref']}, registry=registry, format_checker=FormatChecker())
    results.append({'name': fixture['name'], 'valid': validator.is_valid(fixture['value'])})
json.dump(results, sys.stdout)
`;
  const process = spawnSync('python', ['-c', script], {
    input: JSON.stringify({ base: baseUri, documents: {
      [baseUri + 'module-protocol.schema.json']: protocol,
      [baseUri + 'atomic-command.schema.json']: commandSchema,
      [baseUri + 'openapi.json']: openapi
    }, fixtures }), encoding: 'utf8', timeout: 30_000
  });
  expect(process.error, 'Python 3 and jsonschema are required for the independent schema gate').toBeUndefined();
  expect(process.status, process.stderr).toBe(0);
  const results = JSON.parse(process.stdout) as { name: string; valid: boolean }[];
  expect(results.length).toBe(fixtures.length);
  results.forEach((result, index) => expect(result.valid, result.name).toBe(fixtures[index]!.valid));
}

describe('F23 T01 public language-neutral transport', () => {
  it('keeps the public method/module/capability/command allowlists equal to runtime', () => {
    expect(protocol.$defs.Request.properties.method.enum).toEqual(MODULE_RPC_METHODS);
    expect(protocol.$defs.Request.properties.moduleId.enum).toEqual([...FAZENDA_MODULE_IDS]);
    expect(protocol.$defs.ShellInit.properties.capabilities.items.enum).toEqual([...MODULE_CAPABILITIES]);
    expect(commandSchema.properties.command_type.enum).toEqual([...ALLOWED_COMMAND_TYPES]);
  });

  it('matches actual runtime acceptance across positive and negative JSON messages', () => {
    const fixtures: Fixture[] = [];
    const add = (name: string, definition: string, schema: { safeParse(value: unknown): { success: boolean } }, values: unknown[]) => {
      values.forEach((value, index) => fixtures.push({ name: `${name}/${index}`, ref: `${baseUri}module-protocol.schema.json#/$defs/${definition}`, value, valid: schema.safeParse(value).success }));
    };
    const hello = { ...identity, profileId: 'capataz', kind: 'module:hello', version: '1.0.0' };
    const lifecycle = (
      definition: string, schema: { safeParse(value: unknown): { success: boolean } }, value: Record<string, unknown>
    ) => {
      const without = (key: string) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
      const values = [value, { ...value, protocolVersion: 2 }, { ...value, nonce: 'invalid' },
        { ...value, moduleId: 'unknown' }, { ...value, context }, ...Object.keys(value).map(without)];
      add(definition, definition, schema, values);
      // Every accepted lifecycle definition must also be recognized by the public wire union.
      for (const candidate of values) fixtures.push({ name: `${definition}/root`, ref: `${baseUri}module-protocol.schema.json`, value: candidate, valid: schema.safeParse(candidate).success });
    };
    for (const [definition, schema, kind] of [
      ['ModuleHealth', moduleHealthSchema, 'module:healthy'],
      ['ModuleRuntimeFailure', moduleRuntimeFailureSchema, 'module:runtime-failure']
    ] as const) {
      lifecycle(definition, schema, { ...hello, kind });
      add(definition, definition, schema, [{ ...hello, kind, profileId: 'gerente' }, { ...hello, kind, version: 'latest' }]);
    }
    lifecycle('ShellPrepareActivation', shellQuiescenceControlSchema, { ...identity, kind: 'shell:prepare-activation', requestId: nonce });
    lifecycle('ShellVerifyActivation', shellQuiescenceControlSchema, { ...identity, kind: 'shell:verify-activation', requestId: nonce, leaseId: nonce });
    lifecycle('ShellReleaseActivation', shellQuiescenceControlSchema, { ...identity, kind: 'shell:release-activation', leaseId: nonce });
    const counts = { FORM_DIRTY: 0, CAMERA_ACTIVE: 0, WEIGHING_ACTIVE: 0, OUTBOX_SYNCING: 0, QR_SCANNING: 0, LOCAL_DB_TRANSACTION: 0 };
    const status = { ...identity, kind: 'module:quiescence', quiescent: true, frozen: false, counts };
    lifecycle('ModuleQuiescence', moduleQuiescenceMessageSchema, status);
    add('counts', 'ModuleQuiescence', moduleQuiescenceMessageSchema, [
      { ...status, counts: { ...counts, FORM_DIRTY: -1 } }, { ...status, counts: { ...counts, FORM_DIRTY: 0.5 } },
      { ...status, counts: { ...counts, FORM_DIRTY: Number.MAX_SAFE_INTEGER } },
      { ...status, counts: { ...counts, FORM_DIRTY: Number.MAX_SAFE_INTEGER + 1 } },
      { ...status, counts: { ...counts, unexpected: 0 } }, { ...status, counts: {} }
    ]);
    const prepared = { ...identity, kind: 'module:activation-prepared', requestId: nonce, prepared: true, leaseId: nonce, expiresAt: 1 };
    lifecycle('ModuleActivationPrepared', moduleQuiescenceMessageSchema, prepared);
    add('prepared', 'ModuleActivationPrepared', moduleQuiescenceMessageSchema, [
      { ...prepared, prepared: false, leaseId: null, expiresAt: null }, { ...prepared, expiresAt: 0 },
      { ...prepared, expiresAt: 1.5 }, { ...prepared, leaseId: 'invalid' }
    ]);
    lifecycle('ModuleActivationVerified', moduleQuiescenceMessageSchema, { ...identity, kind: 'module:activation-verified', requestId: nonce, leaseId: nonce, valid: true });
    add('hello', 'ModuleHello', moduleHelloSchema, [hello, { ...hello, profileId: 'gerente' }, { ...hello, version: 'latest' }, { ...hello, nonce: 'wrong' }]);
    const init = { ...hello, kind: 'shell:init', context, capabilities: ['local-data.read'], language: 'pt-BR' };
    for (const value of [hello, init, { ...identity, profileId: 'capataz', kind: 'module:ready' }]) {
      fixtures.push({ name: 'legacy v1 handshake remains valid', ref: `${baseUri}module-protocol.schema.json`, value, valid: true });
    }
    add('init', 'ShellInit', shellModuleInitSchema, [init,
      { ...init, context: { ...context, moduleId: 'gerente', profileId: 'gerente' } },
      { ...init, capabilities: ['local-data.read', 'local-data.read'] },
      { ...init, capabilities: ['admin'] }, { ...init, language: 'es' }]);
    add('ready', 'ModuleReady', moduleReadySchema, [
      { ...identity, profileId: 'capataz', kind: 'module:ready' },
      { ...identity, profileId: 'gerente', kind: 'module:ready' }
    ]);
    add('language', 'LanguageChanged', shellLanguageChangeSchema, [
      { kind: 'shell:language-changed', protocolVersion: 1, language: 'en-US' },
      { kind: 'shell:language-changed', protocolVersion: 2, language: 'pt-BR' }
    ]);
    add('data-changed', 'DataChanged', shellDataChangedSchema, [
      { ...identity, kind: 'shell:data-changed' },
      { ...identity, kind: 'shell:data-changed', protocolVersion: 2 },
      { ...identity, kind: 'shell:data-changed', nonce: 'invalid' },
      { ...identity, kind: 'shell:data-changed', context },
      { ...identity, kind: 'shell:data-changed', userId: 'other-account' }
    ]);
    const payloads: Record<string, unknown> = {
      readSnapshot: { aggregateType: 'pasto', aggregateId: 'pasture-a' }, listSnapshots: {},
      commitMutation: { command, snapshot: { aggregateType: 'pasto', aggregateId: 'pasture-a', version: 1, data: {}, modifiedAt: '2026-11-05T12:00:00.000Z' }, attachments: [] },
      readAttachment: { attachmentId: nonce }, listPendingCommands: { limit: 50 }, listOperationIssues: { limit: 50 }, getCursor: {}, getSchemaVersion: {}
    };
    for (const method of MODULE_RPC_METHODS) {
      add(method, 'Request', moduleRpcRequestSchema, [
        { ...request, method, payload: payloads[method] },
        { ...request, method, payload: { unexpected: true } },
        { ...request, method, payload: payloads[method], context },
        { ...request, method, payload: payloads[method], capability: 'local-data.read' }
      ]);
    }
    add('request', 'Request', moduleRpcRequestSchema, [
      { ...request, protocolVersion: 2 }, { ...request, method: 'runSql' },
      { ...request, requestId: 'invalid' }, { ...request, method: 'listPendingCommands', payload: { limit: 501 } },
      { ...request, method: 'listOperationIssues', payload: { limit: 501 } }, { ...request, method: 'listOperationIssues', payload: { limit: 0 } }
    ]);
    const response = { ...identity, requestId: nonce, kind: 'response', ok: true, result: null };
    add('response', 'Response', moduleRpcResponseSchema, [response,
      { ...response, ok: false, error: { code: 'FORBIDDEN', message: 'Denied' } },
      { ...response, nonce: 'invalid' }, { ...response, context }
    ]);
    fixtures.push({ name: 'response/error', ref: `${baseUri}module-protocol.schema.json#/$defs/Response`, value: { ...identity, requestId: nonce, kind: 'response', ok: false, error: { code: 'STORAGE_QUOTA', message: 'Full' } }, valid: true });
    for (const value of [command, { ...command, extra: true }, { ...command, base_version: -1 }, { ...command, command_type: 'runSql' }, { ...command, occurred_at_local: 'yesterday' }]) {
      fixtures.push({ name: 'command', ref: `${baseUri}atomic-command.schema.json`, value, valid: atomicCommandEnvelopeSchema.safeParse(value).success });
    }
    validateIndependently(fixtures);
  }, 40_000);

  it('describes real HTTP health, login, command rejection, authorized pull and audit barrier', async () => {
    expect(openapi.openapi).toBe('3.1.0');
    expect(Object.keys(openapi.paths).sort()).toEqual(['/api/v1/admin/audit', '/api/v1/attachments/{attachment_id}', '/api/v1/auth/login', '/api/v1/commands', '/api/v1/health', '/api/v1/sync']);
    const router = createRouter(new InMemoryLedger());
    const fixtures: Fixture[] = [];
    const user = Object.values(SYNTHETIC_USERS).find(user => user.primary_profile === 'capataz')!;
    const membership = user.memberships.find(membership => membership.is_active)!;
    let login: any;
    for (const membershipId of [undefined, membership.membership_id]) {
      const response = await router(new Request('http://127.0.0.1:3333/api/v1/auth/login', {
        method: 'POST', body: JSON.stringify({ email: user.email, password: user.password_hash, device_id: 'transport-test', membership_id: membershipId })
      }));
      expect(response.status).toBe(200);
      const value = await response.json();
      expect(value.requires_context_selection).toBe(membershipId === undefined);
      expect(Boolean(value.tokens)).toBe(membershipId !== undefined);
      expect(Boolean(value.initial_data)).toBe(membershipId !== undefined);
      if (value.tokens) login = value;
      if (value.initial_data) {
        expect(moduleProvisioningPayloadSchema.safeParse(value.initial_data).success).toBe(true);
        expect(value.initial_data.context.userId).toBe(user.user_id);
        expect(value.initial_data.context.farmId).toBe(membership.fazenda_id);
        fixtures.push({ name: 'authorized seed', ref: `${baseUri}openapi.json#/components/schemas/ModuleProvisioning`, value: value.initial_data, valid: true });
      }
      fixtures.push({ name: 'login success', ref: `${baseUri}openapi.json#/components/schemas/LoginResponse`, value, valid: true });
    }
    for (const [path, init, status, schema] of [
      ['/api/v1/health', {}, 200, 'Health'],
      ['/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'missing@example.invalid', password: 'no', device_id: 'test-device' }) }, 401, 'Error'],
      ['/api/v1/commands', { method: 'POST', body: '{}' }, 401, 'Error'],
      ['/api/v1/sync?tenant_id=synthetic&since_cursor=8', {}, 401, 'Error'],
      ['/api/v1/admin/audit', {}, 401, 'Error']
    ] as const) {
      const response = await router(new Request(`http://127.0.0.1:3333${path}`, init));
      expect(response.status, path).toBe(status);
      fixtures.push({ name: path, ref: `${baseUri}openapi.json#/components/schemas/${schema}`, value: await response.json(), valid: true });
    }
    const ctx = login.initial_data.context;
    const envelope = { ...command, user_id: ctx.userId, tenant_id: ctx.tenantId, fazenda_id: ctx.farmId,
      retiro_id: ctx.retreatId, product_id: ctx.productId, profile_id: ctx.profileId, device_id: ctx.deviceId,
      aggregate_type: 'lote', aggregate_id: 'lote-01', base_version: 1,
      payload: { lote_id: 'lote-01', pasto_id: 'pasto-01', quantidade_cabecas: 42, data_contagem: '2026-11-05T12:00:00.000Z' } };
    const accepted = await router(new Request('http://127.0.0.1:3333/api/v1/commands', { method: 'POST', headers: { Authorization: 'Bearer ' + login.tokens.access_token }, body: JSON.stringify(envelope) }));
    expect(accepted.status).toBe(200);
    const result = await accepted.json();
    fixtures.push({ name: 'wrapped command ACK', ref: `${baseUri}openapi.json#/components/schemas/CommandApiResponse`, value: result, valid: true });
    fixtures.push({ name: 'ledger ACK', ref: `${baseUri}openapi.json#/components/schemas/LedgerAck`, value: result.ack, valid: true });
    const params = new URLSearchParams({ tenant_id: ctx.tenantId, fazenda_id: ctx.farmId, profile_id: ctx.profileId });
    const pull = await router(new Request('http://127.0.0.1:3333/api/v1/sync?' + params, { headers: { Authorization: 'Bearer ' + login.tokens.access_token } }));
    expect(pull.status).toBe(200);
    fixtures.push({ name: 'full module pull', ref: `${baseUri}openapi.json#/components/schemas/SyncPull`, value: await pull.json(), valid: true });
    expect(openapi.paths['/api/v1/sync'].get['x-implementation-status']).toBe('IMPLEMENTED_IN_MEMORY');
    expect(openapi['x-planned-t04'].status).toBe('LOCAL_HANDLERS_IMPLEMENTED_TESTED');
    validateIndependently(fixtures);
  });
});
