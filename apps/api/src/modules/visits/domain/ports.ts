import type { TenantExecutionContext } from "../../identity-tenancy";
import type { AssinanteRecord } from "./assinante";
import type { AssinanteId, VisitaId } from "./identificadores";
import type { AvaliacaoScoreRecord } from "./score";
import type { PennStateAnaliseRecord } from "./penn-state";
import type { VisitaPastoRecord } from "./visita-pasto";
import type { VisitaRecord } from "./visita";

/**
 * Fronteira de leitura da visita técnica. As operações reproduzem apenas as
 * leituras reais do módulo: a visita com filtro de soft-delete
 * (apps/web/src/pages/VisitaTecnicaPage.tsx:123), os pastos da visita ordenados
 * por `ordem` (VisitaTecnicaPage.tsx:134), os assinantes
 * (apps/web/src/components/consultor/AssinaturasSection.tsx:48), as avaliações
 * de score por pasto (VisitaTecnicaPage.tsx:143-149) e as análises de Penn State
 * da visita (apps/web/src/lib/pennStateStore.ts:125-132).
 */
export interface VisitaReader {
  findById(visitaId: VisitaId, context: TenantExecutionContext): Promise<VisitaRecord | null>;
  listPastos(
    visitaId: VisitaId,
    context: TenantExecutionContext,
  ): Promise<readonly VisitaPastoRecord[]>;
  listAssinantes(
    visitaId: VisitaId,
    context: TenantExecutionContext,
  ): Promise<readonly AssinanteRecord[]>;
  listAvaliacoes(
    visitaPastoIds: readonly string[],
    context: TenantExecutionContext,
  ): Promise<readonly AvaliacaoScoreRecord[]>;
  listPennStateAnalises(
    visitaId: VisitaId,
    context: TenantExecutionContext,
  ): Promise<readonly PennStateAnaliseRecord[]>;
}

/**
 * Fronteira de escrita da visita técnica.
 *
 * `deletePastoWithScores` é uma operação só porque excluir um pasto exclui
 * também as avaliações de score que apontam para ele
 * (apps/web/src/pages/VisitaTecnicaPage.tsx:89,99-101). A exclusão da visita é
 * lógica, por `deleted_at` (apps/web/src/lib/conferenciaAdminVisita.ts:203), e a
 * exclusão da análise Penn State também
 * (apps/web/src/lib/pennStateStore.ts:125-132).
 */
export interface VisitaWriter {
  save(visita: VisitaRecord, context: TenantExecutionContext): Promise<void>;
  softDelete(visitaId: VisitaId, context: TenantExecutionContext): Promise<void>;
  insertPasto(
    pasto: VisitaPastoRecord,
    context: TenantExecutionContext,
  ): Promise<VisitaPastoRecord>;
  deletePastoWithScores(
    visitaPastoId: string,
    context: TenantExecutionContext,
  ): Promise<void>;
  insertAssinante(
    assinante: AssinanteRecord,
    context: TenantExecutionContext,
  ): Promise<AssinanteRecord>;
  updateAssinante(
    assinante: AssinanteRecord,
    context: TenantExecutionContext,
  ): Promise<void>;
  deleteAssinante(
    assinateId: AssinanteId,
    context: TenantExecutionContext,
  ): Promise<void>;
  insertAvaliacao(
    avaliacao: AvaliacaoScoreRecord,
    context: TenantExecutionContext,
  ): Promise<AvaliacaoScoreRecord>;
  deleteAvaliacao(
    avaliacaoId: string,
    context: TenantExecutionContext,
  ): Promise<void>;
  upsertPennStateAnalise(
    analise: PennStateAnaliseRecord,
    context: TenantExecutionContext,
  ): Promise<PennStateAnaliseRecord>;
  softDeletePennStateAnalise(
    analiseId: string,
    context: TenantExecutionContext,
  ): Promise<void>;
}