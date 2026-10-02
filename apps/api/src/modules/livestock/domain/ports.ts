import type { PastoId, RetiroId } from "../../pastures";
import type {
  AbateRebanho,
  MortalidadeRebanho,
  MovimentacaoRebanho,
} from "./eventos";

export type PeriodoMensal = {
  mes: number;
  ano: number;
};

export type FiltroEventosRetiro = {
  fazendaId: string;
  /** `null` consulta todos os retiros da fazenda. */
  retiroId: RetiroId | null;
};

/**
 * Contrato de leitura do histórico de rebanho. As três séries são lidas separadamente
 * porque o painel as soma em janelas diferentes: abates por mês e ano
 * (apps/web/src/hooks/useAbatesData.ts:18-19), mortalidades por ano
 * (apps/web/src/hooks/useMortalidadesData.ts:18) e movimentações por qualquer ponta
 * do par de pastos (apps/web/src/hooks/useMapaData.ts:143).
 */
export interface EventosRebanhoLeituraPort {
  listarAbates(
    filtro: FiltroEventosRetiro & PeriodoMensal,
  ): Promise<readonly AbateRebanho[]>;

  listarMortalidades(
    filtro: FiltroEventosRetiro,
  ): Promise<readonly MortalidadeRebanho[]>;

  listarMovimentacoesDePastos(
    pastoIds: readonly PastoId[],
  ): Promise<readonly MovimentacaoRebanho[]>;
}
