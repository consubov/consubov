import type { VisitaIndicadorLinha } from "./visita";

/**
 * O valor manual prevalece sobre o automático apenas quando não é vazio depois
 * de `trim()`, chave a chave (apps/web/src/pages/RevisaoVisitaPage.tsx:737-740).
 * Sem manual, usa o valor automático calculado a partir dos pastos avaliados.
 */
export function resolverValorIndicador(
  valorManual: string | null | undefined,
  valorAutomatico: string,
): string {
  return (valorManual ?? "").trim() || valorAutomatico;
}

export type RebanhoComPeso = {
  qtd_animais: number | null;
  peso_medio_kg: number | null;
};

/**
 * Peso médio do rebanho avaliado = média ponderada por quantidade de animales,
 * considerando somente os pastos com `peso_medio_kg > 0`, arredondada para
 * inteiro (apps/web/src/pages/RevisaoVisitaPage.tsx:148-150). Devolve 0 quando
 * nenhum pasto tem peso, caso em que a tela exibe "—" (RevisaoVisitaPage.tsx:164).
 */
export function pesoMedioRebanho(pastos: readonly RebanhoComPeso[]): number {
  const somaPeso = pastos.reduce(
    (soma, pasto) =>
      soma + (Number(pasto.qtd_animais ?? 0) * Number(pasto.peso_medio_kg ?? 0)),
    0,
  );
  const animaisComPeso = pastos.reduce(
    (soma, pasto) =>
      soma +
      (Number(pasto.peso_medio_kg ?? 0) > 0 ? Number(pasto.qtd_animais ?? 0) : 0),
    0,
  );

  return animaisComPeso > 0 ? Math.round(somaPeso / animaisComPeso) : 0;
}

export type IndicadorAutomatico = {
  manual: Readonly<Partial<Record<VisitaIndicadorLinha["key"], string>>>;
  automatico: Readonly<Record<VisitaIndicadorLinha["key"], string>>;
};

/**
 * Mescla a tabela final do relatório aplicando a precedência manual→automático
 * (apps/web/src/pages/RevisaoVisitaPage.tsx:737-740). A ordem das linhas e os
 * rótulos são preservados porque o relatório consome a lista na ordem gravada.
 */
export function resolverTabelaIndicadores(
  linhas: readonly VisitaIndicadorLinha[],
  automatico: IndicadorAutomatico,
): VisitaIndicadorLinha[] {
  return linhas.map((linha) => ({
    key: linha.key,
    label: linha.label,
    value: resolverValorIndicador(automatico.manual[linha.key], automatico.automatico[linha.key] ?? ""),
  }));
}