import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import { fetchProdutoIdsDaFazenda } from "@/lib/produtosFazenda";
import type { PainelMaeData } from "@/hooks/usePainelMae";

export interface ProdutoOption {
  id: string;
  nome: string;
  peso_saco_kg: number | null;
  preco_por_kg: number | null;
}

export interface PainelProdutoAgg {
  totalAnimais: number;
  consumoMedio: number;
  sacosUtilizados: number;
  custoDiario: number;
  custoMensal: number;
  gmdMedio: number;
  statusDistribution: {
    baixo: number; atencao: number; ideal: number; alto: number;
    baixoPct: number; atencaoPct: number; idealPct: number; altoPct: number;
  };
}

const emptyMae: PainelMaeData = {
  consumo_real_g_cab_dia: 0,
  consumo_global_g_cab_dia: 0,
  eficiencia: 0,
  pastos_na_meta_num: 0,
  pastos_na_meta_den: 0,
  peso_medio_kg: 0,
};

const emptyAgg: PainelProdutoAgg = {
  totalAnimais: 0,
  consumoMedio: 0,
  sacosUtilizados: 0,
  custoDiario: 0,
  custoMensal: 0,
  gmdMedio: 0,
  statusDistribution: {
    baixo: 0, atencao: 0, ideal: 0, alto: 0,
    baixoPct: 0, atencaoPct: 0, idealPct: 0, altoPct: 0,
  },
};

interface Params {
  fazendaId?: string | null;
  retiroId?: string | null;
  mes: number;
  ano: number;
  produtoId?: string | null; // null/"todos" = sem filtro
}

/**
 * Filtro de PRODUTO do Painel do Gerente.
 *
 * - Lista os produtos vinculados à fazenda (produtos_fazendas) para o seletor.
 * - Com um produto selecionado, recalcula os indicadores do painel considerando
 *   apenas os pastos cujo produto ativo (ocupação ativa → pasto → retiro) é o
 *   produto escolhido. As mesmas regras/fontes do painel são usadas:
 *   view_painel_mae_pasto (global, eficiência, meta, status),
 *   view_lancamento_consumo_real (consumo real) e
 *   view_consumo_tempo_real (sacos, cabeças-dia, consumo médio).
 */
