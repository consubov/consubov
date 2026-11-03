import { DataReadFailure } from "@/lib/dataReadGuard";

type N = number | string | null;
type Id = string | null;
interface Scoped { fazenda_id: string; retiro_id: string; mes_referencia: number; ano_referencia: number }
export interface MaeLightSource extends Scoped {
  id: string; pasto_id: string; num_animais: number | null; num_sacos: number | null;
  dias_no_pasto: number | null; consumo_g_cab_dia: N; indice_consumo: N;
  peso_medio_kg: N; created_at: string;
}
export interface MaeLightReal extends Scoped {
  lancamento_id: string; pasto_id: string; ocupacao_id: Id;
  kg_fornecido: N; cab_dias_assumidos: number | null;
}
export interface MaeLightPasto {
  id: string; retiro_id: string; num_animais: number | null; ativo: boolean;
  peso_medio_kg: N; sexo: Id; produto_id: Id;
}
export interface MaeLightRetiro {
  id: string; fazenda_id: string; produto_id: Id; peso_saco_kg: N;
}
export interface MaeLightOcupacao {
  id: string; pasto_id: string; retiro_id: string; produto_id: Id;
}
export interface MaeLightProduto {
  id: string; peso_saco_kg: N; amarelo_buffer_g: N;
  consumo_recria1: N; consumo_recria2: N; consumo_engorda: N;
  margem_mais_recria1_pct: N; margem_mais_recria2_pct: N; margem_mais_engorda_pct: N;
  margem_menos_recria1_pct: N; margem_menos_recria2_pct: N; margem_menos_engorda_pct: N;
}
export interface MaeLightOriginal { id: string; consumo_g_cab_dia: N; dias_no_pasto: number | null }
export interface MaeLightInput {
  scope: { fazendaId: string; retiroId: Id; mes: number; ano: number };
  vctr: readonly MaeLightSource[];
  reais: readonly MaeLightReal[];
  pastos: readonly MaeLightPasto[];
  retiros: readonly MaeLightRetiro[];
  ocupacoes: readonly MaeLightOcupacao[];
  produtos: readonly MaeLightProduto[];
  originais?: readonly MaeLightOriginal[];
}
export interface MaeLightResult {
  consumo_real_g_cab_dia: number;
  consumo_global_g_cab_dia: number;
  eficiencia: number;
  pastos_na_meta_num: number;
  pastos_na_meta_den: number;
  peso_medio_kg: number;
}
function num(v: N): number | null {
  if (v === null) return null;
  if (typeof v === "string" && !v.trim()) throw new DataReadFailure("invalid_response");
  const n = Number(v);
  if (!Number.isFinite(n)) throw new DataReadFailure("invalid_response");
  return n;
}
function required(v: N): number {
  const n = num(v);
  if (n === null) throw new DataReadFailure("invalid_response");
  return n;
}
function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}
function unique<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const row of rows) {
    if (!row.id || m.has(row.id)) throw new DataReadFailure("invalid_response");
    m.set(row.id, row);
  }
  return m;
}
// Exact category boundaries of public.calcular_categoria (2026-11-02).
function categoria(peso: number | null, sexo: Id) {
  if (peso === null || peso <= 0) return null;
  if (peso <= 220) return "recria1";
  if (peso <= (sexo === "Fêmea" ? 299 : 360)) return "recria2";
  return "engorda";
}
// public.classificar_consumo returns Ideal or Atenção exactly inside [lower, upper].
function naMeta(consumo: number | null, esperado: number | null, maior: number, menor: number) {
  if (consumo === null || esperado === null || esperado === 0) return false;
  return consumo >= esperado * (1 - menor / 100) &&
         consumo <= esperado * (1 + maior / 100);
}

/**
 * Reproduces get_painel_mae without the slow nested view_painel_mae_pasto.
 * Every source must have succeeded (including complete pagination) before aggregation.
 * Security-bearing views enforce JWT/RLS; metadata is joined only from confirmed IDs.
 */
