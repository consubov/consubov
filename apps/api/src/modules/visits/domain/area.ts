export type AreaResolvida = {
  area: number | null;
  origem: "pastos" | "manual" | null;
  comArea: number;
  totalPastos: number;
  /** Texto exibido no relatório; a frase é parte do comportamento testado (taxaLotacao.test.ts:31,43). */
  nota: string | null;
};

/**
 * Precedência de área (apps/web/src/pages/RevisaoVisitaPage.tsx:107-137):
 * se ao menos um pasto tem `area_alqueires > 0`, vale a soma dessas áreas e o
 * total manual é ignorado; sem nenhuma área por pasto, vale o total manual; sem
 * nenhuma das duas, não há área. A área resolvida é a base da taxa de lotação
 * exibida no relatório (RevisaoVisitaPage.tsx:804).
 *
 * As mensagens de `nota` são preservadas porque são enviadas ao relatório como
 * `nota_area` (RevisaoVisitaPage.tsx:804) e cobertas por teste de regressão
 * (apps/web/src/test/taxaLotacao.test.ts:31,43).
 */
export function resolverAreaTotal(
  pastos: readonly { area_alqueires?: number | null }[],
  areaManual: number | null,
): AreaResolvida {
  const totalPastos = pastos.length;
  const comArea = pastos.filter((pasto) => Number(pasto.area_alqueires ?? 0) > 0);
  const somaPastos = comArea.reduce(
    (soma, pasto) => soma + Number(pasto.area_alqueires ?? 0),
    0,
  );

  if (comArea.length > 0 && somaPastos > 0) {
    const parcial = comArea.length < totalPastos;

    return {
      area: somaPastos,
      origem: "pastos",
      comArea: comArea.length,
      totalPastos,
      nota: parcial
        ? `Calculado com base na área informada por pasto — área somada de ${comArea.length} de ${totalPastos} pastos avaliados.`
        : "Calculado com base na área informada por pasto.",
    };
  }

  const manual = Number(areaManual ?? 0);
  if (manual > 0) {
    return {
      area: manual,
      origem: "manual",
      comArea: 0,
      totalPastos,
      nota: "Calculado com base na área total informada.",
    };
  }

  return { area: null, origem: null, comArea: 0, totalPastos, nota: null };
}