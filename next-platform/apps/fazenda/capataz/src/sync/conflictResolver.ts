/**
 * Motor de Resolução de Conflitos de Sincronização por Domínio
 * ESTRITAMENTE SEM Last-Write-Wins (LWW):
 * 1. Domínio de Cocho / Observações de Ronda: Merge Aditivo cronológico (Append-Only Event Stream).
 *    Leituras concorrentes de diferentes operadores/momentos nunca se sobrescrevem; ambas
 *    são preservadas com seus timestamps para auditoria zootécnica do Gerente.
 * 2. Domínio de Movimentações Físicas / Salga / Estoque: Controle de Concorrência Otimista (OCC 409).
 *    Divergência de base_version bloqueia o comando em estado de conflito e exige decisão explícita.
 */

import { AtomicCommandEnvelope } from '@consubov/contracts';

export type ConflictResolutionStrategy =
  | 'ADDITIVE_MERGE'
  | 'OCC_CONFLICT_REVIEW'
  | 'MANUAL_SERVER_APPLIED'
  | 'MANUAL_LOCAL_RECALCULATED';

export interface ConflictResolutionResult {
  commandId: string;
  commandType: string;
  strategy: ConflictResolutionStrategy;
  resolved: boolean;
  message: string;
  mergedPayload?: any;
  auditTrail: {
    occurredAt: string;
    action: string;
    details: string;
  };
}

export interface ExistingObservation {
  leitura_id?: string;
  pasto_id: string;
  escore_cocho?: number;
  sacos_fornecidos?: number;
  foto_attachment_id?: string;
  occurred_at_local: string;
  operador_id?: string;
}

/**
 * Determina se o tipo de comando pertence ao domínio de observações cumulativas de campo.
 */
export function isAdditiveDomainCommand(commandType: string): boolean {
  const additiveCommands = [
    'capataz.cocho.registrar_escore',
    'capataz.cocho.foto_adicionar',
    'capataz.pasto.leitura_qr',
    'capataz.animais.contagem'
  ];
  return additiveCommands.includes(commandType);
}

/**
 * Resolve conflitos sem LWW aplicando regras especializadas por domínio.
 */
export function resolveDomainConflict(
  localCommand: AtomicCommandEnvelope<any>,
  serverConflictInfo?: {
    statusCode?: number;
    serverAggregateVersion?: number;
    existingObservations?: ExistingObservation[];
    message?: string;
  }
): ConflictResolutionResult {
  const commandType = localCommand.command_type;
  const now = new Date().toISOString();

  // 1. Domínio de Observações de Cocho e Campo: MERGE ADITIVO
  if (isAdditiveDomainCommand(commandType)) {
    const existingList = serverConflictInfo?.existingObservations || [];
    const newEntry: ExistingObservation = {
      pasto_id: localCommand.payload.pasto_id,
      escore_cocho: localCommand.payload.escore_cocho,
      sacos_fornecidos: localCommand.payload.sacos_fornecidos,
      foto_attachment_id: localCommand.payload.foto_attachment_id,
      occurred_at_local: localCommand.occurred_at_local || now,
      operador_id: localCommand.user_id
    };

    // Ordenação estrita por timestamp de campo garantindo integridade cronológica
    const chronologicalStream = [...existingList, newEntry].sort((a, b) =>
      a.occurred_at_local.localeCompare(b.occurred_at_local)
    );

    return {
      commandId: localCommand.command_id,
      commandType,
      strategy: 'ADDITIVE_MERGE',
      resolved: true,
      message: 'Merge aditivo aplicado com sucesso: observações concorrentes preservadas cronologicamente.',
      mergedPayload: {
        ...localCommand.payload,
        event_stream: chronologicalStream,
        total_observations_count: chronologicalStream.length
      },
      auditTrail: {
        occurredAt: now,
        action: 'ADDITIVE_MERGE_APPLIED',
        details: `Preservadas ${chronologicalStream.length} observações de cocho para o pasto ${localCommand.payload.pasto_id}.`
      }
    };
  }

  // 2. Domínio Físico / Salga / Lotes / Estoque: OCC 409 - CONFLITO REQUER REVISÃO
  return {
    commandId: localCommand.command_id,
    commandType,
    strategy: 'OCC_CONFLICT_REVIEW',
    resolved: false,
    message: `Conflito OCC 409 detectado: a versão base local (${localCommand.base_version ?? 0}) diverge da versão atual do servidor (${serverConflictInfo?.serverAggregateVersion ?? 'desconhecida'}). Operação retida na outbox para resolução explícita.`,
    auditTrail: {
      occurredAt: now,
      action: 'OCC_CONFLICT_DETECTED',
      details: `Comando ${localCommand.command_id} retido devido a concorrência na entidade física.`
    }
  };
}

/**
 * Resolução explícita: Operador opta por manter a versão local, recalculando a base_version.
 */
export function applyLocalResolution(
  localCommand: AtomicCommandEnvelope<any>,
  newBaseVersion: number
): AtomicCommandEnvelope<any> {
  return {
    ...localCommand,
    base_version: newBaseVersion,
    idempotency_key: `${localCommand.idempotency_key}-recalc-${Date.now()}`
  };
}
