/**
 * Shared consumption calculation logic used by both QR (capataz) and manual (admin) flows.
 * The only difference between flows is HOW "dias" is obtained:
 *   - QR Code: dias = auto-calculated dias_intervalo (current - previous lancamento date)
 *   - Manual:  dias = user-entered dias_no_pasto
 * All other calculations are identical.
 */

export interface ConsumoInput {
  num_sacos: number;
  peso_saco_kg: number;
  num_animais: number;
  dias: number; // dias_intervalo (QR) or dias_no_pasto (manual)
  peso_medio_kg: number;
  /** consumo esperado por 100kg PV, based on product + category (g/cab/dia) */
  consumo_por_100kg_categoria: number;
  /** margin tolerance from product (g/cab/dia) */
  margem: number;
}

export interface ConsumoResult {
  /** g/cab/dia */
  consumo_real_g_cab_dia: number;
  /** g/cab/dia */
  consumo_esperado_g_cab_dia: number;
  /** total kg consumed */
  consumo_real_kg: number;
  /** total kg expected */
  consumo_esperado_kg: number;
  /** ratio real/expected */
  indice_consumo: number;
  /** ABAIXO | IDEAL | ACIMA | ERRO */
  status_consumo: string;
}

/**
 * Calculate consumption metrics.
 * Formula: consumo_real = (num_sacos * peso_saco_kg) / (num_animais * dias) * 1000  → g/cab/dia
 * Formula: consumo_esperado = (consumo_por_100kg_categoria * peso_medio_kg) / 100 * 1000 → g/cab/dia
 * Classification uses product margin (not fixed 0.9/1.1).
 */
export function calcularConsumo(input: ConsumoInput): ConsumoResult | null {
  const { num_sacos, peso_saco_kg, num_animais, dias, peso_medio_kg, consumo_por_100kg_categoria, margem } = input;

  if (num_animais <= 0 || dias <= 0 || peso_saco_kg <= 0) return null;

  // consumo_real in g/cab/dia
  const consumo_real_g_cab_dia = (num_sacos * peso_saco_kg) / (num_animais * dias) * 1000;
  const consumo_real_kg = num_sacos * peso_saco_kg;

  // consumo_esperado in g/cab/dia
  // consumo_por_100kg is in kg (e.g. 0.03 kg per 100kg PV)
  // Formula: (consumo_por_100kg * peso_medio) / 100 = kg/cab/dia → * 1000 = g/cab/dia
  const consumo_esperado_g_cab_dia = (consumo_por_100kg_categoria * peso_medio_kg) / 100 * 1000;
  const consumo_esperado_kg = (consumo_esperado_g_cab_dia / 1000) * num_animais * dias;

  if (consumo_esperado_g_cab_dia <= 0) {
    return {
      consumo_real_g_cab_dia,
      consumo_esperado_g_cab_dia: 0,
      consumo_real_kg,
      consumo_esperado_kg: 0,
      indice_consumo: 0,
      status_consumo: 'ERRO',
    };
  }

  const indice_consumo = Number((consumo_real_kg / consumo_esperado_kg).toFixed(2));

  // Classification based on product margin
  // margem is per 100kg PV → escala pelo peso médio: margem × peso_medio_kg × 10 (g/cab/dia)
  const margem_g = margem * peso_medio_kg * 10;
  let status_consumo: string;
  if (margem_g > 0) {
    // Margin-based: compare g/cab/dia against expected ± margin (in g)
    if (consumo_real_g_cab_dia < (consumo_esperado_g_cab_dia - margem_g)) {
      status_consumo = 'ABAIXO';
    } else if (consumo_real_g_cab_dia > (consumo_esperado_g_cab_dia + margem_g)) {
      status_consumo = 'ACIMA';
    } else {
      status_consumo = 'IDEAL';
    }
  } else {
    // Fallback to index-based if no margin defined (unified 0.8/1.2 thresholds)
    status_consumo = indice_consumo < 0.8 ? 'ABAIXO' : indice_consumo > 1.2 ? 'ACIMA' : 'IDEAL';
  }

  return {
    consumo_real_g_cab_dia,
    consumo_esperado_g_cab_dia,
    consumo_real_kg,
    consumo_esperado_kg,
    indice_consumo,
    status_consumo,
  };
}

