import { JANELA_CONSUMO_DIAS } from "./periodo";

/**
 * Consumo médio diário do retiro: soma de `lancamentos.num_sacos` da janela de
 * 30 dias dividida por 30 (useEstoqueData.ts:77-90, :95).
 *
 * A fonte é o lançamento, não a movimentação de estoque — as duas grandezas não
 * são a mesma coisa e o saldo do bucket nunca é recalculado a partir delas.
 */
export function derivarConsumoMedioDiario(totalSacosNaJanela: number): number {
  return totalSacosNaJanela / JANELA_CONSUMO_DIAS;
}

/**
 * Mesma métrica já arredondada para 1 casa na exibição
 * (useEstoqueData.ts:107).
 */
export function arredondarConsumoMedioDiario(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Dias de estoque restantes; `null` quando não há consumo para divisão
 * (useEstoqueData.ts:97).
 *
 * Retirada sem bucket cadastrado vale saldo zero
 * (`estoque?.quantidade_atual ?? 0`, useEstoqueData.ts:96).
 */
export function derivarDiasRestantes(
  quantidadeAtual: number,
  consumoMedioDiario: number,
): number | null {
  return consumoMedioDiario > 0
    ? Math.floor(quantidadeAtual / consumoMedioDiario)
    : null;
}

/**
 * Leitura de tela do estoque por bucket (useEstoqueData.ts:5-15, :99-110).
 * O saldo é a coluna materializada do bucket; consumo e dias são derivados.
 */
export type EstoqueRetiro = {
  readonly id: string;
  readonly retiroId: string;
  readonly mes: number;
  readonly ano: number;
  readonly quantidadeAtual: number;
  readonly ultimoAlertaEstoque: string | null;
  readonly consumoMedioDiario: number;
  readonly diasRestantes: number | null;
};