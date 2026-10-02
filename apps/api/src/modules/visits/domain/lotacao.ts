/**
 * Fator de conversão alqueire → hectare efetivamente usado.
 *
 * O comentário da linha 61 da tela afirma "1 alqueire (paulista) = 2,42 ha",
 * mas o fator gravado é 4,84 (apps/web/src/pages/RevisaoVisitaPage.tsx:61-62) e
 * é o comportamento coberto pelo teste de regressão de taxa de lotação
 * (apps/web/src/test/taxaLotacao.test.ts:34). O número é o comportamento real;
 * o comentário da linha 61 está errado e não é a regra.
 */
export const ALQUEIRES_POR_HECTARE = 4.84;

/** Peso de referência da unidade animal na fórmula de UA (RevisaoVisitaPage.tsx:74). */
export const PESO_UNIDADE_ANIMAL_KG = 450;

export type TaxaDeOcupacao = {
  /** UA por alqueire. */
  porAlqueire: number;
  /** UA por hectare, obtido dividindo a taxa por 4,84 (RevisaoVisitaPage.tsx:160). */
  porHectare: number;
};

export type RebanhoAvaliavel = {
  qtd_animais: number | null;
  peso_medio_kg: number | null;
};

/**
 * UA do pasto = (qtd_animais × peso_medio_kg) / 450; devolve 0 quando qualquer
 * um dos dois fatores não é positivo, para que um pasto sem peso não some no
 * total nem invente ocupação (RevisaoVisitaPage.tsx:72-76).
 */
export function computarUnidadeAnimal(
  qtdAnimais: number | null,
  pesoMedioKg: number | null,
): number {
  const quantidade = Number(qtdAnimais ?? 0);
  const peso = Number(pesoMedioKg ?? 0);

  return quantidade > 0 && peso > 0 ? (quantidade * peso) / PESO_UNIDADE_ANIMAL_KG : 0;
}

function taxa(porAlqueire: number): TaxaDeOcupacao {
  return {
    porAlqueire,
    porHectare: porAlqueire / ALQUEIRES_POR_HECTARE,
  };
}

/**
 * Taxa de lotação do conjunto de pastos avaliados: ΣUA / área em alqueires
 * (RevisaoVisitaPage.tsx:89-97), convertida para UA/ha com o fator 4,84
 * (RevisaoVisitaPage.tsx:160).
 *
 * Devolve null quando não há área positiva nem UA positiva — a tela então não
 * exibe taxa nenhuma (RevisaoVisitaPage.tsx:93,170-171).
 */
export function computarTaxaDeOcupacao(
  pastos: readonly RebanhoAvaliavel[],
  areaAlqueires: number | null,
): TaxaDeOcupacao | null {
  const area = Number(areaAlqueires ?? 0);
  if (!(area > 0)) return null;

  const totalUnidadeAnimal = pastos.reduce(
    (soma, pasto) =>
      soma + computarUnidadeAnimal(pasto.qtd_animais, pasto.peso_medio_kg),
    0,
  );
  if (!(totalUnidadeAnimal > 0)) return null;

  return taxa(totalUnidadeAnimal / area);
}

/**
 * Taxa de um pasto isolado: UA do pasto / área em alqueires / 4,84
 * (RevisaoVisitaPage.tsx:79-86).
 */
export function computarTaxaDeOcupacaoDoPasto(
  qtdAnimais: number | null,
  pesoMedioKg: number | null,
  areaAlqueires: number | null,
): TaxaDeOcupacao | null {
  const area = Number(areaAlqueires ?? 0);
  if (!(area > 0)) return null;

  const unidadeAnimal = computarUnidadeAnimal(qtdAnimais, pesoMedioKg);
  if (!(unidadeAnimal > 0)) return null;

  return taxa(unidadeAnimal / area);
}