/**
 * Auto-classify category based on peso_medio_kg.
 * Recria 1: < 250 kg
 * Recria 2: 250-349 kg
 * Engorda: >= 350 kg
 */
/**
 * Unified status classification based on índice de consumo (real / esperado).
 * This SINGLE function must be used in ALL modules: painel, relatório, lançamentos.
 *
 * índice < 0.8  → Baixo
 * 0.8 ≤ índice ≤ 1.2 → Ideal
 * índice > 1.2  → Alto
 *
 * If no expected value is available (indice <= 0), returns "—".
 */
export function consumoStatusUnificado(indice: number): string {
  if (indice <= 0) return "—";
  if (indice < 0.8) return "Baixo";
  if (indice <= 1.2) return "Ideal";
  return "Alto";
}

/**
 * Calculate the consumption index (real / expected).
 * consumo_real and consumo_esperado both in g/cab/dia (or any same unit).
 * Returns 0 if expected is zero.
 */
export function calcIndiceConsumo(consumoReal: number, consumoEsperado: number): number {
  if (consumoEsperado <= 0 || consumoReal <= 0) return 0;
  return consumoReal / consumoEsperado;
}

/**
 * Calculate consumo esperado in g/cab/dia from product recommendation.
 * consumoPor100kg is in kg per 100kg PV (e.g. 0.03).
 * Formula: (consumoPor100kg * pesoMedioKg) / 100 * 1000
 */
export function calcConsumoEsperadoGCabDia(consumoPor100kg: number, pesoMedioKg: number): number {
  if (consumoPor100kg <= 0 || pesoMedioKg <= 0) return 0;
  return (consumoPor100kg * pesoMedioKg) / 100 * 1000;
}

/**
 * Calculate consumo_real in g/cab/dia from raw lancamento data.
 * Unified formula used across all modules.
 */
export function calcConsumoGCabDia(
  numSacos: number,
  pesoSacoKg: number,
  numAnimais: number,
  dias: number,
): number {
  if (numAnimais <= 0 || dias <= 0 || numSacos <= 0 || pesoSacoKg <= 0) return 0;
  return (numSacos * pesoSacoKg * 1000) / (numAnimais * dias);
}

export function classificarCategoria(pesoMedioKg: number): string {
  if (pesoMedioKg < 250) return 'Recria 1';
  if (pesoMedioKg < 350) return 'Recria 2';
  return 'Engorda';
}

/**
 * Get the consumo_por_100kg value for a given category from product fields.
 */
export function getConsumoPorCategoria(
  categoria: string,
  produto: { consumo_recria1?: number | null; consumo_recria2?: number | null; consumo_engorda?: number | null }
): number {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('recria 1') || cat.includes('recria1')) return Number(produto.consumo_recria1 || 0);
  if (cat.includes('recria 2') || cat.includes('recria2')) return Number(produto.consumo_recria2 || 0);
  return Number(produto.consumo_engorda || 0);
}

/**
 * Get the margin value for a given category from product fields.
 */
export function getMargemPorCategoria(
  categoria: string,
  produto: { margem_recria1?: number | null; margem_recria2?: number | null; margem_engorda?: number | null }
): number {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('recria 1') || cat.includes('recria1')) return Number(produto.margem_recria1 || 0);
  if (cat.includes('recria 2') || cat.includes('recria2')) return Number(produto.margem_recria2 || 0);
  return Number(produto.margem_engorda || 0);
}

/**
 * Calculate weighted average consumption using animal-dia (animal-days).
 * Each period between events has a different animal count.
 * 
 * @param periodos Array of { numAnimais, dias } for each sub-period
 * @param totalKgConsumido Total kg consumed in the full period
 * @returns consumo in g/cab/dia using weighted average, or 0 if invalid
 * 
 * Example:
 *   200 animals × 15 days = 3000 animal-dias
 *   100 animals × 15 days = 1500 animal-dias
 *   total_animal_dia = 4500
 *   consumo = totalKgConsumido * 1000 / 4500
 */
export function calcConsumoAnimalDia(
  periodos: { numAnimais: number; dias: number }[],
  totalKgConsumido: number,
): number {
  if (totalKgConsumido <= 0) return 0;
  const totalAnimalDia = periodos.reduce((sum, p) => sum + (p.numAnimais * p.dias), 0);
  if (totalAnimalDia <= 0) return 0;
  return (totalKgConsumido * 1000) / totalAnimalDia; // g/cab/dia
}
