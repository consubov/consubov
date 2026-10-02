import { arredondar2 } from "./arredondamento";
import type { LeituraBalancaoId, TipoBalanca } from "./identity";

/**
 * Balanção agrupa o peso de vários animais numa única leitura. A quantidade por
 * leitura só faz sentido entre 2 e 5, e é esse o conjunto oferecido na tela
 * (PecuaristaPesagemExecPage.tsx:800, PesadorPesagemExecPage.tsx:292).
 */
export const QUANTIDADE_BALANCAO_MINIMA = 2;
export const QUANTIDADE_BALANCAO_MAXIMA = 5;

/**
 * Interpreta o peso digitado, aceitando vírgula decimal
 * (`parseFloat(texto.replace(",", "."))`, PecuaristaPesagemExecPage.tsx:262,
 * :415; PesadorPesagemExecPage.tsx:247).
 *
 * Devolve `null` para texto não numérico, não finito ou peso não positivo: quem
 * decide o fluxo de erro é a aplicação, o domínio só recusa o valor.
 */
export function parsePesoDigitado(texto: string): number | null {
  const peso = parseFloat(texto.replace(",", "."));

  return Number.isFinite(peso) && peso > 0 ? peso : null;
}

/**
 * A quantidade persistida é o clamp do valor escolha: fora da faixa 2..5 volta
 * para 2 (PecuaristaPesagemExecPage.tsx:131-132, :265; PesadorPesagemExecPage.tsx:251).
 */
export function normalizarQuantidadeBalancao(quantidade: number): number {
  return quantidade >= QUANTIDADE_BALANCAO_MINIMA &&
    quantidade <= QUANTIDADE_BALANCAO_MAXIMA
    ? quantidade
    : QUANTIDADE_BALANCAO_MINIMA;
}

export type LeituraBalancao = {
  readonly id: LeituraBalancaoId;
  readonly tipoBalanca: TipoBalanca;
  readonly ordem: number;
  readonly pesoTotalKg: number;
  readonly quantidadeAnimais: number;
  readonly pesoIndividualKg: number;
};

export type ParametrosLeituraBalancao = {
  readonly id: LeituraBalancaoId;
  readonly ordem: number;
  readonly pesoTotalKg: number;
  /**
   * Já normalizado por `normalizarQuantidadeBalancao`; a função não re-clampa
   * porque a leitura gravada usa exatamente o valor exibido na tela.
   */
  readonly quantidadeAnimais: number;
};

/**
 * Peso individual da balançação: `round2(peso_total / quantidade_animais)`
 * (PecuaristaPesagemExecPage.tsx:268, PesadorPesagemExecPage.tsx:254).
 *
 * Devolve `null` quando o total não é positivo (PecuaristaPesagemExecPage.tsx:262)
 * ou quando a quantidade é menor que 2, o que a aplicação já bloqueia antes de
 * gravar (PecuaristaPesagemExecPage.tsx:265, PesadorPesagemExecPage.tsx:251).
 */
export function calcularLeituraBalancao(
  entrada: ParametrosLeituraBalancao,
): LeituraBalancao | null {
  if (!Number.isFinite(entrada.pesoTotalKg) || entrada.pesoTotalKg <= 0) {
    return null;
  }

  if (entrada.quantidadeAnimais < QUANTIDADE_BALANCAO_MINIMA) {
    return null;
  }

  return {
    id: entrada.id,
    tipoBalanca: "balancao",
    ordem: entrada.ordem,
    pesoTotalKg: entrada.pesoTotalKg,
    quantidadeAnimais: entrada.quantidadeAnimais,
    pesoIndividualKg: arredondar2(
      entrada.pesoTotalKg / entrada.quantidadeAnimais,
    ),
  };
}