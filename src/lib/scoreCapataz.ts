import { supabase } from "@/integrations/supabase/client";
import { diasCalendarioSP } from "@/lib/diasCalendario";

/**
 * Score do Capataz — lê pesos das 4 fórmulas em `formulas_sistema`
 * (score_meta, score_salga, score_cocho, score_total) e aplica os
 * cálculos canônicos:
 *
 *   score_meta  = peso_meta  * (pastos_na_meta / total_pastos_com_lancamento)
 *   score_salga = peso_salga * (1 - LEAST(1, atraso_medio_dias / dias_intervalo))
 *   score_cocho = peso_cocho * (nota_media_visita / 5)
 *   score_total = soma dos disponíveis (bounded pela escala_maxima)
 */

export interface ScoreWeights {
  pesoMeta: number;      // default 5
  pesoSalga: number;     // default 3
  pesoCocho: number;     // default 2
  escalaMaxima: number;  // default 10
  source: "db" | "fallback";
}

const FALLBACK_WEIGHTS: ScoreWeights = {
  pesoMeta: 5, pesoSalga: 3, pesoCocho: 2, escalaMaxima: 10, source: "fallback",
};

export async function fetchScoreWeights(): Promise<ScoreWeights> {
  try {
    const { data, error } = await supabase
      .from("formulas_sistema")
      .select("chave, parametros, ativo")
      .in("chave", ["score_meta", "score_salga", "score_cocho", "score_total"])
      .eq("ativo", true);
    if (error || !data || data.length === 0) return FALLBACK_WEIGHTS;
    const byKey = new Map<string, any>();
    for (const row of data as any[]) byKey.set(row.chave, row.parametros ?? {});
    const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
    return {
      pesoMeta: num(byKey.get("score_meta")?.peso_maximo, 5),
      pesoSalga: num(byKey.get("score_salga")?.peso_maximo, 3),
      pesoCocho: num(byKey.get("score_cocho")?.peso_maximo, 2),
      escalaMaxima: num(byKey.get("score_total")?.escala_maxima, 10),
      source: "db",
    };
  } catch {
    return FALLBACK_WEIGHTS;
  }
}

export interface ScoreInputs {
  pastosNaMeta: number;
  totalPastosComLanc: number;
  atrasoMedioDias: number | null; // null se não houver 2+ lançamentos
  diasIntervalo: number;
  notaMediaVisita: number | null; // 0..5, ou null se sem visita no período
  notaEscalaMax: number;          // tipicamente 5
  dataVisita: string | null;      // ISO
}

export interface ScoreResult {
  scoreMeta: number;
  scoreSalga: number;
  scoreCocho: number | null;
  scoreTotal: number;
  pesoMeta: number;
  pesoSalga: number;
  pesoCocho: number;
  // detalhes para exibir no PDF
  detalheMeta: string;
  detalheSalga: string;
  detalheCocho: string;
  dataVisita: string | null;
}

export function computeScoreCapataz(inputs: ScoreInputs, w: ScoreWeights): ScoreResult {
  const scoreMeta = inputs.totalPastosComLanc > 0
    ? w.pesoMeta * (inputs.pastosNaMeta / inputs.totalPastosComLanc)
    : 0;

  let scoreSalga = 0;
  if (inputs.atrasoMedioDias != null && inputs.diasIntervalo > 0) {
    const ratio = Math.min(1, Math.max(0, inputs.atrasoMedioDias / inputs.diasIntervalo));
    scoreSalga = w.pesoSalga * (1 - ratio);
  } else if (inputs.atrasoMedioDias != null) {
    scoreSalga = w.pesoSalga;
  }

  const scoreCocho = inputs.notaMediaVisita != null && inputs.notaEscalaMax > 0
    ? w.pesoCocho * (inputs.notaMediaVisita / inputs.notaEscalaMax)
    : null;

  const scoreTotal = Math.min(
    w.escalaMaxima,
    scoreMeta + scoreSalga + (scoreCocho ?? 0),
  );

  const detalheMeta = inputs.totalPastosComLanc > 0
    ? `${inputs.pastosNaMeta} de ${inputs.totalPastosComLanc} pastos na faixa ideal`
    : "sem lançamentos no período";

  const detalheSalga = inputs.atrasoMedioDias != null
    ? `atraso médio de ${inputs.atrasoMedioDias.toFixed(1).replace(".", ",")} dias (intervalo configurado: ${inputs.diasIntervalo} dias)`
    : "sem dados suficientes de salga";

  const detalheCocho = inputs.notaMediaVisita != null && inputs.dataVisita
    ? `nota da visita técnica de ${new Date(inputs.dataVisita).toLocaleDateString("pt-BR")}`
    : "sem visita técnica no período";

  return {
    scoreMeta, scoreSalga, scoreCocho, scoreTotal,
    pesoMeta: w.pesoMeta, pesoSalga: w.pesoSalga, pesoCocho: w.pesoCocho,
    detalheMeta, detalheSalga, detalheCocho,
    dataVisita: inputs.dataVisita,
  };
}

