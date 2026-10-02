import type { PastoId } from "./identity";

/**
 * Cabeças do retiro. O rebanho do domínio principal é contagem agregada por
 * pasto (`pastos.num_animais`), sem identidade individual por cabeça.
 */

export type PastoCabecas = {
  id: PastoId;
  num_animais: number | null;
};

export type LancamentoCabecas = {
  pasto_id: PastoId;
  num_animais: number | null;
};

export type CabecasRetiroInput = {
  /** `null` quando o ciclo do período não existe. */
  cicloFechado: boolean | null | undefined;
  pastos: readonly PastoCabecas[];
  lancamentos: readonly LancamentoCabecas[];
};

// O legado soma com `|| 0`, que também zera valores não numéricos como NaN.
function toCabecas(value: number | null | undefined): number {
  return value || 0;
}

/**
 * Ciclo fechado (o ciclo existe e `fechado === true`) usa o retrato histórico:
 * Σ do MÁXIMO de `num_animais` por pasto nos lançamentos do período. Ciclo
 * aberto ou inexistente usa o dado vivo: Σ de `pastos.num_animais`.
 * Fonte: apps/web/src/hooks/useTotalAnimaisRetiro.ts:54-88
 */
export function totalCabecasRetiro(input: CabecasRetiroInput): number {
  const cicloFechado = input.cicloFechado === true;

  if (!cicloFechado) {
    return input.pastos.reduce(
      (total, pasto) => total + toCabecas(pasto.num_animais),
      0,
    );
  }

  const maxPorPasto = new Map<PastoId, number>();
  for (const lancamento of input.lancamentos) {
    const atual = maxPorPasto.get(lancamento.pasto_id) ?? 0;
    const numAnimais = toCabecas(lancamento.num_animais);
    if (numAnimais > atual) {
      maxPorPasto.set(lancamento.pasto_id, numAnimais);
    }
  }

  let soma = 0;
  for (const valor of maxPorPasto.values()) soma += valor;
  return soma;
}
