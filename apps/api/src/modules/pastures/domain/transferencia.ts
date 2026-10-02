import type { PastoId } from "./identity";
import { isCategoriaValida } from "./identity";

/**
 * Transferência de cabeças entre pastos do MESMO retiro. É uma decisão pura:
 * devolve o saldo debitado na origem, o creditado no destino e a categoria
 * resultante. A gravação dos saldos e do lançamento é do adaptador.
 */

export type PastoDaTransferencia = {
  id: PastoId;
  num_animais: number;
  categoria: string | null;
};

export type TransferenciaEntrePastos = {
  origem: PastoDaTransferencia;
  /** `null` quando o pasto destino informado não pertence ao retiro. */
  destino: PastoDaTransferencia | null;
  quantidade: number;
  categoriaDestino?: string | null;
};

export type MotivoTransferenciaRecusada =
  | "QUANTIDADE_INVALIDA"
  | "QUANTIDADE_ACIMA_DO_SALDO"
  | "DESTINO_NAO_ENCONTRADO"
  | "DESTINO_IGUAL_ORIGEM"
  | "CATEGORIA_DESTINO_OBRIGATORIA";

export type TransferenciaRecusada = {
  ok: false;
  motivo: MotivoTransferenciaRecusada;
};

export type TransferenciaAprovada = {
  ok: true;
  num_animais_origem: number;
  num_animais_destino: number;
  categoria_destino: string | null;
};

export type TransferenciaDecisao =
  | TransferenciaAprovada
  | TransferenciaRecusada;

/**
 * Uma transferência não é uma leitura de cocho: por isso zero sacos e um dia no
 * pasto, e origem "transferencia" no lançamento gerado.
 * Fonte: apps/web/src/pages/PastoDetailPage.tsx:162-165
 */
export const TRANSFERENCIA_LANCAMENTO = {
  origem: "transferencia",
  num_sacos: 0,
  dias_no_pasto: 1,
} as const;

/**
 * A ordem das recusas é a mesma do legado: quantidade inválida, quantidade
 * acima do saldo, destino inexistente, destino igual à origem e categoria
 * obrigatória quando o destino não tem categoria válida. Um destino sem
 * categoria válida recebe a categoria informada na transferência; com categoria
 * válida, a do destino é preservada.
 * Fonte: apps/web/src/pages/PastoDetailPage.tsx:128-136 e :151
 */
export function decidirTransferenciaEntrePastos(
  input: TransferenciaEntrePastos,
): TransferenciaDecisao {
  const { origem, destino, quantidade } = input;

  if (!quantidade || quantidade <= 0) {
    return { ok: false, motivo: "QUANTIDADE_INVALIDA" };
  }
  if (quantidade > origem.num_animais) {
    return { ok: false, motivo: "QUANTIDADE_ACIMA_DO_SALDO" };
  }
  if (!destino) {
    return { ok: false, motivo: "DESTINO_NAO_ENCONTRADO" };
  }
  if (destino.id === origem.id) {
    return { ok: false, motivo: "DESTINO_IGUAL_ORIGEM" };
  }

  const destinoSemCategoria = !isCategoriaValida(destino.categoria);
  if (destinoSemCategoria && !isCategoriaValida(input.categoriaDestino)) {
    return { ok: false, motivo: "CATEGORIA_DESTINO_OBRIGATORIA" };
  }

  return {
    ok: true,
    num_animais_origem: origem.num_animais - quantidade,
    num_animais_destino: destino.num_animais + quantidade,
    categoria_destino: destinoSemCategoria
      ? (input.categoriaDestino as string)
      : destino.categoria,
  };
}
