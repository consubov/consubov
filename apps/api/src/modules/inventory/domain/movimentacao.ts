import type { RetiroId } from "../../pastures";
import type { BucketPeriodo } from "./periodo";

/**
 * `movimentacoes_estoque.tipo` — CHECK IN ('entrada','saida',
 * 'transferencia_envio','transferencia_recebimento')
 * (migration 20260408120801:36).
 */
export type MovimentacaoTipo =
  | "entrada"
  | "saida"
  | "transferencia_envio"
  | "transferencia_recebimento";

/**
 * `movimentacoes_estoque.origem` — CHECK IN ('compra','salga',
 * 'transferencia','ajuste') (migration 20260408120801:39).
 *
 * O legado grava também o valor "lancamento_manual"
 * (LancamentosManuaisPendentes.tsx:275), que está FORA deste CHECK. O tipo não
 * o declara: aceitar aqui validaria um valor que a base rejeita.
 */
export type MovimentacaoOrigem =
  | "compra"
  | "salga"
  | "transferencia"
  | "ajuste";

/**
 * Sinal do efeito de uma movimentação sobre `estoque_retiro.quantidade_atual`:
 * subtrair na origem e somar no destino nunca se anulam, porque cada movimento é
 * gravado em um bucket do próprio retiro (useEstoqueData.ts:239 subtrai na
 * origem, :257 soma no destino, :269-270 grava os dois tipos).
 */
export type SinalMovimentacao = 1 | -1;

export const SINAL_POR_TIPO: Readonly<
  Record<MovimentacaoTipo, SinalMovimentacao>
> = {
  entrada: 1,
  saida: -1,
  transferencia_envio: -1,
  transferencia_recebimento: 1,
};

export function sinalDoMovimento(tipo: MovimentacaoTipo): SinalMovimentacao {
  return SINAL_POR_TIPO[tipo];
}

/**
 * Leitura de `movimentacoes_estoque` (migration 20260408120801:32-42).
 * `mes`/`ano` aqui não têm CHECK: a movimentação herda o bucket do movimento.
 */
export type MovimentacaoEstoque = {
  readonly id: string;
  readonly retiroId: RetiroId;
  readonly periodo: BucketPeriodo;
  readonly tipo: MovimentacaoTipo;
  readonly quantidade: number;
  readonly origem: MovimentacaoOrigem;
  readonly referenciaId: string | null;
};