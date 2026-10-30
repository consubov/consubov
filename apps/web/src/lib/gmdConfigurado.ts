import { supabase } from "@/integrations/supabase/client";

/**
 * GMD configurado (projeção) — fonte única: função do banco gmd_do_pasto(pasto, dia),
 * a mesma do motor diário e da Previsão de Abate. Nada é recalculado no app.
 */

function hojeSP(): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date()).split("-").map(Number);
  return { y, m, d };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Hoje para mês/ano em andamento (ou futuro); último dia do período para passados. mes null = ano inteiro. */
export function dataReferenciaGmd(mes: number | null | undefined, ano: number): string {
  const h = hojeSP();
  if (mes == null) return ano >= h.y ? iso(h.y, h.m, h.d) : iso(ano, 12, 31);
  if (ano > h.y || (ano === h.y && mes >= h.m)) return iso(h.y, h.m, h.d);
  return iso(ano, mes, new Date(ano, mes, 0).getDate());
}

/** GMD de cada pasto no dia (null = sem GMD definido). */
export async function fetchGmdPastos(pastoIds: string[], dia: string): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const ids = Array.from(new Set(pastoIds));
  for (let i = 0; i < ids.length; i += 25) {
    const lote = ids.slice(i, i + 25);
    const res = await Promise.all(lote.map((id) =>
      (supabase as any).rpc("gmd_do_pasto", { p_pasto: id, p_dia: dia })));
    lote.forEach((id, k) => {
      const v = res[k]?.data;
      out[id] = v == null || isNaN(Number(v)) ? null : Number(v);
    });
  }
  return out;
}

/** Média ponderada por animais dos pastos com animais e GMD definido; null se nenhum. */
export function gmdPonderado(
  pastos: { id: string; num_animais: number | null }[],
  gmd: Record<string, number | null>,
): number | null {
  let soma = 0, anim = 0;
  for (const p of pastos) {
    const n = Number(p.num_animais) || 0;
    const g = gmd[p.id];
    if (n <= 0 || g == null) continue;
    soma += n * g; anim += n;
  }
  return anim > 0 ? soma / anim : null;
}
