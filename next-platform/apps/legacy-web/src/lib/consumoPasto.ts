// Normalização de unidades de consumo por pasto (Relatto / visitas técnicas).
// Regra: Consumo Esperado e Consumo Real usados no Índice/Meta são SEMPRE
// expressos na mesma base — kg/dia do lote inteiro.
// O consumo por cabeça é informação complementar, fora do cálculo do índice.

export type PastoConsumoInput = {
  tipo_produto?: string | null;
  percentual_pv?: string | null;
  qtd_animais?: number | null;
  peso_medio_kg?: number | null;
  consumo_esperado_kg?: number | null;
  consumo_real_kg?: number | null;
  consumo_kg_dia?: number | null;
  meta_g_100kg?: number | null;
  kg_consumidos?: number | null;
  dias_consumo?: number | null;
};

export type ConsumoNormalizado = {
  modo: "mineral" | "racao" | "outro" | "proteinado" | "";
  animais: number;
  pesoMedio: number;
  pesoVivoTotal: number;
  /** kg/dia do lote inteiro */
  espTotal: number;
  /** kg/dia do lote inteiro */
  realTotal: number;
  /** kg/cab/dia */
  espCab: number;
  /** kg/cab/dia */
  realCab: number;
  /** Real ÷ Esperado × 100 (mesma base) */
  indice: number;
};

export function parsePercentPv(v?: string | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

export function modoDoProduto(tipo?: string | null): ConsumoNormalizado["modo"] {
  const t = (tipo || "").toLowerCase();
  if (t === "mineral") return "mineral";
  if (t === "racao" || t === "ração") return "racao";
  if (t === "outro") return "outro";
  if (t.startsWith("proteinado")) return "proteinado";
  return "";
}

export function normalizarConsumoPasto(p: PastoConsumoInput): ConsumoNormalizado {
  const modo = modoDoProduto(p.tipo_produto);
  const animais = Number(p.qtd_animais) || 0;
  const pesoMedio = Number(p.peso_medio_kg) || 0;
  const pesoVivoTotal = animais * pesoMedio;

  const espArmazenado = Number(p.consumo_esperado_kg) || 0;
  const realArmazenado = Number(p.consumo_real_kg ?? p.consumo_kg_dia) || 0;

  let espTotal = 0;
  let realTotal = 0;

  if (modo === "mineral") {
    // valores gravados são por cabeça (kg/cab/dia)
    const meta = Number(p.meta_g_100kg) || 0;
    const espCabCalc = meta > 0 && pesoMedio > 0 ? (meta / 100) * pesoMedio / 1000 : espArmazenado;
    const kg = Number(p.kg_consumidos) || 0;
    const dias = Number(p.dias_consumo) || 0;
    const realCabCalc = animais > 0 && dias > 0 && kg > 0 ? kg / (animais * dias) : realArmazenado;
    espTotal = espCabCalc * animais;
    realTotal = realCabCalc * animais;
  } else if (modo === "racao" || modo === "outro") {
    const kg = Number(p.kg_consumidos) || 0;
    const dias = Number(p.dias_consumo) || 0;
    const realCabCalc = animais > 0 && dias > 0 && kg > 0 ? kg / (animais * dias) : realArmazenado;
    realTotal = realCabCalc * animais;
    espTotal = espArmazenado > 0 ? espArmazenado * animais : 0;
  } else {
    // Proteinado (ou não informado): esperado sempre recalculado como total do lote
    const pct = parsePercentPv(p.percentual_pv);
    if (pct > 0 && pesoVivoTotal > 0) {
      espTotal = (pesoVivoTotal * pct) / 100;
    } else if (espArmazenado > 0) {
      // legado: se o valor gravado é claramente por cabeça, converte para o lote
      espTotal = animais > 0 && pesoMedio > 0 && espArmazenado < pesoVivoTotal * 0.0005
        ? espArmazenado * animais
        : espArmazenado;
    }
    realTotal = realArmazenado;
  }

  const espCab = animais > 0 ? espTotal / animais : 0;
  const realCab = animais > 0 ? realTotal / animais : 0;
  const indice = espTotal > 0 && realTotal > 0 ? (realTotal / espTotal) * 100 : 0;

  return { modo, animais, pesoMedio, pesoVivoTotal, espTotal, realTotal, espCab, realCab, indice };
}

export function fmtKgDia(v: number): string {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg/dia`;
}

export function fmtPorCabeca(v: number): string {
  if (v <= 0) return "—";
  return v < 1
    ? `${(v * 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g/cab/dia`
    : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg/cab/dia`;
}
