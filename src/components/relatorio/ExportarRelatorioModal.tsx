import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcConsumoGCabDia, calcConsumoEsperadoGCabDia, classificarCategoria, calcularCategoriaViva, classificarConsumo4, getConsumoPorCategoria, getMargemPorCategoria } from "@/lib/consumoCalc";

type MargensPct = {
  margem_mais_recria1_pct?: number | null; margem_menos_recria1_pct?: number | null;
  margem_mais_recria2_pct?: number | null; margem_menos_recria2_pct?: number | null;
  margem_mais_engorda_pct?: number | null; margem_menos_engorda_pct?: number | null;
};

function getMargemMaisPct(categoria: string, p: MargensPct): number | null {
  const c = (categoria || "").toLowerCase();
  const v = c.includes("recria 1") || c.includes("recria1") ? p.margem_mais_recria1_pct
    : c.includes("recria 2") || c.includes("recria2") ? p.margem_mais_recria2_pct
    : p.margem_mais_engorda_pct;
  return v == null ? null : Number(v);
}

function getMargemMenosPct(categoria: string, p: MargensPct): number | null {
  const c = (categoria || "").toLowerCase();
  const v = c.includes("recria 1") || c.includes("recria1") ? p.margem_menos_recria1_pct
    : c.includes("recria 2") || c.includes("recria2") ? p.margem_menos_recria2_pct
    : p.margem_menos_engorda_pct;
  return v == null ? null : Number(v);
}
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { fetchFormulasConfig } from "@/lib/formulasSistema";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import { fetchScoresCapataz } from "@/lib/scoreCapatazData";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import RelatorioPDF, { type RelatorioPDFData, type RetiroReportData, type PastoReportData, type CatMetricsPDF, type PrevisaoAbatePDFData } from "./RelatorioPDF";

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
  produtoId?: string | null;
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
  produtoId,
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
    setMes(currentDate.getMonth() + 1);
    setAno(currentDate.getFullYear());
    setRetiroFiltro(lockedRetiroId ?? "todos");
  }, [open, initialMes, initialAno, lockedRetiroId]);

  async function handleExportar() {
    setLoading(true);
    try {
      const formulas = await fetchFormulasConfig();
      const periodoSelecionado: PeriodoTipo = monthlyContextEnabled ? "mensal" : periodoTipo;
      const retiroSelecionado = lockedRetiroId ?? (retiroFiltro !== "todos" ? retiroFiltro : null);
      const produtoSelecionado = produtoId && produtoId !== "todos" ? produtoId : null;
      const { start, end, label } = getDateRange(periodoSelecionado);

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
      let painelPastoRows: any[] = [];
      if (periodoSelecionado === "mensal" && retiroIds.length > 0) {
        const { data: vpRows } = await (supabase as any)
          .from("view_painel_mae_pasto")
          .select("pasto_id, retiro_id, peso_medio_kg, consumo_real_g_cab_dia, indice_real, status_real, kg_fornecido, cab_dias_global, eficiencia_pasto")
          .in("retiro_id", retiroIds)
          .eq("mes_referencia", mes)
          .eq("ano_referencia", ano);
        painelPastoRows = vpRows ?? [];
        for (const row of painelPastoRows) painelPastoByPastoId[row.pasto_id] = row;
      }




      const { data: pastosData } = await supabase.from("pastos")
        .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id, categoria, sexo")
        .in("retiro_id", retiroIds).eq("ativo", true);
      let pastos = pastosData ?? [];
      const pastoIdsEscopoRelatorio = new Set(pastos.map(pasto => pasto.id));

      // SEÇÃO 4: única fonte de peso, GMD, dias e data prevista é a função do banco.
      // O escopo de retiro é aplicado pelos IDs antes do filtro de produto do relatório.
      const { data: abateConfigRows, error: abateConfigError } = await (supabase as any)
        .from("abate_config")
        .select("id")
        .eq("fazenda_id", fazendaId)
        .limit(1);
      if (abateConfigError) throw abateConfigError;

      let previsaoAbate: PrevisaoAbatePDFData | null = null;
      if ((abateConfigRows ?? []).length > 0) {
        const { data: previsaoRows, error: previsaoError } = await (supabase as any)
          .rpc("previsao_abate", { p_fazenda: fazendaId });
        if (previsaoError) throw previsaoError;
        const rows = ((previsaoRows ?? []) as any[])
          .filter(row => pastoIdsEscopoRelatorio.has(row.pasto_id))
          .map(row => ({
            pastoId: String(row.pasto_id),
            pasto: String(row.pasto ?? "—"),
            retiro: String(row.retiro ?? "—"),
            categoria: row.categoria == null ? null : String(row.categoria),
            numAnimais: Number(row.num_animais ?? 0),
            pesoAtual: Number(row.peso_atual ?? 0),
            pesoAlvo: Number(row.peso_alvo ?? 0),
            gmdHoje: row.gmd_hoje == null ? null : Number(row.gmd_hoje),
            diasParaAlvo: Number(row.dias_para_alvo ?? 0),
            dataPrevista: row.data_prevista == null ? null : String(row.data_prevista),
          }))
          .sort((a, b) => a.diasParaAlvo - b.diasParaAlvo);
        previsaoAbate = {
          calculadaEm: new Date().toLocaleDateString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
          }),
          rows,
        };
      }
      let pastoIds = pastos.map(p => p.id);

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

      // O relatório herda o produto do Painel do Gerente. A fonte do produto
      // efetivo é a mesma do painel: ocupação ativa → pasto → retiro.
      const retiroProdutoById = Object.fromEntries(retirosData.map(r => [r.id, r.produto_id ?? null]));
      const produtoEfetivoDoPasto = (p: { id: string; retiro_id: string; produto_id: string | null }) =>
        ocupacaoProdutoByPasto[p.id] ?? p.produto_id ?? retiroProdutoById[p.retiro_id] ?? null;
      if (produtoSelecionado) {
        pastos = pastos.filter(p => produtoEfetivoDoPasto(p) === produtoSelecionado);
        pastoIds = pastos.map(p => p.id);
        if (pastoIds.length === 0) {
          toast.error("Nenhum pasto usa o produto selecionado.");
          return;
        }

        // Recalcula os mesmos agregados mensais sobre o conjunto filtrado.
        if (periodoSelecionado === "mensal") {
          const { data: realRows } = await (supabase as any)
            .from("view_lancamento_consumo_real")
            .select("pasto_id, kg_fornecido, cab_dias_assumidos")
            .in("pasto_id", pastoIds)
            .eq("mes_referencia", mes)
            .eq("ano_referencia", ano);
          for (const ret of retirosData) {
            const rPastos = pastos.filter(p => p.retiro_id === ret.id);
            const rIds = new Set(rPastos.map(p => p.id));
            const rView = painelPastoRows.filter(row => rIds.has(row.pasto_id));
            const rReal = (realRows ?? []).filter((row: any) => rIds.has(row.pasto_id));
            const cabDiasGlobal = rView.reduce((sum, row) => sum + (Number(row.cab_dias_global) || 0), 0);
            const eficienciaPonderada = rView.reduce(
              (sum, row) => sum + (Number(row.eficiencia_pasto) || 0) * (Number(row.cab_dias_global) || 0),
              0,
            );
            const kgReal = rReal.reduce((sum: number, row: any) => sum + (Number(row.kg_fornecido) || 0), 0);
            const cabDiasReal = rReal.reduce((sum: number, row: any) => sum + (Number(row.cab_dias_assumidos) || 0), 0);
            let pesoSum = 0;
            let animaisPeso = 0;
            for (const p of rPastos) {
              const animais = Number(p.num_animais) || 0;
              if (animais <= 0) continue;
              const peso = Number(painelPastoByPastoId[p.id]?.peso_medio_kg ?? p.peso_medio_kg) || 0;
              pesoSum += peso * animais;
              animaisPeso += animais;
            }
            painelMaeByRetiro[ret.id] = {
              eficiencia: cabDiasGlobal > 0 ? eficienciaPonderada / cabDiasGlobal : 0,
              peso_medio_kg: animaisPeso > 0 ? pesoSum / animaisPeso : 0,
              consumo_real_g_cab_dia: cabDiasReal > 0 ? (kgReal * 1000) / cabDiasReal : 0,
            };
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
      const produtosMap: Record<string, {
        nome: string; peso_saco_kg: number; preco_por_kg: number;
        consumo_recria1: number; consumo_recria2: number; consumo_engorda: number;
        margem_recria1: number; margem_recria2: number; margem_engorda: number;
        margem_mais_recria1_pct: number | null; margem_menos_recria1_pct: number | null;
        margem_mais_recria2_pct: number | null; margem_menos_recria2_pct: number | null;
        margem_mais_engorda_pct: number | null; margem_menos_engorda_pct: number | null;
        amarelo_buffer_g: number;
      }> = {};
      if (produtoIds.length > 0) {
        const { data: prodData } = await (supabase as any).from("produtos")
          .select("id, nome, peso_saco_kg, preco_por_kg, consumo_recria1, consumo_recria2, consumo_engorda, margem_recria1, margem_recria2, margem_engorda, margem_mais_recria1_pct, margem_menos_recria1_pct, margem_mais_recria2_pct, margem_menos_recria2_pct, margem_mais_engorda_pct, margem_menos_engorda_pct, amarelo_buffer_g")
          .in("id", produtoIds);
        const num = (v: any) => (v == null ? null : Number(v));
        for (const p of ((prodData ?? []) as any[])) {
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
            margem_mais_recria1_pct: num(p.margem_mais_recria1_pct),
            margem_menos_recria1_pct: num(p.margem_menos_recria1_pct),
            margem_mais_recria2_pct: num(p.margem_mais_recria2_pct),
            margem_menos_recria2_pct: num(p.margem_menos_recria2_pct),
            margem_mais_engorda_pct: num(p.margem_mais_engorda_pct),
            margem_menos_engorda_pct: num(p.margem_menos_engorda_pct),
            amarelo_buffer_g: Number(p.amarelo_buffer_g ?? 0),
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

      // Nota do Capataz: fonte única compartilhada com a aba Ranking do Painel.
      const scores = await fetchScoresCapataz({
        fazendaId,
        start,
        end,
        periodo: periodoSelecionado === "mensal" ? "mensal" : periodoSelecionado === "anual" ? "anual" : "range",
        mes,
        ano,
        retiroId: retiroSelecionado,
        pastoIds: produtoSelecionado ? pastoIds : null,
      });
      const diasIntervalo = scores.diasIntervalo;

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

        const produtoBaseId = produtoSelecionado ?? ret.produto_id;
        const prod = produtoBaseId ? produtosMap[produtoBaseId] : null;
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

        const gVals = pastosNoPeriodo.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia));
        const gmd = gVals.length > 0 ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;

        // Custo por pasto: usa o produto do próprio pasto quando existir,
        // caindo para o produto do retiro.
        const custoTotal = pastosNoPeriodo.reduce((sum, p) => {
          const pProd = produtosMap[produtoEfetivoDoPasto(p) ?? ""] ?? prod;
          const pPeso = pProd?.peso_saco_kg ?? pesoSacoKg;
          const pPreco = pProd?.preco_por_kg ?? precoKg;
          const pSacos = rLanc.filter(l => l.pasto_id === p.id).reduce((a, l) => a + (l.num_sacos || 0), 0);
          return sum + pSacos * pPeso * pPreco;
        }, 0);
        const custoDiario = consumoMedio > 0 && precoKg > 0 ? (consumoMedio / 1000) * precoKg : 0;


        const scoreCalc = scores.byRetiro[ret.id]?.result ?? scores.semSalga;

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
          const pesoMedio = Number(p.peso_medio_kg ?? 0);
          // Categoria calculada ao vivo (peso + sexo), nunca o campo salvo.
          const cat = calcularCategoriaViva(pesoMedio, (p as any).sexo);
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
          const pesoMedioStatus = Number(vp?.peso_medio_kg ?? pesoMedio);
          const consumoEsperado = calcConsumoEsperadoGCabDia(consumoPor100kg, pesoMedioStatus);
          let statusReal: string;
          if (consumoRealV2 !== undefined) {
            const maisPct = pProd ? getMargemMaisPct(cat, pProd) : null;
            const menosPct = pProd ? getMargemMenosPct(cat, pProd) : null;
            if (consumoEsperado <= 0) {
              statusReal = "—";
            } else if (maisPct != null && menosPct != null) {
              // Produto migrado: 4 estados com buffer amarelo (mesma regra das demais telas)
              statusReal = classificarConsumo4(
                consumoReal,
                consumoEsperado,
                maisPct,
                menosPct,
                Number(pProd?.amarelo_buffer_g ?? 0),
              );
            } else {
              // Compatibilidade: margem absoluta, 3 estados
              const margemPor100kg = pProd ? getMargemPorCategoria(cat, pProd) : 0;
              const margemGCabDia = margemPor100kg * pesoMedioStatus * 10;
              if (consumoReal < (consumoEsperado - margemGCabDia)) {
                statusReal = "Baixo";
              } else if (consumoReal > (consumoEsperado + margemGCabDia)) {
                statusReal = "Alto";
              } else {
                statusReal = "Ideal";
              }
            }
          } else {
            // Sem dado mensal: não classificar com regra diferente.
            statusReal = "—";
          }


          return {
            nome: p.nome,
            numAnimais: p.num_animais || 0,
            numSacos: pSacos,
            consumoGCabDia: consumoReal,
            status: statusReal,
            consumoRealGCabDia: consumoReal,
            consumoEsperadoGCabDia: consumoEsperado,
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
      }).filter(retiro => retiro.pastos.length > 0);

      // ===== SEÇÃO 5 — Métricas por categoria =====
      // Período sempre por mes_referencia/ano_referencia (nunca created_at).
      let lancCat: any[] = lancamentos;
      if (periodoSelecionado !== "mensal" && periodoSelecionado !== "anual" && pastoIds.length > 0) {
        const { data: lc } = await supabase.from("view_consumo_tempo_real" as any)
          .select("id, pasto_id, num_sacos, num_animais, dias_no_pasto, categoria, created_at, retiro_id, mes_referencia, ano_referencia")
          .in("pasto_id", pastoIds)
          .eq("mes_referencia", mes)
          .eq("ano_referencia", ano);
        lancCat = (lc as any[]) ?? [];
      }
      // Categoria e num_animais sempre da tabela lancamentos (a view inflava a contagem).
      const catIds = lancCat.map(l => l.id).filter(Boolean);
      const lancById: Record<string, { categoria: string | null; num_animais: number | null }> = {};
      for (let i = 0; i < catIds.length; i += 200) {
        const { data: cr } = await supabase.from("lancamentos").select("id, categoria, num_animais").in("id", catIds.slice(i, i + 200));
        (cr ?? []).forEach((r: any) => { lancById[r.id] = { categoria: r.categoria, num_animais: r.num_animais }; });
      }
      lancCat = lancCat.map(l => ({ ...l, categoria: l.id in lancById ? lancById[l.id].categoria : l.categoria }));
      const SEM_CAT = "Sem categoria";
      const CATS = ["Recria 1", "Recria 2", "Engorda"];
      type CatAcc = { sacos: number; custoTotal: number; kgTotal: number; animalDias: number; gmds: number[]; diasTotal: number };
      const catMap: Record<string, CatAcc> = {};
      const novoAcc = (): CatAcc => ({ sacos: 0, custoTotal: 0, kgTotal: 0, animalDias: 0, gmds: [], diasTotal: 0 });
      CATS.forEach(c => { catMap[c] = novoAcc(); });

      // Animais: MESMA fonte e regra do card "Total Animais" do Painel da Fazenda —
      // soma de pastos.num_animais dos pastos ativos dos retiros ativos (respeitando
      // o filtro de retiro), agrupada pela categoria do pasto.
      const animaisPorCat: Record<string, number> = {};
      {
        const { data: pastosAnimais } = await supabase.from("pastos")
          .select("num_animais, categoria")
          .in("retiro_id", retiroIds)
          .eq("ativo", true);
        (pastosAnimais ?? []).forEach((p: any) => {
          const n = Number(p.num_animais) || 0;
          if (n <= 0) return;
          const cat = (p.categoria && String(p.categoria).trim()) || SEM_CAT;
          animaisPorCat[cat] = (animaisPorCat[cat] ?? 0) + n;
          if (!catMap[cat]) catMap[cat] = novoAcc();
        });
      }

      lancCat.forEach(l => {
        const cat = (l.categoria && String(l.categoria).trim()) || SEM_CAT;
        if (!catMap[cat]) catMap[cat] = novoAcc();
        const entry = catMap[cat];
        const animais = l.id in lancById && lancById[l.id].num_animais != null
          ? Number(lancById[l.id].num_animais)
          : Number(l.num_animais ?? 0);
        const sacos = Number(l.num_sacos ?? 0);
        const dias = Number(l.dias_no_pasto ?? 0);
        entry.sacos += sacos;
        entry.diasTotal += dias;
        entry.animalDias += animais * dias;


        const pasto = pastos.find(p => p.id === l.pasto_id);
        const retiro = retirosData.find(r => r.id === l.retiro_id);
        const prodId = pasto ? produtoEfetivoDoPasto(pasto) : retiro?.produto_id;
        if (prodId && produtosMap[prodId]) {
          const prod = produtosMap[prodId];
          entry.kgTotal += sacos * prod.peso_saco_kg;
          entry.custoTotal += sacos * prod.peso_saco_kg * prod.preco_por_kg;
        }

        if (pasto?.gmd_kg_dia && Number(pasto.gmd_kg_dia) > 0) {
          entry.gmds.push(Number(pasto.gmd_kg_dia));
        }
      });

      const catOrder = [...CATS, ...Object.keys(catMap).filter(c => !CATS.includes(c) && c !== SEM_CAT), ...(catMap[SEM_CAT] ? [SEM_CAT] : [])];
      const categoriaMetrics: CatMetricsPDF[] = catOrder.map(cat => {
        const e = catMap[cat];
        const totalAnimais = animaisPorCat[cat] ?? 0;

        const consumoMedio = e.animalDias > 0 ? (e.kgTotal * 1000) / e.animalDias : 0;
        const custoMedio = e.animalDias > 0 ? (e.custoTotal / e.animalDias) * 30 : 0;
        const gmd = e.gmds.length > 0 ? e.gmds.reduce((a, b) => a + b, 0) / e.gmds.length : 0;
        const avgDias = e.sacos > 0 ? e.diasTotal / e.sacos : 30;
        const kgGanho = totalAnimais > 0 && gmd > 0 ? totalAnimais * gmd * avgDias : 0;
        const custoPorKgGanho = kgGanho > 0 ? e.custoTotal / kgGanho : 0;
        return { categoria: cat, consumoMedio, totalAnimais, totalSacos: e.sacos, custoMedio, custoPorKgGanho, gmd, custoTotal: e.custoTotal };
      });

      const reportData: RelatorioPDFData = {
        fazendaNome,
        periodo: label,
        dataGeracao: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        geradoPor,
        retiros: retiroReportData,
        categoriaMetrics,
        previsaoAbate,
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
  const painelYears = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => 2024 + i);
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
              <div className="grid grid-cols-2 gap-3">
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((mesNome, i) => (
                      <SelectItem key={mesNome} value={String(i + 1)}>{mesNome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {painelYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
