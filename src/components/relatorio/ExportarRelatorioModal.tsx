import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcConsumoGCabDia, calcConsumoEsperadoGCabDia, classificarCategoria, getConsumoPorCategoria, getMargemPorCategoria } from "@/lib/consumoCalc";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { fetchFormulasConfig } from "@/lib/formulasSistema";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import {
  fetchScoreWeights,
  computeScoreCapataz,
  computeAtrasoMedioSalga,
  fetchNotaCochoConsultor,
} from "@/lib/scoreCapataz";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import RelatorioPDF, { type RelatorioPDFData, type RetiroReportData, type PastoReportData, type CatMetricsPDF } from "./RelatorioPDF";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type PeriodoTipo = "mensal" | "ultimos15" | "anual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fazendaId: string;
  fazendaNome: string;
  geradoPor: string;
  initialMes?: number;
  initialAno?: number;
  lockedRetiroId?: string | null;
}

export default function ExportarRelatorioModal({
  open,
  onOpenChange,
  fazendaId,
  fazendaNome,
  geradoPor,
  initialMes,
  initialAno,
  lockedRetiroId,
}: Props) {
  const now = new Date();
  const monthlyContextEnabled = initialMes != null && initialAno != null;
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState(initialMes ?? now.getMonth() + 1);
  const [ano, setAno] = useState(initialAno ?? now.getFullYear());
  const [retiroFiltro, setRetiroFiltro] = useState(lockedRetiroId ?? "todos");
  const [retirosList, setRetirosList] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fazendaId) return;
    supabase.from("retiros").select("id, nome").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome")
      .then(({ data }) => setRetirosList(data ?? []));
  }, [open, fazendaId]);

  useEffect(() => {
    if (!open) return;
    const currentDate = new Date();
    setPeriodoTipo("mensal");
    setMes(initialMes ?? currentDate.getMonth() + 1);
    setAno(initialAno ?? currentDate.getFullYear());
    setRetiroFiltro(lockedRetiroId ?? "todos");
  }, [open, initialMes, initialAno, lockedRetiroId]);

  async function handleExportar() {
    setLoading(true);
    try {
      const formulas = await fetchFormulasConfig();
      const periodoSelecionado: PeriodoTipo = monthlyContextEnabled ? "mensal" : periodoTipo;
      const retiroSelecionado = lockedRetiroId ?? (retiroFiltro !== "todos" ? retiroFiltro : null);
      const { start, end, label } = getDateRange(periodoSelecionado);

      const scoreWeights = await fetchScoreWeights();
      const { data: fazendaRow } = await supabase
        .from("fazendas")
        .select("intervalo_padrao_dias")
        .eq("id", fazendaId)
        .maybeSingle();
      const diasIntervalo = Number(fazendaRow?.intervalo_padrao_dias ?? 3);

      // Nota de cocho da visita técnica do Consultor (mês/ano ou range selecionado)
      const cochoData = await fetchNotaCochoConsultor(fazendaNome, start, end);

      let retQuery = supabase.from("retiros")
        .select("id, nome, capataz, produto_id, ultima_salga_em")
        .eq("fazenda_id", fazendaId).eq("ativo", true);
      if (retiroSelecionado) {
        retQuery = retQuery.eq("id", retiroSelecionado);
      }
      const { data: retirosData } = await retQuery;
      if (!retirosData || retirosData.length === 0) {
        toast.error("Nenhum retiro encontrado.");
        setLoading(false);
        return;
      }

      const retiroIds = retirosData.map(r => r.id);

      // Buscar ciclos dos retiros para calcular dias considerados corretamente.
      const { data: ciclosData } = await supabase.from("ciclos")
        .select("id, retiro_id, mes, ano, fechado, data_inicio, duracao_dias")
        .in("retiro_id", retiroIds);
      const ciclosById: Record<string, { id: string; retiro_id: string; mes: number; ano: number; fechado: boolean; data_inicio: string | null; duracao_dias: number | null }> = {};
      for (const c of (ciclosData ?? [])) ciclosById[c.id] = c;

      // Fonte única de verdade dos agregados do retiro: RPC get_painel_mae.
      // Só é aplicável ao período mensal (a RPC recebe mês/ano).
      const painelMaeByRetiro: Record<string, { eficiencia: number; peso_medio_kg: number; consumo_real_g_cab_dia: number }> = {};
      if (periodoSelecionado === "mensal") {
        await Promise.all(retiroIds.map(async (rid) => {
          const { data: rows } = await (supabase as any).rpc("get_painel_mae", {
            p_fazenda_id: fazendaId,
            p_retiro_id: rid,
            p_mes: mes,
            p_ano: ano,
          });
          const row = Array.isArray(rows) ? rows[0] : rows;
          if (row) {
            painelMaeByRetiro[rid] = {
              eficiencia: Number(row.eficiencia) || 0,
              peso_medio_kg: Number(row.peso_medio_kg) || 0,
              consumo_real_g_cab_dia: Number(row.consumo_real_g_cab_dia) || 0,
            };
          }
        }));
      }

      // Métricas por pasto (consumo real x global) — view_painel_mae_pasto
      const painelPastoByPastoId: Record<string, any> = {};
      if (periodoSelecionado === "mensal" && retiroIds.length > 0) {
        const { data: vpRows } = await (supabase as any)
          .from("view_painel_mae_pasto")
          .select("pasto_id, retiro_id, peso_medio_kg, consumo_real_g_cab_dia, indice_real, status_real")
          .in("retiro_id", retiroIds)
          .eq("mes_referencia", mes)
          .eq("ano_referencia", ano);
        for (const row of (vpRows ?? [])) painelPastoByPastoId[row.pasto_id] = row;
      }




      const { data: pastosData } = await supabase.from("pastos")
        .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id, categoria, sexo")
        .in("retiro_id", retiroIds).eq("ativo", true);
      const pastos = pastosData ?? [];
      const pastoIds = pastos.map(p => p.id);

      // Produto em uso por pasto: ocupação ativa (fallback pasto/retiro adiante)
      const ocupacaoProdutoByPasto: Record<string, string> = {};
      if (pastoIds.length > 0) {
        const { data: ocupData } = await supabase.from("ocupacoes_pasto")
          .select("pasto_id, produto_id, data_entrada, data_saida")
          .in("pasto_id", pastoIds)
          .is("data_saida", null)
          .order("data_entrada", { ascending: false });
        for (const o of (ocupData ?? [])) {
          if (o.produto_id && !ocupacaoProdutoByPasto[o.pasto_id]) {
            ocupacaoProdutoByPasto[o.pasto_id] = o.produto_id;
          }
        }
      }


      let lancamentos: any[] = [];
      if (pastoIds.length > 0) {
        let lQuery = supabase.from("view_consumo_tempo_real" as any)
          .select("id, pasto_id, num_sacos, num_animais, peso_medio_kg, dias_no_pasto, categoria, sexo, created_at, mes_referencia, ano_referencia, fazenda_id, retiro_id, status_consumo, indice_consumo, consumo_g_cab_dia, ciclo_id, origem")
          .in("pasto_id", pastoIds);

        if (periodoSelecionado === "mensal") {
          lQuery = lQuery.eq("mes_referencia", mes).eq("ano_referencia", ano);
        } else if (periodoSelecionado === "anual") {
          lQuery = lQuery.eq("ano_referencia", ano);
        } else {
          const startIso = start.toISOString();
          const endIso = end.toISOString();
          lQuery = lQuery.gte("created_at", startIso).lte("created_at", endIso);
        }

        const { data: lancData, error: lancError } = await lQuery;
        if (lancError) {
          console.error("Erro ao buscar lançamentos para PDF:", lancError);
          toast.error("Erro ao buscar dados de lançamentos.");
          setLoading(false);
          return;
        }
        lancamentos = lancData ?? [];
      }

      // Consumo/índice/dias já vêm ajustados dinamicamente pela view
      // `view_consumo_tempo_real` — fonte única de verdade no banco.


      const produtoIds = [...new Set([
        ...retirosData.map(r => r.produto_id).filter(Boolean),
        ...pastos.map(p => p.produto_id).filter(Boolean),
        ...Object.values(ocupacaoProdutoByPasto),

      ])] as string[];
      const produtosMap: Record<string, { nome: string; peso_saco_kg: number; preco_por_kg: number; consumo_recria1: number; consumo_recria2: number; consumo_engorda: number; margem_recria1: number; margem_recria2: number; margem_engorda: number }> = {};
      if (produtoIds.length > 0) {
        const { data: prodData } = await supabase.from("produtos")
          .select("id, nome, peso_saco_kg, preco_por_kg, consumo_recria1, consumo_recria2, consumo_engorda, margem_recria1, margem_recria2, margem_engorda")
          .in("id", produtoIds);
        for (const p of (prodData ?? [])) {
          produtosMap[p.id] = {
            nome: p.nome,
            peso_saco_kg: Number(p.peso_saco_kg),
            preco_por_kg: Number(p.preco_por_kg ?? 0),
            consumo_recria1: Number(p.consumo_recria1 ?? 0),
            consumo_recria2: Number(p.consumo_recria2 ?? 0),
            consumo_engorda: Number(p.consumo_engorda ?? 0),
            margem_recria1: Number(p.margem_recria1 ?? 0),
            margem_recria2: Number(p.margem_recria2 ?? 0),
            margem_engorda: Number(p.margem_engorda ?? 0),
          };
        }
      }

      // Consumo real por pasto usando intervalo_padrao_dias como cobertura (somente mensal)
      const consumoRealV2ByPasto: Record<string, number> = {};
      if (periodoSelecionado === "mensal" && pastoIds.length > 0) {
        await Promise.all(
          pastos.map(async (p) => {
            const { data: rows } = await (supabase as any).rpc("get_consumo_real_v2", {
              p_retiro_id: p.retiro_id,
              p_pasto_id: p.id,
              p_mes: mes,
              p_ano: ano,
            });
            const row = Array.isArray(rows) ? rows[0] : rows;
            if (row) {
              consumoRealV2ByPasto[p.id] = Number(row.consumo_real_g_cab_dia ?? 0);
            }
          }),
        );
      }

      const numDias = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

      const retiroReportData: RetiroReportData[] = retirosData.map(ret => {
        const rPastos = pastos.filter(p => p.retiro_id === ret.id);
        const rPastoIds = new Set(rPastos.map(p => p.id));
        // Filtro por retiro_id da view (mesma regra do Painel do Retiro), para
        // garantir que ambos operem sobre o mesmo conjunto de lançamentos.
        const rLanc = lancamentos.filter(l => l.retiro_id === ret.id && rPastoIds.has(l.pasto_id));
        const pastosNoPeriodo = rPastos.filter(p => rLanc.some(l => l.pasto_id === p.id));
        // Total Animais = rebanho REAL do retiro (fonte única = pastos.num_animais
        // ativos), mesma contagem que aparece no mapa do Capataz. Não filtra por
        // mês nem deriva de lançamentos de consumo.
        const totalAnimais = rPastos.reduce((sum, p) => sum + (Number(p.num_animais) || 0), 0);
        const sacosUtilizados = rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);

        const prod = ret.produto_id ? produtosMap[ret.produto_id] : null;
        const pesoSacoKg = prod?.peso_saco_kg ?? 25;
        const precoKg = prod?.preco_por_kg ?? 0;
        // Animais considerados no custo: apenas pastos com lançamento no período
        // (mesmo universo do numerador de sacos).
        const animaisNoPeriodo = pastosNoPeriodo.reduce((sum, p) => sum + (Number(p.num_animais) || 0), 0);

        // Consumo Médio (Consumo Real): fonte única = RPC get_painel_mae
        // (ponderado por cab-dias). Fallback local só fora do período mensal.
        const consumoMedio = painelMaeByRetiro[ret.id]
          ? painelMaeByRetiro[ret.id].consumo_real_g_cab_dia
          : computeConsumoMedioPonderado(rLanc);

        const gVals = pastosNoPeriodo.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
        const gmd = gVals.length > 0 ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;

        // Custo por pasto: usa o produto do próprio pasto quando existir,
        // caindo para o produto do retiro.
        const custoTotal = pastosNoPeriodo.reduce((sum, p) => {
          const pProd = produtosMap[(p as any).produto_id || (ret.produto_id ?? "")] ?? prod;
          const pPeso = pProd?.peso_saco_kg ?? pesoSacoKg;
          const pPreco = pProd?.preco_por_kg ?? precoKg;
          const pSacos = rLanc.filter(l => l.pasto_id === p.id).reduce((a, l) => a + (l.num_sacos || 0), 0);
          return sum + pSacos * pPeso * pPreco;
        }, 0);
        const custoDiario = consumoMedio > 0 && precoKg > 0 ? (consumoMedio / 1000) * precoKg : 0;

        // Pastos na Meta (mesma regra do card do painel): pastos com lançamento
        // no mês cujo último indice_consumo cai na faixa "Ideal" da fórmula.
        let pastosNaMeta = 0;
        for (const p of pastosNoPeriodo) {
          const pLanc = rLanc.filter(l => l.pasto_id === p.id);
          const sorted = [...pLanc].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
          const last = sorted[0];
          const idx = last ? Number(last.indice_consumo ?? 0) : 0;
          const st = idx > 0 ? formulas.classificacao.classify(idx) : (last?.status_consumo ?? null);
          if (st === "Ideal") pastosNaMeta++;
        }

        const atrasoMedioDias = computeAtrasoMedioSalga(
          rLanc.map(l => ({ pasto_id: l.pasto_id as string, created_at: l.created_at ?? null })),
          diasIntervalo,
        );

        const scoreCalc = computeScoreCapataz({
          pastosNaMeta,
          totalPastosComLanc: pastosNoPeriodo.length,
          atrasoMedioDias,
          diasIntervalo,
          notaMediaVisita: cochoData?.nota ?? null,
          notaEscalaMax: 5,
          dataVisita: cochoData?.dataVisita ?? null,
        }, scoreWeights);

        const pastoReport: PastoReportData[] = pastosNoPeriodo.map(p => {
          const pLanc = rLanc.filter(l => l.pasto_id === p.id);
          const pSacos = pLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);

          // Consumo por pasto: mesma fórmula canônica (weighted por num_animais).
          const pConsumo = computeConsumoMedioPonderado(pLanc);

          // Reclassifica pelo indice_consumo do último lançamento usando formulas_sistema
          const sortedPLanc = [...pLanc].sort((a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
          );
          const lastP = sortedPLanc[0];
          const idx = lastP ? Number(lastP.indice_consumo ?? 0) : 0;
          const pStatus = idx > 0
            ? formulas.classificacao.classify(idx)
            : (lastP?.status_consumo ?? "—");

          const pesoMedio = Number(p.peso_medio_kg ?? 0);
          const cat = (p as any).categoria || classificarCategoria(pesoMedio);
          const lastCiclo = lastP?.ciclo_id ? ciclosById[lastP.ciclo_id] : null;
          let diasConsiderados = 0;
          if (lastCiclo) {
            if (lastCiclo.fechado) {
              diasConsiderados = Number(lastCiclo.duracao_dias ?? 0);
            } else {
              const dataInicio = lastCiclo.data_inicio ?? new Date(lastCiclo.ano, lastCiclo.mes - 1, 1).toISOString();
              diasConsiderados = Math.max(0, diasCalendarioSP(dataInicio) ?? 0);
            }
          }

          // Produto usado no pasto: ocupação ativa → produto do pasto → produto do retiro
          const pProdId = ocupacaoProdutoByPasto[p.id] || (p as any).produto_id || ret.produto_id || "";
          const pProd = produtosMap[pProdId] ?? prod;
          const consumoPor100kg = pProd ? getConsumoPorCategoria(cat, pProd) : 0;
          const pesoSacoPasto = pProd?.peso_saco_kg ?? pesoSacoKg;

          const vp = painelPastoByPastoId[p.id];

          // Consumo real: RPC mensal (get_consumo_real_v2) usa intervalo_padrao_dias;
          // fallback para não-mensal mantém o comportamento anterior.
          const consumoRealV2 = periodoSelecionado === "mensal" ? consumoRealV2ByPasto[p.id] : undefined;
          const consumoReal = consumoRealV2 !== undefined ? consumoRealV2 : pConsumo;

          // Status recalculado a partir do consumo real e do produto usado (mensal)
          // Usa peso médio histórico da view (quando disponível) para não zerar
          // o esperado/margem em pastos transferidos com 0 animais no momento.
          let statusReal: string;
          if (consumoRealV2 !== undefined) {
            const pesoMedioStatus = Number(vp?.peso_medio_kg ?? pesoMedio);
            const consumoEsperado = calcConsumoEsperadoGCabDia(consumoPor100kg, pesoMedioStatus);
            const margemPor100kg = pProd ? getMargemPorCategoria(cat, pProd) : 0;
            const margemGCabDia = margemPor100kg * pesoMedioStatus * 10;
            if (consumoEsperado <= 0) {
              statusReal = "—";
            } else if (consumoReal < (consumoEsperado - margemGCabDia)) {
              statusReal = "Baixo";
            } else if (consumoReal > (consumoEsperado + margemGCabDia)) {
              statusReal = "Alto";
            } else {
              statusReal = "Ideal";
            }
          } else {
            statusReal = vp ? (vp.status_real ?? "—") : pStatus;
          }


          return {
            nome: p.nome,
            numAnimais: p.num_animais || 0,
            numSacos: pSacos,
            consumoGCabDia: consumoReal,
            status: statusReal,
            consumoRealGCabDia: consumoReal,
            statusReal,
            pesoMedioKg: vp ? Number(vp.peso_medio_kg ?? pesoMedio) : pesoMedio,
            gmdKgDia: Number(p.gmd_kg_dia ?? 0),
            pesoAbateMetaKg: Number(p.peso_abate_meta_kg ?? 500),
            categoria: cat,
            diasConsiderados,
            consumoPor100kg,
            pesoSacoKg: pesoSacoPasto,

            origemQr: pLanc.some(l => (l as any).origem === "qr"),
          };
        });

        const sortedRLanc = [...rLanc].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        const lastLanc = sortedRLanc.length > 0 ? sortedRLanc[0] : null;
        const dataStr = lastLanc?.created_at ? new Date(lastLanc.created_at).toLocaleDateString("pt-BR") : "—";

        // Compute ideal/max reference lines from product
        let consumoIdeal = 80; // default
        let consumoMaximo = 120; // default
        if (prod) {
          const avgPeso = pastosNoPeriodo.length > 0
            ? pastosNoPeriodo.reduce((s, p) => s + Number(p.peso_medio_kg ?? 0), 0) / pastosNoPeriodo.length : 300;
          const avgConsumo100 = (prod.consumo_recria1 + prod.consumo_recria2 + prod.consumo_engorda) / 3;
          if (avgConsumo100 > 0 && avgPeso > 0) {
            consumoIdeal = (avgConsumo100 * avgPeso) / 100 * 1000;
            consumoMaximo = consumoIdeal * 1.2;
          }
        }

        return {
          nome: ret.nome,
          capataz: ret.capataz,
          totalAnimais,
          sacosUtilizados,
          consumoMedio,
          gmd,
          pesoMedioKg: painelMaeByRetiro[ret.id]?.peso_medio_kg ?? 0,
          data: dataStr,
          produtoNome: prod?.nome ?? "—",
          precoKg,
          // Eficiência: fonte única get_painel_mae (ponderada por cab-dias).
          eficiencia: painelMaeByRetiro[ret.id]?.eficiencia ?? 0,
          custoDiario,
          score: Number(scoreCalc.scoreTotal.toFixed(1)),
          scoreMeta: Number(scoreCalc.scoreMeta.toFixed(1)),
          scoreCocho: scoreCalc.scoreCocho != null ? Number(scoreCalc.scoreCocho.toFixed(1)) : null,
          scoreSalga: Number(scoreCalc.scoreSalga.toFixed(1)),
          pesoMeta: scoreCalc.pesoMeta,
          pesoSalga: scoreCalc.pesoSalga,
          pesoCocho: scoreCalc.pesoCocho,
          detalheMeta: scoreCalc.detalheMeta,
          detalheSalga: scoreCalc.detalheSalga,
          detalheCocho: scoreCalc.detalheCocho,
          pastos: pastoReport,
          consumoIdeal: Number(consumoIdeal.toFixed(1)),
          consumoMaximo: Number(consumoMaximo.toFixed(1)),
          intervaloPadraoDias: diasIntervalo,
        };
      });

      // Compute category metrics
      const CATS = ["Recria 1", "Recria 2", "Engorda"];
      const catMap: Record<string, { weightedSum: number; totalAnimais: number; sacos: number; custoTotal: number; gmds: number[]; diasTotal: number }> = {};
      CATS.forEach(c => { catMap[c] = { weightedSum: 0, totalAnimais: 0, sacos: 0, custoTotal: 0, gmds: [], diasTotal: 0 }; });

      lancamentos.forEach(l => {
        const pesoMedio = l.peso_medio_kg ?? 0;
        const cat = l.categoria || classificarCategoria(pesoMedio);
        if (!catMap[cat]) return;
        const entry = catMap[cat];
        const animais = Number(l.num_animais ?? 0);
        entry.totalAnimais += animais;
        entry.sacos += l.num_sacos;
        entry.diasTotal += l.dias_no_pasto;

        const pasto = pastos.find(p => p.id === l.pasto_id);
        const retiro = retirosData.find(r => r.id === l.retiro_id);
        const consumoReal = Number(l.consumo_g_cab_dia ?? 0);
        if (consumoReal > 0 && animais > 0) {
          entry.weightedSum += consumoReal * animais;
          const prodId = pasto?.produto_id || retiro?.produto_id;
          if (prodId && produtosMap[prodId]) {
            const prod = produtosMap[prodId];
            entry.custoTotal += l.num_sacos * prod.peso_saco_kg * prod.preco_por_kg;
          }
        }

        if (pasto?.gmd_kg_dia && Number(pasto.gmd_kg_dia) > 0) {
          entry.gmds.push(Number(pasto.gmd_kg_dia));
        }
      });

      const categoriaMetrics: CatMetricsPDF[] = CATS.map(cat => {
        const e = catMap[cat];
        const consumoMedio = e.totalAnimais > 0 ? e.weightedSum / e.totalAnimais : 0;
        const gmd = e.gmds.length > 0 ? e.gmds.reduce((a, b) => a + b, 0) / e.gmds.length : 0;
        const custoMedio = e.totalAnimais > 0 ? e.custoTotal / e.totalAnimais : 0;
        const avgDias = e.sacos > 0 ? e.diasTotal / e.sacos : 30;
        const kgGanho = e.totalAnimais > 0 && gmd > 0 ? e.totalAnimais * gmd * avgDias : 0;
        const custoPorKgGanho = kgGanho > 0 ? e.custoTotal / kgGanho : 0;
        return { categoria: cat, consumoMedio, totalAnimais: e.totalAnimais, totalSacos: e.sacos, custoMedio, custoPorKgGanho, gmd, custoTotal: e.custoTotal };
      });

      const reportData: RelatorioPDFData = {
        fazendaNome,
        periodo: label,
        dataGeracao: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        geradoPor,
        retiros: retiroReportData,
        categoriaMetrics,
      };

      const blob = await pdf(<RelatorioPDF data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = fazendaNome.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const safeLabel = label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `relatorio_${safeName}_${safeLabel}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado com sucesso!");
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      toast.error("Erro ao gerar o relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function getDateRange(periodo: PeriodoTipo): { start: Date; end: Date; label: string } {
    if (periodo === "ultimos15") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 15);
      return { start, end, label: "Últimos 15 dias" };
    }
    if (periodo === "anual") {
      return {
        start: new Date(ano, 0, 1),
        end: new Date(ano, 11, 31, 23, 59, 59),
        label: `Ano ${ano}`,
      };
    }
    return {
      start: new Date(ano, mes - 1, 1),
      end: new Date(ano, mes, 0, 23, 59, 59),
      label: `${MESES[mes - 1]} ${ano}`,
    };
  }

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const retiroBloqueadoNome = lockedRetiroId
    ? retirosList.find((retiro) => retiro.id === lockedRetiroId)?.nome ?? "Retiro selecionado"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Exportar Relatório PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {monthlyContextEnabled ? (
            <div className="space-y-2">
              <Label>Período do painel</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {MESES[mes - 1]} {ano}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="ultimos15">Últimos 15 dias</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {periodoTipo === "mensal" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map((mesNome, i) => (
                          <SelectItem key={mesNome} value={String(i + 1)}>{mesNome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {periodoTipo === "anual" && (
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {lockedRetiroId ? (
            <div className="space-y-2">
              <Label>Escopo</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {retiroBloqueadoNome}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={retiroFiltro} onValueChange={setRetiroFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os retiros</SelectItem>
                  {retirosList.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExportar} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
