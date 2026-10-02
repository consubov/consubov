import type { RetiroId } from "../../pastures";
import { InventarioContratoError } from "./errors";
import type { TransferenciaEstoqueId } from "./identity";

/** `transferencias_estoque.status` — CHECK IN ('pendente','aprovado','recusado') (migration 20260408120801:65). */
export type TransferenciaEstoqueStatus = "pendente" | "aprovado" | "recusado";

/** `transferencias_estoque.tipo_acao` — CHECK IN ('solicitacao','envio') (migration 20260408120801:67). */
export type TransferenciaTipoAcao = "solicitacao" | "envio";

/** `transferencias_estoque` (migration 20260408120801:61-73). */
export type TransferenciaEstoque = {
  readonly id: TransferenciaEstoqueId;
  readonly retiroOrigemId: RetiroId;
  readonly retiroDestinoId: RetiroId;
  readonly quantidade: number;
  readonly status: TransferenciaEstoqueStatus;
  readonly tipoAcao: TransferenciaTipoAcao;
};

/**
 * Reproduz os CHECKs da tabela: quantidade maior que zero e origem diferente do
 * destino. Não há outra regra de transferência comprovada.
 */
export function criarTransferenciaEstoque(input: {
  id: TransferenciaEstoqueId;
  retiroOrigemId: RetiroId;
  retiroDestinoId: RetiroId;
  quantidade: number;
  status?: TransferenciaEstoqueStatus;
  tipoAcao: TransferenciaTipoAcao;
}): TransferenciaEstoque {
  if (!Number.isInteger(input.quantidade) || input.quantidade <= 0) {
    throw new InventarioContratoError(
      "TRANSFERENCIA_INVALIDA",
      "A quantidade transferida deve ser um inteiro maior que zero.",
    );
  }

  if (input.retiroOrigemId === input.retiroDestinoId) {
    throw new InventarioContratoError(
      "TRANSFERENCIA_INVALIDA",
      "O retiro de origem deve ser diferente do retiro de destino.",
    );
  }

  return {
    id: input.id,
    retiroOrigemId: input.retiroOrigemId,
    retiroDestinoId: input.retiroDestinoId,
    quantidade: input.quantidade,
    status: input.status ?? "pendente",
    tipoAcao: input.tipoAcao,
  };
}