import { supabase } from "@/integrations/supabase/client";
import { fetchScoresCapataz } from "@/lib/scoreCapatazData";

/**
 * Premiação semestral: média simples das notas mensais (fonte única
 * fetchScoresCapataz). Mês sem nenhuma salga na fazenda não conta;
 * mês com salga na fazenda mas não no retiro vale 0.
 */
export interface PremiacaoMes {
  mes: number;
  score: number;
  meta: number;
  salga: number;
  semSalgaRetiro: boolean;
}

export interface PremiacaoRetiro {
  retiroId: string;
  retiro: string;
  capataz: string;
  fazendaId: string;
  fazenda: string;
  media: number;
  mediaMeta: number;
  mediaSalga: number;
  meses: PremiacaoMes[];
}

export interface Semestre { ano: number; sem: 1 | 2 }

export function semestreAtual(d = new Date()): Semestre {
  return { ano: d.getFullYear(), sem: d.getMonth() < 6 ? 1 : 2 };
}

export function mesesDoSemestre(s: Semestre, hoje = new Date()): { meses: number[]; parcial: boolean } {
  const todos = s.sem === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const curY = hoje.getFullYear();
  const curM = hoje.getMonth() + 1;
  if (s.ano > curY) return { meses: [], parcial: true };
  if (s.ano < curY) return { meses: todos, parcial: false };
  const meses = todos.filter((m) => m <= curM);
  return { meses, parcial: meses.length < 6 };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function porFazenda(fazendaId: string, fazendaNome: string, ano: number, meses: number[]): Promise<PremiacaoRetiro[]> {
  const { data: retirosAtivos } = await supabase
    .from("retiros").select("id, nome, capataz").eq("fazenda_id", fazendaId).eq("ativo", true);
  const info: Record<string, { nome: string; capataz: string }> = {};
  for (const r of retirosAtivos ?? []) info[r.id] = { nome: r.nome, capataz: r.capataz ?? "" };

  const mensais = await Promise.all(meses.map(async (mes) => {
    const start = new Date(ano, mes - 1, 1);
    const end = new Date(ano, mes, 0, 23, 59, 59);
    const res = await fetchScoresCapataz({ fazendaId, start, end, periodo: "mensal", mes, ano });
    return { mes, res };
  }));

  const validos = mensais.filter((m) => m.res.list.length > 0);
  for (const m of validos) for (const s of m.res.list) {
    if (!info[s.retiroId]) info[s.retiroId] = { nome: s.retiro, capataz: s.capataz };
  }

  return Object.entries(info).map(([rid, i]) => {
    const ms: PremiacaoMes[] = validos.map(({ mes, res }) => {
      const s = res.byRetiro[rid];
      return s
        ? { mes, score: s.score, meta: s.result.scoreMeta, salga: s.result.scoreSalga, semSalgaRetiro: false }
        : { mes, score: 0, meta: 0, salga: 0, semSalgaRetiro: true };
    });
    return {
      retiroId: rid, retiro: i.nome, capataz: i.capataz, fazendaId, fazenda: fazendaNome,
      media: avg(ms.map((m) => m.score)),
      mediaMeta: avg(ms.map((m) => m.meta)),
      mediaSalga: avg(ms.map((m) => m.salga)),
      meses: ms,
    };
  }).filter((r) => r.meses.length > 0);
}

export async function fetchPremiacaoSemestral(
  fazendas: { id: string; nome: string }[],
  s: Semestre,
): Promise<{ list: PremiacaoRetiro[]; parcial: boolean }> {
  const { meses, parcial } = mesesDoSemestre(s);
  if (meses.length === 0) return { list: [], parcial };
  const parts = await Promise.all(fazendas.map((f) => porFazenda(f.id, f.nome, s.ano, meses)));
  const list = parts.flat().sort((a, b) =>
    b.media - a.media || b.mediaMeta - a.mediaMeta || b.mediaSalga - a.mediaSalga ||
    a.retiro.localeCompare(b.retiro, "pt-BR"));
  return { list, parcial };
}
