export type CategoriaConsumo = "Recria 1" | "Recria 2" | "Engorda";

/**
 * Categoria calculada ao vivo a partir de peso e sexo do lote.
 *
 * Fêmea: <=220 Recria 1, <=299 Recria 2, acima disso Engorda.
 * Macho: <=220 Recria 1, <=360 Recria 2, acima disso Engorda.
 * Origem: apps/web/src/lib/consumoCalc.ts:46-52.
 */
export function calcularCategoriaViva(
  pesoMedioKg: number,
  sexo?: string | null,
): CategoriaConsumo {
  const s = (sexo || "").toLowerCase();
  const femea =
    s.startsWith("f") || s.includes("fêmea") || s.includes("femea");

  if (pesoMedioKg <= 220) return "Recria 1";
  if (femea) return pesoMedioKg <= 299 ? "Recria 2" : "Engorda";
  return pesoMedioKg <= 360 ? "Recria 2" : "Engorda";
}

/**
 * Categoria por peso, sem sexo: <250 Recria 1, <350 Recria 2, acima disso Engorda.
 * Origem: apps/web/src/lib/consumoCalc.ts:249-253 e gatilho do banco em
 * migrations/20260404011534_95fb28e9….sql:44-47.
 *
 * Os cortes deste dialeto (250/350) NÃO são os de calcularCategoriaViva
 * (220/299/360). Os dois existem em produção, por caminhos diferentes, e estão
 * preservados separados de propósito: unificar mudaria o consumo esperado do
 * lote sem evidência de que seja uma correção.
 */
export function classificarCategoria(pesoMedioKg: number): CategoriaConsumo {
  if (pesoMedioKg < 250) return "Recria 1";
  if (pesoMedioKg < 350) return "Recria 2";
  return "Engorda";
}

export type ChaveCategoriaConsumo = "recria1" | "recria2" | "engorda";

/**
 * Normaliza o texto livre de categoria na chave usada para escolher as colunas do
 * produto. Aceita "Recria 1" e "Recria1" (espaço opcional) e cai em Engorda
 * para qualquer texto desconhecido.
 *
 * Extrai a comparação repetida em apps/web/src/lib/consumoCalc.ts:84-86, :263-265
 * e :276-278, preservando a semântica de `includes` sobre o texto em minúsculas.
 */
export function chaveCategoriaConsumo(
  categoria: string,
): ChaveCategoriaConsumo {
  const cat = (categoria || "").toLowerCase();

  if (cat.includes("recria 1") || cat.includes("recria1")) return "recria1";
  if (cat.includes("recria 2") || cat.includes("recria2")) return "recria2";
  return "engorda";
}
