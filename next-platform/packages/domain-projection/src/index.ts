import { validateCommandPayload } from '@consubov/contracts';
import { DomainProjectionError } from './shared';
import type { AtomicCommandEnvelope } from '@consubov/contracts';
import type { FarmModuleId } from './shared';
export { DomainProjectionError, getProjectionVersion, toModuleSnapshot, type FarmModuleId } from './shared';
import * as gerente from './gerente';
import * as fabrica from './fabrica';
import * as escritorio from './escritorio';
import * as capataz from './capataz';
export const SUPPORTED_COMMANDS: readonly string[] = Object.freeze([...gerente.SUPPORTED_COMMANDS, ...fabrica.SUPPORTED_COMMANDS, ...escritorio.SUPPORTED_COMMANDS, ...capataz.SUPPORTED_COMMANDS]);
export function applyModuleCommand<T extends object>(moduleId: FarmModuleId, current: T, command: AtomicCommandEnvelope<unknown>): T {
 if (!SUPPORTED_COMMANDS.includes(command.command_type)) throw new DomainProjectionError('UNSUPPORTED_COMMAND', command.command_type);
 const parsed = validateCommandPayload(command.command_type, command.payload);
 if (!parsed.success) throw new DomainProjectionError('INVALID_DOMAIN_PAYLOAD', 'Payload de domínio inválido.');
 command = { ...command, payload: parsed.data };
 switch(moduleId) {
 case 'gerente': return gerente.applyModuleCommand(moduleId, current, command);
 case 'fabrica': return fabrica.applyModuleCommand(moduleId, current, command);
 case 'escritorio': return escritorio.applyModuleCommand(moduleId, current, command);
 case 'capataz': return capataz.applyModuleCommand(moduleId, current, command);
 }
}
