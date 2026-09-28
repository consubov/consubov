import { supabase } from "@/integrations/supabase/client";
import { fetchFormulasConfig } from "@/lib/formulasSistema";
import {
  computeAtrasoMedioSalga,
  computeScoreCapataz,
  fetchNotaCochoConsultor,
  fetchScoreWeights,
  type ScoreResult,
} from "@/lib/scoreCapataz";

/**
 * Fonte ÚNICA da nota do Capataz (Score de Eficiência), usada pela aba
 * "Ranking" do Painel do Gerente e pela Seção 2 do PDF do Relatório de Consumo.
 *
 * Histórico: o universo de retiros/pastos é o dos que TIVERAM salga no período
 * (não só os ativos hoje). Intervalo padrão e pesos usam o valor atual.
 */
export interface ScoreRetiro {
  retiroId: string;
  retiro: string;
  capataz: string;
  result: ScoreResult;
  /** Nota final arredondada a 1 casa (mesma exibida no PDF). */
  score: number;
}

export interface FetchScoresOptions {
  fazendaId: string;
  start: Date;
  end: Date;
  periodo: "mensal" | "anual" | "range";
  mes?: number;
  ano?: number;
  retiroId?: string | null;
  /** Restringe a pastos específicos (ex.: filtro de produto do relatório). */
  pastoIds?: string[] | null;
}

const PAGE = 1000;

export async function fetchScoresCapataz(opts: FetchScoresOptions): Promise<{
  byRetiro: Record<string, ScoreRetiro>;
  list: ScoreRetiro[];
  diasIntervalo: number;
  /** Nota de um retiro sem salga no período (mesma regra de antes). */
  semSalga: ScoreResult;
}> {
  const { fazendaId, start, end, periodo, mes, ano, retiroId, pastoIds } = opts;

  const [formulas, weights, fazendaRes, cochoData] = await Promise.all([
    fetchFormulasConfig(),
    fetchScoreWeights(),
    supabase.from("fazendas").select("intervalo_padrao_dias").eq("id", fazendaId).maybeSingle(),
    fetchNotaCochoConsultor(fazendaId, start, end),
  ]);
  const diasIntervalo = Number(fazendaRes.data?.intervalo_padrao_dias ?? 3);

  const lancamentos: Array<{ pasto_id: string; retiro_id: string; created_at: string | null; indice_consumo: number | null; status_consumo: string | null }> = [];
  if (!pastoIds || pastoIds.length > 0) {
    for (let from = 0; ; from += PAGE) {
      let q = (supabase as any)
        .from("view_consumo_tempo_real")
        .select("id, pasto_id, retiro_id, created_at, indice_consumo, status_consumo")
        .eq("fazenda_id", fazendaId)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (periodo === "mensal") q = q.eq("mes_referencia", mes).eq("ano_referencia", ano);
      else if (periodo === "anual") q = q.eq("ano_referencia", ano);
      else q = q.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      if (retiroId) q = q.eq("retiro_id", retiroId);
      if (pastoIds) q = q.in("pasto_id", pastoIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      lancamentos.push(...rows.filter((r) => r.pasto_id && r.retiro_id));
      if (rows.length < PAGE) break;
    }
  }

  const retiroIds = Array.from(new Set(lancamentos.map((l) => l.retiro_id)));

  // Cocho Cheio do período: só as datas, usadas como visita no item Salga.
  // Retiro só com Cocho Cheio (sem salga com produto) continua fora do ranking.
  const cochos: Array<{ pasto_id: string; retiro_id: string; created_at: string | null }> = [];
  if (retiroIds.length > 0) {
    for (let from = 0; ; from += PAGE) {
      let q = (supabase as any)
        .from("lancamentos")
        .select("id, pasto_id, retiro_id, created_at, num_sacos")
        .eq("fazenda_id", fazendaId)
        .eq("cocho_cheio", true)
        .in("retiro_id", retiroIds)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (periodo === "mensal") q = q.eq("mes_referencia", mes).eq("ano_referencia", ano);
      else if (periodo === "anual") q = q.eq("ano_referencia", ano);
      else q = q.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      if (pastoIds) q = q.in("pasto_id", pastoIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      cochos.push(...rows.filter((r) => r.pasto_id && r.retiro_id && Number(r.num_sacos ?? 0) <= 0));
      if (rows.length < PAGE) break;
    }
  }
  const retiroInfo: Record<string, { nome: string; capataz: string }> = {};
  if (retiroIds.length > 0) {
    const { data } = await supabase.from("retiros").select("id, nome, capataz").in("id", retiroIds);
    for (const r of data ?? []) retiroInfo[r.id] = { nome: r.nome, capataz: r.capataz ?? "" };
  }

  const byRetiro: Record<string, ScoreRetiro> = {};
  for (const rid of retiroIds) {
    const rLanc = lancamentos.filter((l) => l.retiro_id === rid);
    const pastoIdsNoPeriodo = Array.from(new Set(rLanc.map((l) => l.pasto_id)));

    let pastosNaMeta = 0;
    for (const pid of pastoIdsNoPeriodo) {
      const last = rLanc
        .filter((l) => l.pasto_id === pid)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];
      const idx = last ? Number(last.indice_consumo ?? 0) : 0;
      const st = idx > 0 ? formulas.classificacao.classify(idx) : (last?.status_consumo ?? null);
      if (st === "Ideal") pastosNaMeta++;
    }

    const atrasoMedioDias = computeAtrasoMedioSalga(
      rLanc.map((l) => ({ pasto_id: l.pasto_id, created_at: l.created_at ?? null })),
      diasIntervalo,
    );

    const result = computeScoreCapataz({
      pastosNaMeta,
      totalPastosComLanc: pastoIdsNoPeriodo.length,
      atrasoMedioDias,
      diasIntervalo,
      notaMediaVisita: cochoData?.nota ?? null,
      notaEscalaMax: 5,
      dataVisita: cochoData?.dataVisita ?? null,
    }, weights);

    byRetiro[rid] = {
      retiroId: rid,
      retiro: retiroInfo[rid]?.nome ?? "—",
      capataz: retiroInfo[rid]?.capataz ?? "",
      result,
      score: Number(result.scoreTotal.toFixed(1)),
    };
  }

  const list = Object.values(byRetiro).sort((a, b) => b.score - a.score || a.retiro.localeCompare(b.retiro, "pt-BR"));
  const semSalga = computeScoreCapataz({
    pastosNaMeta: 0,
    totalPastosComLanc: 0,
    atrasoMedioDias: null,
    diasIntervalo,
    notaMediaVisita: cochoData?.nota ?? null,
    notaEscalaMax: 5,
    dataVisita: cochoData?.dataVisita ?? null,
  }, weights);
  return { byRetiro, list, diasIntervalo, semSalga };
}
