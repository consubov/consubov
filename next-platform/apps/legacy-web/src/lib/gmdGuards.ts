import { CATEGORIAS_PASTO } from "@/lib/categoriaPasto";

export type GmdModo = "geral" | "categoria" | "retiro";
export interface GmdRow {
  id: string;
  fazenda_id: string;
  retiro_id: string | null;
  categoria: string | null;
  gmd_kg: number | null;
  gmd_verao_kg: number | null;
  gmd_inverno_kg: number | null;
}
export interface GmdReadback {
  modo: GmdModo;
  verao: { ini: number | null; fim: number | null };
  values: Map<string, number | null>;
}
const key = (retiroId: string | null, categoria: string | null) => JSON.stringify([retiroId, categoria]);

export function parseGmd(s: string): number | null | "invalid" {
  if (typeof s !== "string") return "invalid";
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < -1 || n > 3) return "invalid";
  return Math.round(n * 1000) / 1000;
}

/** A mutation that affected zero or an unexpected row is not success, even without a PostgREST error. */
export function assertMutation(
  result: { data: unknown; error: unknown },
  operation: string,
  expectedCount: number,
  expectedIds?: readonly string[],
): void {
  if (result.error) throw new Error(`${operation}: operação recusada pelo banco.`);
  const rows = result.data;
  if (!Array.isArray(rows) || rows.length !== expectedCount ||
      rows.some((row) => !row || typeof row.id !== "string" || !row.id)) {
    throw new Error(`${operation}: quantidade de registros não confirmada.`);
  }
  if (expectedIds && (expectedIds.length !== expectedCount ||
    new Set(rows.map((row) => row.id)).size !== expectedCount ||
    expectedIds.some((id) => !rows.some((row) => row.id === id)))) {
    throw new Error(`${operation}: identificação dos registros não confirmada.`);
  }
}

/** Reject inconsistent/partial tenant reads instead of treating them as empty configuration. */
export function validateLoadedGmd(
  rows: GmdRow[],
  farmId: string,
  activeRetreats: readonly string[],
): void {
  if (!Array.isArray(rows)) throw new Error("Resposta GMD incompleta.");
  const active = new Set(activeRetreats);
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || row.fazenda_id !== farmId) {
      throw new Error("GMD retornou dados de outra fazenda.");
    }
    if (row.retiro_id && (!active.has(row.retiro_id) || !row.categoria)) {
      throw new Error("GMD contém regra de retiro não disponível.");
    }
    if (row.categoria && !(CATEGORIAS_PASTO as readonly string[]).includes(row.categoria)) {
      throw new Error("GMD contém categoria desconhecida.");
    }
    const scope = key(row.retiro_id ?? null, row.categoria ?? null);
    if (seen.has(scope)) throw new Error("GMD contém regras duplicadas.");
    seen.add(scope);
  }
}

/** Snapshot of what a save intended to persist. Used for read-after-write verification. */
export function expectedGmd(
  mode: GmdModo,
  summer: { ini: number | null; fim: number | null },
  geral: { verao: string; inverno: string },
  categories: Record<string, Record<string, string>>,
  retreatIds: readonly string[],
): GmdReadback {
  const validMonth = (m: number | null) => m === null || (Number.isInteger(m) && m >= 1 && m <= 12);
  if (!validMonth(summer.ini) || !validMonth(summer.fim) ||
      (mode === "geral" && ((summer.ini === null) !== (summer.fim === null)))) {
    throw new Error("Período de verão inválido.");
  }
  const values = new Map<string, number | null>();
  if (mode === "geral") {
    const hot = parseGmd(geral.verao);
    const cold = parseGmd(geral.inverno);
    if (hot === "invalid" || cold === "invalid") throw new Error("Valor GMD inválido.");
    if (hot !== null || cold !== null) {
      values.set(key(null, null) + "/summer", hot);
      values.set(key(null, null) + "/winter", cold);
    }
  } else {
    const ids = mode === "categoria" ? ["faz"] : retreatIds;
    for (const id of ids) {
      const form = categories[id];
      if (!form || CATEGORIAS_PASTO.some((cat) => typeof form[cat] !== "string")) {
        throw new Error("Formulário de GMD incompleto.");
      }
      for (const cat of CATEGORIAS_PASTO) {
        const val = parseGmd(form[cat]);
        if (val === "invalid") throw new Error("Valor GMD inválido.");
        if (val !== null) values.set(key(mode === "categoria" ? null : id, cat), val);
      }
    }
  }
  return { modo: mode, verao: summer, values };
}

export function verifyGmdReadback(
  farm: { id: string; gmd_modo: string | null; verao_mes_inicio: number | null; verao_mes_fim: number | null },
  rows: GmdRow[],
  expected: GmdReadback,
): boolean {
  if (!farm || !farm.id || farm.gmd_modo !== expected.modo) return false;
  if (expected.modo === "geral" &&
      (farm.verao_mes_inicio !== expected.verao.ini || farm.verao_mes_fim !== expected.verao.fim)) return false;
  const actual = new Map<string, number | null>();
  for (const row of rows) {
    const scope = key(row.retiro_id ?? null, row.categoria ?? null);
    if (expected.modo === "geral") {
      if (row.retiro_id || row.categoria) return false;
      if (actual.has(scope + "/summer")) return false;
      actual.set(scope + "/summer", row.gmd_verao_kg);
      actual.set(scope + "/winter", row.gmd_inverno_kg);
    } else {
      if (!row.categoria || (expected.modo === "categoria" && row.retiro_id) ||
          (expected.modo === "retiro" && !row.retiro_id) || actual.has(scope)) return false;
      actual.set(scope, row.gmd_kg);
    }
  }
  if (actual.size !== expected.values.size) return false;
  for (const [k, v] of expected.values) {
    if (!actual.has(k)) return false;
    const stored = actual.get(k);
    if ((v === null) !== (stored === null)) return false;
    if (v !== null && (stored === null || !Number.isFinite(Number(stored)) ||
        Math.abs(Number(stored) - v) > 0.0005)) return false;
  }
  return true;
}
