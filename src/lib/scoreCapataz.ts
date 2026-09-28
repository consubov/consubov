import { supabase } from "@/integrations/supabase/client";
import { dataLocalSP, diasCalendarioSP } from "@/lib/diasCalendario";

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
  /** Média de (atraso do pasto ÷ intervalo do pasto). Se informado, substitui atraso÷diasIntervalo. */
  razaoAtraso?: number | null;
  /** Faixa de intervalos dos pastos considerados (texto do PDF). */
  intervaloMin?: number;
  intervaloMax?: number;
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
  if (inputs.atrasoMedioDias != null && inputs.razaoAtraso != null) {
    const ratio = Math.min(1, Math.max(0, inputs.razaoAtraso));
    scoreSalga = w.pesoSalga * (1 - ratio);
  } else if (inputs.atrasoMedioDias != null && inputs.diasIntervalo > 0) {
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

  const iMin = inputs.intervaloMin ?? inputs.diasIntervalo;
  const iMax = inputs.intervaloMax ?? inputs.diasIntervalo;
  const textoIntervalo = iMin === iMax ? `intervalo configurado: ${iMin} dias` : `intervalos de ${iMin} a ${iMax} dias`;
  const detalheSalga = inputs.atrasoMedioDias != null
    ? `atraso médio de ${inputs.atrasoMedioDias.toFixed(1).replace(".", ",")} dias (${textoIntervalo})`
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
  return computeAtrasoSalgaPorPasto(lancamentos, () => diasIntervalo).atrasoMedio;
}

/**
 * Igual a computeAtrasoMedioSalga, mas cada pasto é medido contra o próprio
 * intervalo (pasto → retiro → fazenda). Retorna também a média de
 * (atraso ÷ intervalo) e a faixa de intervalos dos pastos considerados.
 */
export function computeAtrasoSalgaPorPasto(
  lancamentos: Array<{ pasto_id: string; created_at: string | null }>,
  intervaloDoPasto: (pastoId: string) => number,
): { atrasoMedio: number | null; razaoMedia: number | null; intervaloMin: number | null; intervaloMax: number | null } {
  // Visitas = salgas com produto + Cocho Cheio. Várias visitas do mesmo
  // pasto no mesmo dia (calendário America/Sao_Paulo) contam como uma só.
  const porPasto = new Map<string, Map<string, number>>();
  for (const l of lancamentos) {
    if (!l.created_at) continue;
    const t = new Date(l.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const dia = dataLocalSP(t);
    const m = porPasto.get(l.pasto_id) ?? new Map<string, number>();
    if (!m.has(dia)) m.set(dia, t);
    porPasto.set(l.pasto_id, m);
  }
  const atrasos: number[] = [];
  const razoes: number[] = [];
  const ints: number[] = [];
  for (const [pastoId, dias] of porPasto.entries()) {
    const times = Array.from(dias.values());
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push(diasCalendarioSP(times[i - 1], times[i]) ?? 0);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const intv = intervaloDoPasto(pastoId);
    const atraso = Math.max(0, avgGap - intv);
    atrasos.push(atraso);
    razoes.push(intv > 0 ? atraso / intv : 0);
    ints.push(intv);
  }
  if (atrasos.length === 0) return { atrasoMedio: null, razaoMedia: null, intervaloMin: null, intervaloMax: null };
  const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return { atrasoMedio: media(atrasos), razaoMedia: media(razoes), intervaloMin: Math.min(...ints), intervaloMax: Math.max(...ints) };
}

/**
 * Busca a nota média mais recente de avaliação da visita técnica
 * do consultor para uma fazenda dentro do período [start, end].
 * Retorna {nota, dataVisita} da visita mais recente (finalizada ou revisão)
 * cujas avaliacoes_score existem. Se não houver, retorna null.
 */
export async function fetchNotaCochoConsultor(
  fazendaId: string,
  start: Date,
  end: Date,
): Promise<{ nota: number; dataVisita: string } | null> {
  try {
    // Ligação pela fazenda (ID), nunca pelo nome.
    const { data: visitas } = await supabase
      .from("visitas_tecnicas")
      .select("id, hora_inicio, created_at")
      .eq("fazenda_id", fazendaId)
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