export function aggregatePainelMaeLight(input: MaeLightInput): MaeLightResult {
  const { scope, vctr, reais, pastos, retiros, ocupacoes, produtos, originais = [] } = input;
  const retreatMap = unique(retiros), pastureMap = unique(pastos);
  const ocupMap = unique(ocupacoes), prodMap = unique(produtos);
  const originalMap = unique(originais);
  const realMap = new Map<string, MaeLightReal>();
  const inScope = (row: Scoped) =>
    row.fazenda_id === scope.fazendaId && row.mes_referencia === scope.mes &&
    row.ano_referencia === scope.ano && retreatMap.has(row.retiro_id) &&
    (scope.retiroId === null || row.retiro_id === scope.retiroId);

  for (const r of retiros)
    if (r.fazenda_id !== scope.fazendaId || (scope.retiroId && r.id !== scope.retiroId))
      throw new DataReadFailure("permission");
  if (scope.retiroId && !retreatMap.has(scope.retiroId)) throw new DataReadFailure("permission");
  for (const p of pastos)
    if (!retreatMap.has(p.retiro_id)) throw new DataReadFailure("permission");

  let kgReal = 0, diasReais = 0;
  for (const row of reais) {
    if (!inScope(row) || !row.lancamento_id || realMap.has(row.lancamento_id))
      throw new DataReadFailure("permission");
    realMap.set(row.lancamento_id, row);
    kgReal += num(row.kg_fornecido) ?? 0;
    diasReais += num(row.cab_dias_assumidos) ?? 0;
  }
  const latest = new Map<string, MaeLightSource>(), seen = new Set<string>();
  for (const row of vctr) {
    if (!inScope(row) || seen.has(row.id) || pastureMap.get(row.pasto_id)?.retiro_id !== row.retiro_id)
      throw new DataReadFailure("permission");
    seen.add(row.id);
    // The canonical view only includes currently active pastures in global/target.
    if (!pastureMap.get(row.pasto_id)?.ativo) continue;
    const date = Date.parse(row.created_at);
    if (!Number.isFinite(date)) throw new DataReadFailure("invalid_response");
    const prior = latest.get(row.pasto_id);
    if (!prior || date > Date.parse(prior.created_at)) latest.set(row.pasto_id, row);
    else if (date === Date.parse(prior.created_at))
      throw new DataReadFailure("invalid_response");
  }

  let kgGlobal = 0, diasGlobal = 0, eficienciaPonderada = 0, naMetaCount = 0;
  for (const row of latest.values()) {
    const p = pastureMap.get(row.pasto_id)!;
    const r = retreatMap.get(row.retiro_id)!;
    const real = realMap.get(row.id);
    if (!real || real.pasto_id !== row.pasto_id) throw new DataReadFailure("invalid_response");
    const ocup = real.ocupacao_id ? ocupMap.get(real.ocupacao_id) :
 undefined;
    if (ocup && (ocup.pasto_id !== row.pasto_id || ocup.retiro_id !== row.retiro_id))
      throw new DataReadFailure("permission");
    const prodId = ocup?.produto_id ?? p.produto_id ?? r.produto_id;
    const prod = prodId ? prodMap.get(prodId) : undefined;
    const n = required(row.num_animais), sacos = required(row.num_sacos);
    const dias = num(row.dias_no_pasto);
    if (dias !== null) diasGlobal += n * dias;

    let kg: number | null;
    if (prod?.peso_saco_kg != null) kg = sacos * required(prod.peso_saco_kg);
    else if (r.peso_saco_kg != null) kg = sacos * required(r.peso_saco_kg);
    else {
      const old = originalMap.get(row.id);
      if (!old) throw new DataReadFailure("invalid_response");
      const consumo = num(old.consumo_g_cab_dia);
      kg = consumo === null ? null : consumo * n * Math.max(old.dias_no_pasto || 1, 1) / 1000;
    }
    if (kg !== null) kgGlobal += kg;
    const indice = num(row.indice_consumo);
    if (indice !== null && dias !== null)
      eficienciaPonderada += Math.max(0, 100 - Math.abs(1 - indice) * 100) * n * dias;

    const pesoPasto = num(p.peso_medio_kg);
    const peso = pesoPasto !== null && pesoPasto !== 0 ? pesoPasto : num(row.peso_medio_kg);
    const cat = categoria(peso, p.sexo);
    const consumo = cat === "recria1" ? prod?.consumo_recria1
      : cat === "recria2" ? prod?.consumo_recria2 : prod?.consumo_engorda;
    const maior = cat === "recria1" ? prod?.margem_mais_recria1_pct
      : cat === "recria2" ? prod?.margem_mais_recria2_pct : prod?.margem_mais_engorda_pct;
    const menor = cat === "recria1" ? prod?.margem_menos_recria1_pct
      : cat === "recria2" ? prod?.margem_menos_recria2_pct : prod?.margem_menos_engorda_pct;
    const per100 = num(consumo ?? null);
    const esperado = per100 !== null && per100 > 0 && peso !== null && peso > 0
      ? per100 * peso * 10 : null;
    if (naMeta(num(row.consumo_g_cab_dia), esperado, num(maior ?? null) ?? 0, num(menor ?? null) ?? 0))
      naMetaCount++;
  }

  let animais = 0, pesoPonderado = 0;
  for (const p of pastos) {
    if (!p.ativo) continue;
    const n = num(p.num_animais);
    if (n === null || n <= 0) continue;
    const current = latest.get(p.id);
    const pesoPasto = num(p.peso_medio_kg);
    const peso = pesoPasto !== null && pesoPasto !== 0
      ? pesoPasto : (current ? num(current.peso_medio_kg) : null) ?? pesoPasto ?? 0;
    animais += n;
    pesoPonderado += peso * n;
  }
  return {
    consumo_real_g_cab_dia: diasReais > 0 ? round(kgReal * 1000 / diasReais, 2) : 0,
    consumo_global_g_cab_dia: diasGlobal > 0 ? round(kgGlobal * 1000 / diasGlobal, 2) : 0,
    eficiencia: diasGlobal > 0 ? round(eficienciaPonderada / diasGlobal, 1) : 0,
    pastos_na_meta_num: naMetaCount,
    pastos_na_meta_den: latest.size,
    peso_medio_kg: animais > 0 ? round(pesoPonderado / animais, 1) : 0,
  };
}
