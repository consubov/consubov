import { z } from 'zod';
import { atomicCommandEnvelopeSchema } from '../validation/envelope.schema';
import type { LocalMutationResult, LocalPendingCommand, LocalSnapshot } from './local-data';

export const FAZENDA_MODULE_IDS = ['capataz', 'gerente', 'escritorio', 'fabrica'] as const;
export type FazendaModuleId = typeof FAZENDA_MODULE_IDS[number];

export const PROFILE_FOR_MODULE = {
  capataz: 'capataz',
  gerente: 'gerente',
  escritorio: 'escritorio',
  fabrica: 'fabrica'
} as const;

export const MODULE_CAPABILITIES = ['local-data.read', 'local-data.write', 'sync.pull', 'sync.push'] as const;
const capabilitySchema = z.enum(MODULE_CAPABILITIES);
const moduleIdSchema = z.enum(FAZENDA_MODULE_IDS);
const profileIdSchema = z.enum(['capataz', 'gerente', 'escritorio', 'fabrica']);
const scopedId = z.string().trim().min(1).max(128);
const nonceSchema = z.string().uuid();
const versionSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
const languageSchema = z.enum(['pt-BR', 'en-US']);

export const moduleExecutionContextSchema = z.object({
  userId: scopedId,
  tenantId: scopedId,
  farmId: scopedId,
  retreatId: scopedId.nullable(),
  moduleId: moduleIdSchema,
  profileId: profileIdSchema,
  deviceId: scopedId,
  productId: z.literal('consubov')
}).strict().superRefine((context, issueContext) => {
  if (context.profileId !== PROFILE_FOR_MODULE[context.moduleId]) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['profileId'], message: 'O perfil autenticado não corresponde ao módulo autorizado.' });
  }
});

export type ModuleExecutionContext = z.infer<typeof moduleExecutionContextSchema>;
export type ModuleAccountPartition = Pick<ModuleExecutionContext, 'userId' | 'tenantId' | 'farmId' | 'retreatId' | 'moduleId' | 'profileId' | 'productId'>;

const moduleIdentityFields = {
  protocolVersion: z.literal(1),
  moduleId: moduleIdSchema,
  profileId: profileIdSchema,
  nonce: nonceSchema
};

export const moduleHelloSchema = z.object({
  ...moduleIdentityFields,
  kind: z.literal('module:hello'),
  version: versionSchema
}).strict().superRefine((hello, issueContext) => {
  if (hello.profileId !== PROFILE_FOR_MODULE[hello.moduleId]) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['profileId'], message: 'Perfil incompatível com o módulo.' });
  }
});
export type ModuleHello = z.infer<typeof moduleHelloSchema>;
export const moduleHealthSchema = z.object({ ...moduleIdentityFields, kind: z.literal('module:healthy'), version: versionSchema }).strict();
export const moduleRuntimeFailureSchema = z.object({ ...moduleIdentityFields, kind: z.literal('module:runtime-failure'), version: versionSchema }).strict();

export const shellModuleInitSchema = z.object({
  ...moduleIdentityFields,
  kind: z.literal('shell:init'),
  version: versionSchema,
  context: moduleExecutionContextSchema,
  capabilities: z.array(capabilitySchema).max(MODULE_CAPABILITIES.length),
  language: languageSchema
}).strict().superRefine((init, issueContext) => {
  if (init.profileId !== PROFILE_FOR_MODULE[init.moduleId] || init.context.moduleId !== init.moduleId || init.context.profileId !== init.profileId) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['context'], message: 'Contexto de inicialização não corresponde ao módulo.' });
  }
  if (new Set(init.capabilities).size !== init.capabilities.length) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['capabilities'], message: 'Capabilities duplicadas.' });
  }
});
export type ShellModuleInit = z.infer<typeof shellModuleInitSchema>;

export const moduleReadySchema = z.object({
  ...moduleIdentityFields,
  kind: z.literal('module:ready')
}).strict().superRefine((ready, issueContext) => {
  if (ready.profileId !== PROFILE_FOR_MODULE[ready.moduleId]) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['profileId'], message: 'Perfil incompatível com o módulo.' });
  }
});
export const shellLanguageChangeSchema = z.object({
  kind: z.literal('shell:language-changed'),
  protocolVersion: z.literal(1),
  language: languageSchema
}).strict();

