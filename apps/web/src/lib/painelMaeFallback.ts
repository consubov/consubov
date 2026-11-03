import { DataReadFailure } from "@/lib/dataReadGuard";

export interface MaePastoCanonico {
  fazenda_id: string | null;
  retiro_id: string | null;
  pasto_id: string | null;
  mes_referencia: number | null;
  ano_referencia: number | null;
  kg_fornecido: number | string | null;
  cab_dias_global: number | string | null;
  eficiencia_pasto: number | string | null;
  status_global: string | null;
  peso_medio_kg: number | string | null;
}
export interface MaeLancamentoReal {
  fazenda_id: string | null;
  retiro_id: string | null;
  mes_referencia: number | null;
  ano_referencia: number | null;
  kg_fornecido: number | string | null;
  cab_dias_assumidos: number | string | null;
}
export interface MaePastoAtivo {
  id: string;
  retiro_id: string;
  num_animais: number | null;
  peso_medio_kg: number | string | null;
}
export interface MaeFallbackScope {
  fazendaId: string;
  retiroId: string | null;
  mes: number;
  ano: number;
  retiroIds: readonly string[];
}

export interface MaeFallbackAggregate {
  consumo_real_g_cab_dia: number;
  consumo_global_g_cab_dia: number;
  eficiencia: number;
  pastos_na_meta_num: number;
  pastos_na_meta_den: number;
  peso_medio_kg: number;
}

function numeric(value: number | string | null): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") throw new DataReadFailure("invalid_response");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new DataReadFailure("invalid_response");
  return n;
}

function rounded(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Same authoritative source views and weighted formulas as get_painel_mae.
 * Used only when that RPC is unavailable. Does not replace SQL definitions.
 * Every row is validated against the caller's confirmed farm and period.
 */
export function aggregatePainelMaeFallback(
  scope: MaeFallbackScope,
  maes: readonly MaePastoCanonico[],
  reais: readonly MaeLancamentoReal[],
  pastos: readonly MaePastoAtivo[],
): MaeFallbackAggregate {
  const retiroIds = new Set(scope.retiroIds);
  const matchesScope = (row: {
    fazenda_id: string | null;
    retiro_id: string | null;
    mes_referencia: number | null;
    ano_referencia: number | null;
  }) =>
    row.fazenda_id === scope.fazendaId &&
    row.retiro_id != null &&
    retiroIds.has(row.retiro_id) &&
    (scope.retiroId == null || row.retiro_id === scope.retiroId) &&
    row.mes_referencia === scope.mes &&
    row.ano_referencia === scope.ano;

  const pesoPorPasto = new Map<string, number | null>();
  let kgGlobal = 0, diasGlobal = 0, eficienciaPonderada = 0, naMeta = 0;
  for (const row of maes) {
    if (!matchesScope(row) || !row.pasto_id || pesoPorPasto.has(row.pasto_id)) {
      throw new DataReadFailure("permission");
    }
    const kg = numeric(row.kg_fornecido);
    const dias = numeric(row.cab_dias_global);
    const eficiencia = numeric(row.eficiencia_pasto);
    kgGlobal += kg ?? 0;
    diasGlobal += dias ?? 0;
    if (eficiencia != null && dias != null) eficienciaPonderada += eficiencia * dias;
    if (row.status_global === "Ideal" || row.status_global === "Atenção") naMeta++;
    pesoPorPasto.set(row.pasto_id, numeric(row.peso_medio_kg));
  }

  let kgReal = 0, diasReais = 0;
  for (const row of reais) {
    if (!matchesScope(row)) throw new DataReadFailure("permission");
    kgReal += numeric(row.kg_fornecido) ?? 0;
    diasReais += numeric(row.cab_dias_assumidos) ?? 0;
  }

  let pesoPonderado = 0, animais = 0;
  const pastosUnicos = new Set<string>();
  for (const pasto of pastos) {
    if (
      !pasto.id || pastosUnicos.has(pasto.id) ||
      !retiroIds.has(pasto.retiro_id) ||
      (scope.retiroId != null && pasto.retiro_id !== scope.retiroId)
    ) {
      throw new DataReadFailure("permission");
    }
    pastosUnicos.add(pasto.id);
    const n = numeric(pasto.num_animais);
    if (n == null || n <= 0) continue;
    const peso = pesoPorPasto.get(pasto.id) ?? numeric(pasto.peso_medio_kg) ?? 0;
    pesoPonderado += peso * n;
    animais += n;
  }

  return {
    consumo_real_g_cab_dia: diasReais > 0 ? rounded(kgReal * 1000 / diasReais, 2) : 0,
    consumo_global_g_cab_dia: diasGlobal > 0 ? rounded(kgGlobal * 1000 / diasGlobal, 2) : 0,
    eficiencia: diasGlobal > 0 ? rounded(eficienciaPonderada / diasGlobal, 1) : 0,
    pastos_na_meta_num: naMeta,
    pastos_na_meta_den: maes.length,
    peso_medio_kg: animais > 0 ? rounded(pesoPonderado / animais, 1) : 0,
  };
}