/**
 * Calcula o atraso médio de salga (dias) para um retiro, comparando o
 * intervalo real entre lançamentos consecutivos de cada pasto com o
 * `dias_intervalo` configurado da fazenda.
 *
 * atraso_por_pasto = max(0, avg(intervalo_real) - dias_intervalo)
 * atraso_medio_retiro = média dos atrasos dos pastos com >=2 lançamentos.
 * Retorna null se nenhum pasto tiver dados suficientes.
 */
export function computeAtrasoMedioSalga(
  lancamentos: Array<{ pasto_id: string; created_at: string | null }>,
  diasIntervalo: number,
): number | null {
  const porPasto = new Map<string, number[]>();
  for (const l of lancamentos) {
    if (!l.created_at) continue;
    const arr = porPasto.get(l.pasto_id) ?? [];
    arr.push(new Date(l.created_at).getTime());
    porPasto.set(l.pasto_id, arr);
  }
  const atrasos: number[] = [];
  for (const times of porPasto.values()) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push(diasCalendarioSP(times[i - 1], times[i]) ?? 0);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    atrasos.push(Math.max(0, avgGap - diasIntervalo));
  }
  if (atrasos.length === 0) return null;
  return atrasos.reduce((a, b) => a + b, 0) / atrasos.length;
}

/**
 * Busca a nota média mais recente de avaliação da visita técnica
 * do consultor para uma fazenda dentro do período [start, end].
 * Retorna {nota, dataVisita} da visita mais recente (finalizada ou revisão)
 * cujas avaliacoes_score existem. Se não houver, retorna null.
 */
export async function fetchNotaCochoConsultor(
  fazendaNome: string,
  start: Date,
  end: Date,
): Promise<{ nota: number; dataVisita: string } | null> {
  try {
    // Fazendas do consultor com nome bater (case-insensitive)
    const { data: fc } = await supabase
      .from("fazendas_consultor")
      .select("id")
      .ilike("nome_fazenda", fazendaNome)
      .is("deleted_at", null);
    if (!fc || fc.length === 0) return null;
    const fcIds = fc.map((r: any) => r.id);

    // Visitas técnicas no período
    const { data: visitas } = await supabase
      .from("visitas_tecnicas")
      .select("id, hora_inicio, created_at")
      .in("fazenda_consultor_id", fcIds)
      .gte("hora_inicio", start.toISOString())
      .lte("hora_inicio", end.toISOString())
      .order("hora_inicio", { ascending: false });
    if (!visitas || visitas.length === 0) return null;

    for (const v of visitas as any[]) {
      // pega notas de todas avaliacoes_score dessa visita (via visita_pastos ou visita_currais)
      const { data: vps } = await supabase
        .from("visita_pastos")
        .select("id")
        .eq("visita_id", v.id);
      const { data: vcs } = await supabase
        .from("visita_currais")
        .select("id")
        .eq("visita_id", v.id);
      const vpIds = (vps ?? []).map((r: any) => r.id);
      const vcIds = (vcs ?? []).map((r: any) => r.id);
      if (vpIds.length === 0 && vcIds.length === 0) continue;

      let notas: number[] = [];
      if (vpIds.length > 0) {
        const { data } = await supabase
          .from("avaliacoes_score")
          .select("nota")
          .in("visita_pasto_id", vpIds);
        notas = notas.concat((data ?? []).map((r: any) => Number(r.nota)));
      }
      if (vcIds.length > 0) {
        const { data } = await supabase
          .from("avaliacoes_score")
          .select("nota")
          .in("visita_curral_id", vcIds);
        notas = notas.concat((data ?? []).map((r: any) => Number(r.nota)));
      }
      notas = notas.filter((n) => Number.isFinite(n) && n > 0);
      if (notas.length === 0) continue;
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      return { nota: media, dataVisita: v.hora_inicio ?? v.created_at };
    }
    return null;
  } catch {
    return null;
  }
}