export function usePainelProduto({ fazendaId, retiroId, mes, ano, produtoId }: Params) {
  const filtroAtivo = !!produtoId && produtoId !== "todos";

  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [painelMae, setPainelMae] = useState<PainelMaeData>(emptyMae);
  const [agg, setAgg] = useState<PainelProdutoAgg>(emptyAgg);
  const [abates, setAbates] = useState({ abatidosMes: 0, abatidosAno: 0 });
  const [loading, setLoading] = useState(false);

  // ---- Produtos vinculados à fazenda (seletor) ----
  const loadProdutos = useCallback(async () => {
    if (!fazendaId) { setProdutos([]); return; }
    const ids = await fetchProdutoIdsDaFazenda(fazendaId);
    if (!ids || ids.length === 0) { setProdutos([]); return; }
    const { data } = await (supabase as any)
      .from("produtos")
      .select("id, nome, peso_saco_kg, preco_por_kg")
      .in("id", ids)
      .order("nome");
    setProdutos(((data ?? []) as ProdutoOption[]));
  }, [fazendaId]);

  useEffect(() => { void loadProdutos(); }, [loadProdutos]);

  // ---- Recalculo restrito ao produto ----
  const load = useCallback(async () => {
    if (!fazendaId || !filtroAtivo) {
      setPainelMae(emptyMae);
      setAgg(emptyAgg);
      setAbates({ abatidosMes: 0, abatidosAno: 0 });
      return;
    }
    setLoading(true);
    try {
      const { data: retirosData } = await supabase
        .from("retiros")
        .select("id, produto_id")
        .eq("fazenda_id", fazendaId)
        .eq("ativo", true);
      let retiros = (retirosData ?? []) as { id: string; produto_id: string | null }[];
      if (retiroId) retiros = retiros.filter(r => r.id === retiroId);
      const retiroIds = retiros.map(r => r.id);
      if (retiroIds.length === 0) {
        setPainelMae(emptyMae); setAgg(emptyAgg); setAbates({ abatidosMes: 0, abatidosAno: 0 });
        return;
      }
      const retiroProduto: Record<string, string | null> = {};
      for (const r of retiros) retiroProduto[r.id] = r.produto_id ?? null;

      const { data: pastosData } = await supabase
        .from("pastos")
        .select("id, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, produto_id")
        .in("retiro_id", retiroIds)
        .eq("ativo", true);
      const pastos = (pastosData ?? []) as {
        id: string; retiro_id: string; num_animais: number;
        peso_medio_kg: number | null; gmd_kg_dia: number | null; produto_id: string | null;
      }[];
      if (pastos.length === 0) {
        setPainelMae(emptyMae); setAgg(emptyAgg); setAbates({ abatidosMes: 0, abatidosAno: 0 });
        return;
      }
      const todosPastoIds = pastos.map(p => p.id);

      // Produto ativo por pasto: ocupação aberta → pasto → retiro
      const { data: ocupData } = await (supabase as any)
        .from("ocupacoes_pasto")
        .select("pasto_id, produto_id, data_entrada, data_saida")
        .in("pasto_id", todosPastoIds)
        .is("data_saida", null)
        .order("data_entrada", { ascending: false });
      const ocupProduto: Record<string, string> = {};
      for (const o of ((ocupData ?? []) as { pasto_id: string; produto_id: string | null }[])) {
        if (o.produto_id && !ocupProduto[o.pasto_id]) ocupProduto[o.pasto_id] = o.produto_id;
      }
      const produtoDoPasto = (p: { id: string; retiro_id: string; produto_id: string | null }) =>
        ocupProduto[p.id] ?? p.produto_id ?? retiroProduto[p.retiro_id] ?? null;

      const pastosFiltrados = pastos.filter(p => produtoDoPasto(p) === produtoId);
      const pastoIds = pastosFiltrados.map(p => p.id);
      if (pastoIds.length === 0) {
        setPainelMae(emptyMae); setAgg(emptyAgg); setAbates({ abatidosMes: 0, abatidosAno: 0 });
        return;
      }

      const produto = produtos.find(p => p.id === produtoId);

      const [maeRes, realRes, lancRes, abMesRes, abAnoRes] = await Promise.all([
        (supabase as any).from("view_painel_mae_pasto")
          .select("pasto_id, peso_medio_kg, kg_fornecido, cab_dias_global, eficiencia_pasto, status_global")
          .in("pasto_id", pastoIds).eq("mes_referencia", mes).eq("ano_referencia", ano),
        (supabase as any).from("view_lancamento_consumo_real")
          .select("pasto_id, kg_fornecido, cab_dias_assumidos")
          .in("pasto_id", pastoIds).eq("mes_referencia", mes).eq("ano_referencia", ano),
        (supabase as any).from("view_consumo_tempo_real")
          .select("pasto_id, num_sacos, num_animais, dias_no_pasto, consumo_g_cab_dia")
          .in("pasto_id", pastoIds).eq("mes_referencia", mes).eq("ano_referencia", ano),
        supabase.from("abates" as any).select("quantidade").in("pasto_id", pastoIds).eq("mes", mes).eq("ano", ano),
        supabase.from("abates" as any).select("quantidade").in("pasto_id", pastoIds).eq("ano", ano),
      ]);

      const maeRows = ((maeRes.data ?? []) as any[]);
      let kgGlobal = 0, cabDiasGlobal = 0, efSum = 0, meta = 0;
      const status = { baixo: 0, atencao: 0, ideal: 0, alto: 0 };
      const pesoDaView: Record<string, number | null> = {};
      for (const r of maeRows) {
        const cab = Number(r.cab_dias_global) || 0;
        kgGlobal += Number(r.kg_fornecido) || 0;
        cabDiasGlobal += cab;
        efSum += (Number(r.eficiencia_pasto) || 0) * cab;
        const s = String(r.status_global ?? "");
        if (s === "Ideal" || s === "Atenção") meta++;
        if (s === "Baixo") status.baixo++;
        else if (s === "Atenção") status.atencao++;
        else if (s === "Ideal") status.ideal++;
        else if (s === "Alto") status.alto++;
        pesoDaView[r.pasto_id] = r.peso_medio_kg != null ? Number(r.peso_medio_kg) : null;
      }

      const realRows = ((realRes.data ?? []) as any[]);
      let kgReal = 0, cabDiasReal = 0;
      for (const r of realRows) {
        kgReal += Number(r.kg_fornecido) || 0;
        cabDiasReal += Number(r.cab_dias_assumidos) || 0;
      }

      const lancRows = ((lancRes.data ?? []) as any[]);
      let sacos = 0, cabDiasLanc = 0;
      for (const l of lancRows) {
        sacos += Number(l.num_sacos) || 0;
        cabDiasLanc += (Number(l.num_animais) || 0) * (Number(l.dias_no_pasto) || 0);
      }
      const consumoMedio = computeConsumoMedioPonderado(
        lancRows.map(l => ({ consumo_g_cab_dia: l.consumo_g_cab_dia, num_animais: l.num_animais })),
      );

      // Peso médio ponderado por animais (mesma regra do get_painel_mae)
      let pesoSum = 0, animaisPeso = 0;
      for (const p of pastosFiltrados) {
        if (!p.num_animais || p.num_animais <= 0) continue;
        const peso = pesoDaView[p.id] ?? (p.peso_medio_kg != null ? Number(p.peso_medio_kg) : 0) ?? 0;
        pesoSum += peso * p.num_animais;
        animaisPeso += p.num_animais;
      }

      const pastosComLanc = new Set(lancRows.map(l => String(l.pasto_id)));
      const gmds = pastosFiltrados
        .filter(p => pastosComLanc.has(p.id) && p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0)
        .map(p => Number(p.gmd_kg_dia));

      const custoMensal = sacos * (Number(produto?.peso_saco_kg) || 0) * (Number(produto?.preco_por_kg) || 0);
      const totalStatus = status.baixo + status.atencao + status.ideal + status.alto;
      const pct = (n: number) => (totalStatus > 0 ? (n / totalStatus) * 100 : 0);

      setPainelMae({
        consumo_real_g_cab_dia: cabDiasReal > 0 ? Number(((kgReal * 1000) / cabDiasReal).toFixed(2)) : 0,
        consumo_global_g_cab_dia: cabDiasGlobal > 0 ? Number(((kgGlobal * 1000) / cabDiasGlobal).toFixed(2)) : 0,
        eficiencia: cabDiasGlobal > 0 ? Number((efSum / cabDiasGlobal).toFixed(1)) : 0,
        pastos_na_meta_num: meta,
        pastos_na_meta_den: maeRows.length,
        peso_medio_kg: animaisPeso > 0 ? Number((pesoSum / animaisPeso).toFixed(1)) : 0,
      });

      setAgg({
        totalAnimais: pastosFiltrados.reduce((s, p) => s + (p.num_animais || 0), 0),
        consumoMedio,
        sacosUtilizados: sacos,
        custoDiario: cabDiasLanc > 0 ? custoMensal / cabDiasLanc : 0,
        custoMensal,
        gmdMedio: gmds.length > 0 ? gmds.reduce((a, b) => a + b, 0) / gmds.length : 0,
        statusDistribution: {
          ...status,
          baixoPct: pct(status.baixo),
          atencaoPct: pct(status.atencao),
          idealPct: pct(status.ideal),
          altoPct: pct(status.alto),
        },
      });

      setAbates({
        abatidosMes: ((abMesRes.data as any[]) ?? []).reduce((s, r) => s + (r.quantidade || 0), 0),
        abatidosAno: ((abAnoRes.data as any[]) ?? []).reduce((s, r) => s + (r.quantidade || 0), 0),
      });
    } catch (e) {
      console.error("usePainelProduto error:", e);
      setPainelMae(emptyMae);
      setAgg(emptyAgg);
      setAbates({ abatidosMes: 0, abatidosAno: 0 });
    } finally {
      setLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano, produtoId, filtroAtivo, produtos]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({
    filtroAtivo,
    produtos,
    painelMae,
    agg,
    ...abates,
    loading,
    refresh: load,
  }), [filtroAtivo, produtos, painelMae, agg, abates, loading, load]);
}
