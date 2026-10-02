import type { FechamentoPesagem } from "./fechamento";
import type {
  AnimalId,
  LeituraBalancaoId,
  LoteId,
  PesagemId,
} from "./identity";
import type { PesagemAnteriorCandidata } from "./pesagem";

/**
 * Pesagem de evento do capataz (`pesagens`, types.ts:3637-3689).
 *
 * `total_pesado` é a CONTAGEM de animais, apesar do nome
 * (PesagemFlowModal.tsx:146, :197 grava `pesos.length`), e `media_calculada` e
 * `peso_medio_aplicado` são campos separados.
 */
export type PesagemDeLote = {
  readonly id: PesagemId;
  readonly loteId: LoteId;
  readonly totalPesado: number;
  readonly pesos: readonly number[];
  readonly mediaCalculadaKg: number | null;
  readonly pesoMedioAplicadoKg: number | null;
  readonly dataPesagem: string;
};

/** Peso anterior de um animal, na forma que `escolherPesoAnterior` consome. */
export type PesoAnteriorDeAnimal = PesagemAnteriorCandidata<number> & {
  readonly animalId: AnimalId;
};

export interface PesagemDeLoteLeituraPort {
  buscarPorId(pesagemId: PesagemId): Promise<PesagemDeLote | null>;

  listarPorLote(loteId: LoteId): Promise<readonly PesagemDeLote[]>;
}

export interface PesoAnteriorLeituraPort {
  /**
   * Histórico de pesos do animal. A pesagem anterior só vale quando tem
   * quantidade de animais maior que zero
   * (PecuaristaPesagemExecPage.tsx:522, :571; maGmdResync.ts:62).
   */
  historicoDoAnimal(
    animalId: AnimalId,
  ): Promise<readonly PesoAnteriorDeAnimal[]>;
}

/**
 * Escrita da pesagem de lote do pecuarista.
 *
 * Todas as operações recebem o identificador já gerado no aparelho: a pesagem em
 * balança cria o UUID local antes de sincronizar
 * (PecuaristaPesagemExecPage.tsx:270, :289) e todo envio é idempotente pelo id,
 * de modo que reenviar nunca duplica (maisArrobasQueue.ts:213).
 *
 * A ordem estrita de gravação — leitura de balança antes dos pesos que dependem
 * dela, animal antes do peso — é expressa pelo campo `ordem` e garantida pelo
 * adaptador; o domínio não tem fila.
 */
export interface PesagemDeLoteEscritaPort {
  registrarLeituraBalancao(leitura: {
    readonly id: LeituraBalancaoId;
    readonly pesagemLoteId: PesagemId;
    readonly ordem: number;
    readonly pesoTotalKg: number;
    readonly quantidadeAnimais: number;
    readonly pesoIndividualKg: number;
  }): Promise<void>;

  registrarPesosAnimais(
    pesos: readonly {
      readonly id: string;
      readonly animalId: AnimalId;
      readonly pesagemLoteId: PesagemId;
      readonly pesoKg: number;
      readonly gmdIndividualKgDia: number | null;
      readonly leituraBalancaoId: LeituraBalancaoId | null;
    }[],
  ): Promise<void>;

  /**
   * `horaInicio` e `horaFim` chegam prontos porque o instante é decidido fora do
   * domínio (PecuaristaPesagemExecPage.tsx:504-511).
   */
  finalizarPesagem(input: {
    readonly pesagemLoteId: PesagemId;
    readonly loteId: LoteId;
    readonly fechamento: FechamentoPesagem;
    readonly dataPesagem: string;
    readonly horaInicio: string | null;
    readonly horaFim: string;
  }): Promise<void>;
}