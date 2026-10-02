/**
 * Aritmética do saldo materializado de `estoque_retiro.quantidade_atual`.
 *
 * O saldo é uma coluna por bucket (mês/ano) e nunca é recomposto a partir das
 * movimentações (migration 20260408120801:3-13); estas funções só descrevem o
 * efeito aritmético de um movimento já decidido, sem decidir a escrita.
 */

/** Soma uma quantidade ao saldo do bucket (sem piso). */
export function creditar(saldoAtual: number, quantidade: number): number {
  return saldoAtual + quantidade;
}

/**
 * Subtrai com piso zero: o saldo de estoque nunca fica negativo
 * (ProducaoTab.tsx:346, TransferenciasTab.tsx:200-201,
 * LancamentosManuaisPendentes.tsx:266 e GREATEST(0, …) em
 * migration 20260922102509:157).
 *
 * O piso esconde o excesso debitado; ele não vira estoque negativo nem gera
 * crédito posterior.
 */
export function debitar(saldoAtual: number, quantidade: number): number {
  return Math.max(0, saldoAtual - quantidade);
}