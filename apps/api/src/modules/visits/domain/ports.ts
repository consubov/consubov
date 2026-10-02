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
  findById(visitaId: VisitaId): Promise<VisitaRecord | null>;
  listPastos(visitaId: VisitaId): Promise<readonly VisitaPastoRecord[]>;
  listAssinantes(visitaId: VisitaId): Promise<readonly AssinanteRecord[]>;
  listAvaliacoes(
    visitaPastoIds: readonly string[],
  ): Promise<readonly AvaliacaoScoreRecord[]>;
  listPennStateAnalises(visitaId: VisitaId): Promise<readonly PennStateAnaliseRecord[]>;
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
  save(visita: VisitaRecord): Promise<void>;
  softDelete(visitaId: VisitaId): Promise<void>;
  insertPasto(pasto: VisitaPastoRecord): Promise<VisitaPastoRecord>;
  deletePastoWithScores(visitaPastoId: string): Promise<void>;
  insertAssinante(assinante: AssinanteRecord): Promise<AssinanteRecord>;
  updateAssinante(assinante: AssinanteRecord): Promise<void>;
  deleteAssinante(assinateId: AssinanteId): Promise<void>;
  insertAvaliacao(avaliacao: AvaliacaoScoreRecord): Promise<AvaliacaoScoreRecord>;
  deleteAvaliacao(avaliacaoId: string): Promise<void>;
  upsertPennStateAnalise(
    analise: PennStateAnaliseRecord,
  ): Promise<PennStateAnaliseRecord>;
  softDeletePennStateAnalise(analiseId: string): Promise<void>;
}