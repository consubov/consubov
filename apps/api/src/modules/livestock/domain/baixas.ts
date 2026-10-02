import type { PastoId } from "../../pastures";

/**
 * Baixas de cabeças que diminuem o pasto: abate e mortalidade. São diferentes
 * entre si — o abate mexe no peso médio do pasto, a mortalidade exige prova
 * fotográfica — por isso ficam separadas das regras de configuração do pasto.
 */

export type PastoComSaldo = {
  pastoId: PastoId;
  numAnimais: number;
  pesoMedioKg: number | null;
};

export type EntradaAbate = {
  pasto: PastoComSaldo;
  quantidade: number;
  /** Peso de abate informado; quando ausente, o peso médio do pasto é preservado. */
  pesoAbateKg?: number | null;
};

export type AbateRecusado = {
  ok: false;
  motivo: "QUANTIDADE_INVALIDA" | "QUANTIDADE_ACIMA_DO_SALDO";
};

/**
 * `peso_medio_kg` volta como null quando o pasto fica sem animais: sem saldo não
 * há peso médio a manter.
 */
export type AbateAprovado = {
  ok: true;
  num_animais_restante: number;
  peso_medio_kg: number | null;
};

export type AbateDecisao = AbateRecusado | AbateAprovado;

/**
 * Abate parcial recalcula o peso médio do pasto descontando o peso abatido:
 * (saldo × médio − abatidos × peso de abate) / restante, com uma casa decimal.
 * Pasto sem peso médio conhecido mantém o valor nulo; pasto que zera o saldo
 * fica sem peso médio.
 * Fonte: apps/web/src/components/mapa/MapaAbateModal.tsx:30 e :40-52
 */
export function decidirAbate(entrada: EntradaAbate): AbateDecisao {
  const { pasto, quantidade } = entrada;

  if (!quantidade || quantidade <= 0) {
    return { ok: false, motivo: "QUANTIDADE_INVALIDA" };
  }
  if (quantidade > pasto.numAnimais) {
    return { ok: false, motivo: "QUANTIDADE_ACIMA_DO_SALDO" };
  }

  const restante = pasto.numAnimais - quantidade;
  const pesoMedio = pasto.pesoMedioKg;

  if (!pesoMedio) {
    return {
      ok: true,
      num_animais_restante: restante,
      peso_medio_kg: pesoMedio,
    };
  }
  if (restante <= 0) {
    return { ok: true, num_animais_restante: restante, peso_medio_kg: null };
  }

  const pesoAbate = entrada.pesoAbateKg;
  const novoPesoMedio = pesoAbate
    ? (pasto.numAnimais * pesoMedio - quantidade * pesoAbate) / restante
    : pesoMedio;

  return {
    ok: true,
    num_animais_restante: restante,
    peso_medio_kg: Math.max(0, Math.round(novoPesoMedio * 10) / 10),
  };
}

export type EntradaMortalidade = {
  pastoId: PastoId | null;
  numAnimaisNoPasto: number;
  quantidade: number;
  fotoAnimalUrl: string | null;
  fotoBrincoUrl: string | null;
};

export type MortalidadeRecusado = {
  ok: false;
  motivo:
    | "PASTO_NAO_INFORMADO"
    | "FOTO_ANIMAL_OBRIGATORIA"
    | "FOTO_BRINCO_OBRIGATORIA"
    | "QUANTIDADE_INVALIDA";
};

export type MortalidadeAprovado = {
  ok: true;
  num_animais_restante: number;
};

export type MortalidadeDecisao = MortalidadeRecusado | MortalidadeAprovado;

/**
 * A mortalidade é registrada em duas fotos — o animal e o brinco — e só pode
 * retirar cabeças que existem no pasto. Diferente do abate, ela não altera o
 * peso médio: o saldo do pasto é o único campo atualizado.
 * Fonte: apps/web/src/components/capataz/MortalidadeModal.tsx:122-124 e :142-145
 */
export function decidirMortalidade(
  entrada: EntradaMortalidade,
): MortalidadeDecisao {
  if (!entrada.pastoId) {
    return { ok: false, motivo: "PASTO_NAO_INFORMADO" };
  }
  if (!entrada.fotoAnimalUrl) {
    return { ok: false, motivo: "FOTO_ANIMAL_OBRIGATORIA" };
  }
  if (!entrada.fotoBrincoUrl) {
    return { ok: false, motivo: "FOTO_BRINCO_OBRIGATORIA" };
  }
  if (entrada.quantidade < 1) {
    return { ok: false, motivo: "QUANTIDADE_INVALIDA" };
  }
  if (entrada.quantidade > entrada.numAnimaisNoPasto) {
    return { ok: false, motivo: "QUANTIDADE_INVALIDA" };
  }

  return {
    ok: true,
    num_animais_restante: entrada.numAnimaisNoPasto - entrada.quantidade,
  };
}