const rpcIdSchema = z.string().uuid();
const boundedId = z.string().trim().min(1).max(128);
const localSnapshotSchema = z.object({
  aggregateType: boundedId,
  aggregateId: boundedId,
  version: z.number().int().nonnegative(),
  data: z.record(z.unknown()),
  modifiedAt: z.string().datetime()
}).strict();
const attachmentRefSchema = z.object({
  attachment_id: rpcIdSchema,
  mime_type: z.string().trim().min(1).max(128),
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  hash_sha256: z.string().regex(/^[a-f\d]{64}$/i),
  local_blob_ref: boundedId
}).strict();
const mutationSchema = z.object({
  expectedModuleRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  command: atomicCommandEnvelopeSchema,
  snapshot: localSnapshotSchema,
  attachments: z.array(z.object({ ref: attachmentRefSchema, blob: z.instanceof(Blob) }).strict()).max(4)
}).strict();
const rpcPayloadSchemas = {
  readSnapshot: z.object({ aggregateType: boundedId, aggregateId: boundedId }).strict(),
  listSnapshots: z.object({ aggregateType: boundedId.optional() }).strict(),
  commitMutation: mutationSchema,
  readAttachment: z.object({ attachmentId: rpcIdSchema }).strict(),
  listPendingCommands: z.object({ limit: z.number().int().min(1).max(500) }).strict(),
  listOperationIssues: z.object({ limit: z.number().int().min(1).max(500) }).strict(),
  getCursor: z.object({}).strict(),
  getSchemaVersion: z.object({}).strict()
} as const;

export const MODULE_RPC_METHODS = Object.keys(rpcPayloadSchemas) as (keyof typeof rpcPayloadSchemas)[];
export type ModuleRpcMethod = keyof typeof rpcPayloadSchemas;
export type ModuleRpcPayloads = {
  readSnapshot: { aggregateType: string; aggregateId: string };
  listSnapshots: { aggregateType?: string };
  commitMutation: Parameters<import('./local-data').LocalDataAPI['commitMutation']>[1];
  readAttachment: { attachmentId: string };
  listPendingCommands: { limit: number };
  listOperationIssues: { limit: number };
  getCursor: Record<string, never>;
  getSchemaVersion: Record<string, never>;
};
export type ModuleRpcResults = {
  readSnapshot: LocalSnapshot | null;
  listSnapshots: readonly LocalSnapshot[];
  commitMutation: LocalMutationResult;
  readAttachment: Awaited<ReturnType<import('./local-data').LocalDataAPI['readAttachment']>>;
  listPendingCommands: readonly LocalPendingCommand[];
  listOperationIssues: readonly import('./operation-issues').OperationIssue[];
  getCursor: string | null;
  getSchemaVersion: number;
};

const moduleRpcBaseSchema = z.object({
  protocolVersion: z.literal(1),
  moduleId: moduleIdSchema,
  nonce: nonceSchema,
  requestId: rpcIdSchema
}).strict();

const methodSchema = z.enum(MODULE_RPC_METHODS as [ModuleRpcMethod, ...ModuleRpcMethod[]]);
function rpcWireSize(value: unknown): number {
  let blobs = 0;
  const seen = new WeakSet<object>();
  const visit = (node: unknown): unknown => {
    if (node instanceof Blob) { blobs += node.size; return { __blobBytes: node.size, type: node.type }; }
    if (node === null || typeof node !== 'object') return node;
    if (seen.has(node)) throw new Error('cyclic');
    seen.add(node);
    try {
      if (Array.isArray(node)) return node.map(visit);
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]));
    } finally {
      // Repeated references (e.g. command refs and attachmentRefs) are valid structured clones.
      seen.delete(node);
    }
  };
  const json = JSON.stringify(visit(value));
  return new TextEncoder().encode(json).byteLength + blobs;
}

export const moduleRpcRequestSchema = moduleRpcBaseSchema.extend({
  kind: z.literal('request'),
  method: methodSchema,
  payload: z.unknown()
}).strict().superRefine((request, issueContext) => {
  const parsed = rpcPayloadSchemas[request.method].safeParse(request.payload);
  if (!parsed.success) issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['payload'], message: 'Payload inválido para o método RPC.' });
  try {
    if (rpcWireSize(request.payload) > 40 * 1024 * 1024) issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['payload'], message: 'Payload RPC excede 40 MiB.' });
  } catch { issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['payload'], message: 'Payload RPC não serializável.' }); }
});

export const moduleRpcResponseSchema = z.discriminatedUnion('ok', [
  moduleRpcBaseSchema.extend({ kind: z.literal('response'), ok: z.literal(true), result: z.unknown() }).strict(),
  moduleRpcBaseSchema.extend({
    kind: z.literal('response'),
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_MESSAGE', 'UNSUPPORTED_PROTOCOL', 'TIMEOUT', 'MODULE_FAILURE', 'ATTACHMENTS_UNAVAILABLE', 'STORAGE_QUOTA']),
      message: z.string().trim().min(1).max(500)
    }).strict()
  }).strict()
]).superRefine((response, issueContext) => {
  if (response.ok) {
    try {
      if (rpcWireSize(response.result) > 40 * 1024 * 1024) issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['result'], message: 'Resposta RPC excede 40 MiB.' });
    } catch { issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['result'], message: 'Resposta RPC não serializável.' }); }
  }
});

export type ModuleRpcRequest = z.infer<typeof moduleRpcRequestSchema>;
export type ModuleRpcResponse = z.infer<typeof moduleRpcResponseSchema>;

/** Notification only; module rereads its bound partition through the existing RPC. */
export const shellDataChangedSchema = z.object({
  kind: z.literal('shell:data-changed'),
  protocolVersion: z.literal(1),
  moduleId: moduleIdSchema,
  nonce: nonceSchema
}).strict();

