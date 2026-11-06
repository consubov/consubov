import type { AtomicCommandEnvelope } from '@consubov/contracts';
export type FarmModuleId = 'capataz' | 'gerente' | 'escritorio' | 'fabrica';
export class DomainProjectionError extends Error {
  constructor(public readonly code: 'UNSUPPORTED_COMMAND' | 'INVALID_DOMAIN_PAYLOAD' | 'INVALID_AGGREGATE', message: string) {
    super(message); this.name = 'DomainProjectionError';
  }
}
export interface CommandDefinition {
  moduleId: FarmModuleId;
  aggregateType: string;
  idField: string;
  apply: (state: unknown, payload: unknown, command: AtomicCommandEnvelope<unknown>) => void;
}
function unwrap(state: object): Record<string, unknown> {
  const value = state as Record<string, unknown>;
  return value.schema === 'escritorio-state-v1' && value.state && typeof value.state === 'object'
    ? value.state as Record<string, unknown> : value;
}
export function getProjectionVersion(state: object, moduleId: FarmModuleId, aggregateId: string): number {
  const versions = unwrap(state).baseVersions as Record<string, number> | undefined;
  return versions?.[aggregateId] ?? (moduleId === 'capataz' ? 1 : 0);
}
/** Trusted local mutation adapter; the API entrypoint also enforces canonical payload schemas. */
export function createModuleProjection(moduleId: FarmModuleId, definitions: Record<string, CommandDefinition>, aliases: Record<string, string>) {
  return function applyModuleCommand<T extends object>(current: T, command: AtomicCommandEnvelope<unknown>): T {
  const definition = definitions[aliases[command.command_type] ?? command.command_type];
  if (!definition || definition.moduleId !== moduleId) throw new DomainProjectionError('UNSUPPORTED_COMMAND', command.command_type);
  if (!command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new DomainProjectionError('INVALID_DOMAIN_PAYLOAD', 'Payload de domínio inválido.');
  const payload = command.payload as Record<string, unknown>;
  if (command.aggregate_type !== definition.aggregateType || command.aggregate_id !== payload[definition.idField]) {
    throw new DomainProjectionError('INVALID_AGGREGATE', 'O agregado diverge da identidade do comando.');
  }
  if (command.command_type === 'capataz.cocho.foto_adicionar' && !payload.photo_metadata) {
    throw new DomainProjectionError('INVALID_DOMAIN_PAYLOAD', 'Metadados duráveis da foto ausentes.');
  }
  const next = structuredClone(unwrap(current));
  definition.apply(next, command.payload, command);
  const versions = next.baseVersions as Record<string, number>;
  versions[command.aggregate_id] = command.base_version + 1;
  next.localRevision = Number(next.localRevision ?? 0) + 1;
  return next as T;
}
}
/** Wire snapshot data, excluding local outbox, runtime handles and photo binary bytes. */
export function toModuleSnapshot(state: object, moduleId: FarmModuleId): Record<string, unknown> {
  const next = structuredClone(unwrap(state));
  next.outbox = [];
  if (moduleId === 'capataz') {
    next.isLeader = false; next.circuitState = 'CLOSED'; next.quotaExceededError = null;
    const fotos = next.fotos as Record<string, Record<string, unknown>>;
    for (const photo of Object.values(fotos)) { delete photo.blob; delete photo.dataUrl; }
  }
  return moduleId === 'escritorio' ? { schema: 'escritorio-state-v1', revision: next.localRevision, state: next } : next;
}
