import { useEffect, useState, useMemo, useCallback } from "react";
import { usePainelMae } from "@/hooks/usePainelMae";
import MetricasPorCategoria from "@/components/painel/MetricasPorCategoria";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, TrendingDown, TrendingUp, Activity, BarChart3, MapPin, Package, Users, Beef, DollarSign, Droplets, FileDown, Loader2, Gauge, Scale } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import {
  classificarCategoria,
  calcIndiceConsumo,
} from "@/lib/consumoCalc";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { pdf } from "@react-pdf/renderer";
import PainelInteligenciaPDF, { type PainelPDFData, type CatMetricsPDF } from "@/components/painel/PainelInteligenciaPDF";
import { toast } from "sonner";

interface Fazenda { id: string; nome: string; cidade: string; estado: string; intervalo_padrao_dias: number | null; }
interface Retiro { id: string; nome: string; fazenda_id: string; produto_id: string | null; }
interface Pasto { id: string; nome: string; retiro_id: string; num_animais: number; peso_medio_kg: number | null; categoria: string | null; sexo: string | null; produto_id: string | null; gmd_kg_dia: number | null; }
interface Produto {
  id: string; nome: string; peso_saco_kg: number;
  consumo_engorda: number | null; consumo_recria1: number | null; consumo_recria2: number | null; preco_por_kg: number | null;
  margem_engorda: number | null; margem_recria1: number | null; margem_recria2: number | null;
}
interface Lancamento {
  id: string; fazenda_id: string; retiro_id: string; pasto_id: string;
  mes_referencia: number; ano_referencia: number;
  num_animais: number; num_sacos: number; dias_no_pasto: number;
  origem: string; created_at: string;
  categoria: string | null; sexo: string | null; peso_medio_kg: number | null;
  status_consumo: string | null; indice_consumo: number | null;
  consumo_g_cab_dia: number | null;
  // From view_consumo_mineral
  total_sal_kg: number;
  consumo_kg_cabeca: number;
  cab_dias: number;
  preco_por_kg: number;
}

const ESTADOS_BR: Record<string, { x: number; y: number }> = {
  AC: { x: 100, y: 260 }, AL: { x: 620, y: 310 }, AP: { x: 340, y: 100 },
  AM: { x: 190, y: 170 }, BA: { x: 560, y: 330 }, CE: { x: 580, y: 230 },
  DF: { x: 470, y: 370 }, ES: { x: 570, y: 420 }, GO: { x: 440, y: 380 },
  MA: { x: 470, y: 210 }, MT: { x: 340, y: 340 }, MS: { x: 370, y: 430 },
  MG: { x: 510, y: 400 }, PA: { x: 340, y: 180 }, PB: { x: 620, y: 250 },
  PR: { x: 420, y: 480 }, PE: { x: 610, y: 270 }, PI: { x: 520, y: 250 },
  RJ: { x: 540, y: 440 }, RN: { x: 620, y: 230 }, RS: { x: 400, y: 540 },
  RO: { x: 210, y: 300 }, RR: { x: 220, y: 80 }, SC: { x: 430, y: 510 },
  SP: { x: 460, y: 440 }, SE: { x: 610, y: 300 }, TO: { x: 440, y: 290 },
};

function getStatusColor(
  indice: number,
  limites: { limiteBaixo: number; limiteAlto: number } = { limiteBaixo: 0.9, limiteAlto: 1.1 },
): { color: string; label: string; emoji: string } {
  if (indice <= 0) return { color: "text-muted-foreground", label: "Sem dados", emoji: "⚪" };
  if (indice < limites.limiteBaixo) return { color: "text-red-500", label: "Abaixo do ideal", emoji: "🔴" };
  if (indice > limites.limiteAlto) return { color: "text-green-600", label: "Acima (possível desperdício)", emoji: "🟢" };
  return { color: "text-yellow-500", label: "Ideal", emoji: "🟡" };
}

/** Paleta unificada de status textual (4 estados novos + 3 antigos). */
export function corStatusConsumo(status?: string | null): { color: string; emoji: string } {
  switch (status) {
    case "Baixo":
    case "ABAIXO":
      return { color: "#E53935", emoji: "🔴" };
    case "Atenção":
      return { color: "#FBC02D", emoji: "🟡" };
    case "Ideal":
    case "IDEAL":
      return { color: "#43A047", emoji: "🟢" };
    case "Alto":
    case "ACIMA":
      return { color: "#1E88E5", emoji: "🔵" };
    default:
      return { color: "#9E9E9E", emoji: "⚪" };
  }
}


function getMapColor(consumo: number, media: number): string {
  if (!media || !consumo) return "hsl(var(--muted))";
  const ratio = consumo / media;
  if (ratio < 0.7) return "#ef4444";
  if (ratio < 0.95) return "#eab308";
  return "#22c55e";
}

export default function PainelInteligenciaPage() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vinculosProduto, setVinculosProduto] = useState<Record<string, string[]>>({});
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroFazenda, setFiltroFazenda] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroSexo, setFiltroSexo] = useState("all");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [filtroComparar, setFiltroComparar] = useState("none");
  const { painelMae } = usePainelMae(filtroFazenda !== "all" ? filtroFazenda : null, null, filtroMes, filtroAno);
  const { painelMae: painelMaeB } = usePainelMae(filtroComparar !== "none" ? filtroComparar : null, null, filtroMes, filtroAno);
  const comparando = filtroFazenda !== "all" && filtroComparar !== "none" && filtroComparar !== filtroFazenda;
  const formulas = useFormulasSistema();
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    async function load() {
      const [fRes, rRes, pRes, prRes, lRes] = await Promise.all([
        supabase.from("fazendas").select("id, nome, cidade, estado, intervalo_padrao_dias").eq("ativo", true),
        supabase.from("retiros").select("id, nome, fazenda_id, produto_id").eq("ativo", true),
        supabase.from("pastos").select("id, nome, retiro_id, num_animais, peso_medio_kg, categoria, sexo, produto_id, gmd_kg_dia").eq("ativo", true),
        supabase.from("produtos").select("id, nome, peso_saco_kg, consumo_engorda, consumo_recria1, consumo_recria2, margem_engorda, margem_recria1, margem_recria2, preco_por_kg").eq("ativo", true),
        supabase.from("view_consumo_tempo_real" as any).select("*").order("created_at", { ascending: false }),
      ]);
      setFazendas(fRes.data ?? []);
      setRetiros(rRes.data ?? []);
      setPastos(pRes.data ?? []);
      setProdutos(prRes.data ?? []);
      setLancamentos((lRes.data as unknown as Lancamento[]) ?? []);
      setLoading(false);
    }
    load();

    const channel = supabase.channel("inteligencia-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Lookup helpers
  const retiroById = useMemo(() => {
    const map: Record<string, Retiro> = {};
    retiros.forEach(r => { map[r.id] = r; });
    return map;
  }, [retiros]);

  const fazendaById = useMemo(() => {
    const map: Record<string, Fazenda> = {};
    fazendas.forEach(f => { map[f.id] = f; });
    return map;
  }, [fazendas]);

  const pastoById = useMemo(() => {
    const map: Record<string, Pasto> = {};
    pastos.forEach(p => { map[p.id] = p; });
    return map;
  }, [pastos]);

  const produtoById = useMemo(() => {
    const map: Record<string, Produto> = {};
    produtos.forEach(p => { map[p.id] = p; });
    return map;
  }, [produtos]);

  const getFazendaForLancamento = (l: Lancamento): Fazenda | undefined => {
    return fazendaById[l.fazenda_id];
  };

  // Resolve effective produto_id: pasto -> retiro (needed for product filters)
  const getEffectiveProdutoId = useCallback((l: Lancamento): string | null => {
    const pasto = pastoById[l.pasto_id];
    if (pasto?.produto_id) return pasto.produto_id;
    const retiro = retiroById[l.retiro_id];
    if (retiro?.produto_id) return retiro.produto_id;
    return null;
  }, [pastoById, retiroById]);

  // Use pre-calculated consumo_g_cab_dia from DB (no frontend calculation)
  const getConsumoForLanc = (l: Lancamento): number | null => {
    const val = Number(l.consumo_g_cab_dia ?? 0);
    return val > 0 ? val : null;
  };

  // Cab-dias from view (pre-calculated)
  const getCabDias = (l: Lancamento): number => Number(l.cab_dias ?? 0);

  // Filter by mes_referencia + ano_referencia (NOT created_at)
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter(l => {
      // Filter by mes_referencia and ano_referencia
      if (l.mes_referencia !== filtroMes || l.ano_referencia !== filtroAno) return false;

      const fazenda = getFazendaForLancamento(l);
      if (!fazenda) return false;
      if (filtroFazenda !== "all" && fazenda.id !== filtroFazenda) return false;
      if (filtroEstado !== "all" && fazenda.estado !== filtroEstado) return false;
      if (filtroCidade !== "all" && fazenda.cidade !== filtroCidade) return false;
      if (filtroProduto !== "all") {
        const effectiveProduto = getEffectiveProdutoId(l);
        if (effectiveProduto !== filtroProduto) return false;
      }
      if (filtroCategoria !== "all" && l.categoria !== filtroCategoria) return false;
      if (filtroSexo !== "all" && l.sexo !== filtroSexo) return false;
      return true;
    });
  }, [lancamentos, filtroFazenda, filtroEstado, filtroCidade, filtroProduto, filtroCategoria, filtroSexo, filtroMes, filtroAno, fazendaById, pastoById, retiroById]);

  // Unique filter options
  const estados = useMemo(() => [...new Set(fazendas.map(f => f.estado))].sort(), [fazendas]);
  const cidades = useMemo(() => {
    const filtered = filtroEstado !== "all" ? fazendas.filter(f => f.estado === filtroEstado) : fazendas;
    return [...new Set(filtered.map(f => f.cidade))].sort();
  }, [fazendas, filtroEstado]);
  const categorias = useMemo(() => [...new Set(lancamentos.map(l => l.categoria).filter(Boolean))].sort(), [lancamentos]);
  const sexos = useMemo(() => [...new Set(lancamentos.map(l => l.sexo).filter(Boolean))].sort(), [lancamentos]);

  // Products used in lancamentos (via pasto/retiro linkage)
  const produtosUtilizados = useMemo(() => {
    const usedIds = new Set<string>();
    lancamentos.forEach(l => {
      const pid = getEffectiveProdutoId(l);
      if (pid) usedIds.add(pid);
    });
    const allIds = new Set([...produtos.map(p => p.id), ...usedIds]);
    return produtos.filter(p => allIds.has(p.id));
  }, [lancamentos, produtos, pastoById, retiroById]);

  // Available years from lancamentos
  const anosDisponiveis = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    lancamentos.forEach(l => years.add(l.ano_referencia));
    return [...years].sort((a, b) => b - a);
  }, [lancamentos]);

  // ========= METRICS =========

  // Consumption from DB for each filtered lancamento (no frontend recalculation)
  const consumosPorLanc = useMemo(() => {
    return filteredLancamentos.map(l => ({
      lancamento: l,
      consumo: getConsumoForLanc(l),
    }));
  }, [filteredLancamentos]);

  // 1. Weighted average consumption (by num_animais — single source of truth)
  const consumoMedioReal = useMemo(() => {
    let weightedSum = 0;
    let totalAnimais = 0;
    for (const { lancamento: l } of consumosPorLanc) {
      const consumo = Number(l.consumo_g_cab_dia ?? 0);
      const animais = Number(l.num_animais ?? 0);
      if (consumo > 0 && animais > 0) {
        weightedSum += consumo * animais;
        totalAnimais += animais;
      }
    }
    if (totalAnimais <= 0) return 0;
    return weightedSum / totalAnimais; // g/cab/dia
  }, [consumosPorLanc]);

  // 2. Expected consumption (from product + average peso_medio) in g/cab/dia
  const consumoEsperado = useMemo(() => {
    if (filtroProduto === "all") return 0;
    const prod = produtoById[filtroProduto];
    if (!prod) return 0;
    const consumoPor100kg = prod.consumo_engorda ?? prod.consumo_recria1 ?? prod.consumo_recria2 ?? 0;
    const pesos = filteredLancamentos
      .map(l => l.peso_medio_kg ?? pastoById[l.pasto_id]?.peso_medio_kg ?? 0)
      .filter(w => w > 0);
    const pesoMedio = pesos.length > 0 ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 0;
    if (pesoMedio <= 0 || consumoPor100kg <= 0) return 0;
    return (consumoPor100kg * pesoMedio) / 100 * 1000;
  }, [filtroProduto, produtoById, filteredLancamentos, pastoById]);

  const indiceConsumo = consumoEsperado > 0 ? calcIndiceConsumo(consumoMedioReal, consumoEsperado) : 0;
  const desvioPercent = consumoEsperado > 0 ? ((consumoMedioReal - consumoEsperado) / consumoEsperado) * 100 : 0;
  const statusConsumo = getStatusColor(indiceConsumo, formulas.classificacao);

  // Lancamentos matching all filters EXCEPT mes/ano — used to compute real intervals
  // between consecutive salgas (intervals naturally span across months).
  const lancamentosParaIntervalo = useMemo(() => {
    return lancamentos.filter(l => {
      const fazenda = getFazendaForLancamento(l);
      if (!fazenda) return false;
      if (filtroFazenda !== "all" && fazenda.id !== filtroFazenda) return false;
      if (filtroEstado !== "all" && fazenda.estado !== filtroEstado) return false;
      if (filtroCidade !== "all" && fazenda.cidade !== filtroCidade) return false;
      if (filtroProduto !== "all") {
        const effectiveProduto = getEffectiveProdutoId(l);
        if (effectiveProduto !== filtroProduto) return false;
      }
      if (filtroCategoria !== "all" && l.categoria !== filtroCategoria) return false;
      if (filtroSexo !== "all" && l.sexo !== filtroSexo) return false;
      return true;
    });
  }, [lancamentos, filtroFazenda, filtroEstado, filtroCidade, filtroProduto, filtroCategoria, filtroSexo, fazendaById, pastoById, retiroById]);

  // Helper: compute diffs (in days) between consecutive salgas per pasto
  const computeIntervalDiffs = (lancs: Lancamento[]): number[] => {
    const byPasto: Record<string, number[]> = {};
    for (const l of lancs) {
      const t = new Date(l.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      (byPasto[l.pasto_id] ||= []).push(t);
    }
    const diffs: number[] = [];
    for (const times of Object.values(byPasto)) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const d = (times[i] - times[i - 1]) / 86400000;
        if (d > 0 && d <= 365) diffs.push(d);
      }
    }
    return diffs;
  };

  // 3. Average real interval between consecutive salgas (fallback: fazenda's intervalo_padrao_dias)
  const intervaloMedio = useMemo(() => {
    const diffs = computeIntervalDiffs(lancamentosParaIntervalo);
    if (diffs.length > 0) {
      return diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }
    // Fallback to configured fazenda interval (averaged across fazendas in scope)
    const scope = filtroFazenda !== "all"
      ? [fazendaById[filtroFazenda]].filter(Boolean) as Fazenda[]
      : fazendas.filter(f =>
          (filtroEstado === "all" || f.estado === filtroEstado) &&
          (filtroCidade === "all" || f.cidade === filtroCidade)
        );
    const vals = scope.map(f => Number(f.intervalo_padrao_dias ?? 0)).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [lancamentosParaIntervalo, fazendas, fazendaById, filtroFazenda, filtroEstado, filtroCidade]);

  // 4. Ranking by fazenda
  const rankingFazendas = useMemo(() => {
    const fazMap: Record<string, { nome: string; estado: string; weightedSum: number; totalAnimais: number; lancsParaIntervalo: Lancamento[]; count: number; intervaloPadrao: number }> = {};
    consumosPorLanc.forEach(({ lancamento: l }) => {
      const faz = getFazendaForLancamento(l);
      if (!faz) return;
      if (!fazMap[faz.id]) fazMap[faz.id] = { nome: faz.nome, estado: faz.estado, weightedSum: 0, totalAnimais: 0, lancsParaIntervalo: [], count: 0, intervaloPadrao: Number(faz.intervalo_padrao_dias ?? 0) };
      const consumo = Number(l.consumo_g_cab_dia ?? 0);
      const animais = Number(l.num_animais ?? 0);
      if (consumo > 0 && animais > 0) {
        fazMap[faz.id].weightedSum += consumo * animais;
        fazMap[faz.id].totalAnimais += animais;
        fazMap[faz.id].count += 1;
      }
    });
    // Collect interval lancamentos per fazenda from the broader (no-period) set
    lancamentosParaIntervalo.forEach(l => {
      const faz = getFazendaForLancamento(l);
      if (!faz || !fazMap[faz.id]) return;
      fazMap[faz.id].lancsParaIntervalo.push(l);
    });

    return Object.entries(fazMap).map(([id, data]) => {
      const avg = data.totalAnimais > 0 ? data.weightedSum / data.totalAnimais : 0;
      const diffs = computeIntervalDiffs(data.lancsParaIntervalo);
      const avgIntervalo = diffs.length
        ? diffs.reduce((a, b) => a + b, 0) / diffs.length
        : data.intervaloPadrao;
      const desvio = consumoEsperado > 0 ? Math.abs((avg - consumoEsperado) / consumoEsperado * 100) : 0;
      return { id, nome: data.nome, estado: data.estado, consumoMedio: avg, intervaloMedio: avgIntervalo, desvio, lancamentos: data.count };
    }).sort((a, b) => a.desvio - b.desvio);
  }, [consumosPorLanc, consumoEsperado, fazendaById, lancamentosParaIntervalo]);

  // 5. Consumption trend over time (weighted by cab-dias)
  const tendencia = useMemo(() => {
    const grouped: Record<string, { weightedSum: number; totalAnimais: number }> = {};
    consumosPorLanc.forEach(({ lancamento: l }) => {
      const consumo = Number(l.consumo_g_cab_dia ?? 0);
      const animais = Number(l.num_animais ?? 0);
      if (consumo <= 0 || animais <= 0) return;
      const key = `${l.ano_referencia}-${String(l.mes_referencia).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = { weightedSum: 0, totalAnimais: 0 };
      grouped[key].weightedSum += consumo * animais;
      grouped[key].totalAnimais += animais;
    });
    return Object.entries(grouped)
      .map(([periodo, v]) => ({ periodo, consumo: v.totalAnimais > 0 ? Math.round((v.weightedSum / v.totalAnimais) * 100) / 100 : 0 }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [consumosPorLanc]);

  // ===== COMPARAÇÃO DE 2 FAZENDAS (somente quando "Comparar com" está ativo) =====
  const fazendaANome = fazendaById[filtroFazenda]?.nome ?? "Fazenda A";
  const fazendaBNome = fazendaById[filtroComparar]?.nome ?? "Fazenda B";

  // Lançamentos de uma fazenda no ano do filtro (demais filtros mantidos, exceto fazenda/mês)
  const lancsDaFazenda = useCallback((fid: string) => {
    return lancamentos.filter(l => {
      if (l.fazenda_id !== fid) return false;
      if (l.ano_referencia !== filtroAno) return false;
      if (filtroProduto !== "all" && getEffectiveProdutoId(l) !== filtroProduto) return false;
      if (filtroCategoria !== "all" && l.categoria !== filtroCategoria) return false;
      if (filtroSexo !== "all" && l.sexo !== filtroSexo) return false;
      return true;
    });
  }, [lancamentos, filtroAno, filtroProduto, filtroCategoria, filtroSexo, getEffectiveProdutoId]);

  const mediaPonderada = (lancs: Lancamento[]) => {
    let ws = 0, tot = 0;
    for (const l of lancs) {
      const c = Number(l.consumo_g_cab_dia ?? 0);
      const a = Number(l.num_animais ?? 0);
      if (c > 0 && a > 0) { ws += c * a; tot += a; }
    }
    return tot > 0 ? Math.round((ws / tot) * 100) / 100 : 0;
  };

  const tendenciaComparacao = useMemo(() => {
    if (!comparando) return [] as { periodo: string; a: number; b: number }[];
    const la = lancsDaFazenda(filtroFazenda);
    const lb = lancsDaFazenda(filtroComparar);
    const periodos = [...new Set([...la, ...lb].map(l => `${l.ano_referencia}-${String(l.mes_referencia).padStart(2, "0")}`))].sort();
    return periodos.map(p => {
      const mes = Number(p.slice(5));
      return {
        periodo: p,
        a: mediaPonderada(la.filter(l => l.mes_referencia === mes)),
        b: mediaPonderada(lb.filter(l => l.mes_referencia === mes)),
      };
    });
  }, [comparando, filtroFazenda, filtroComparar, lancsDaFazenda]);

  const categoriasComparacao = useMemo(() => {
    if (!comparando) return [] as { categoria: string; a: number; b: number }[];
    const cats = ["Recria 1", "Recria 2", "Engorda"];
    const doMes = (fid: string) => lancsDaFazenda(fid).filter(l => l.mes_referencia === filtroMes);
    const la = doMes(filtroFazenda);
    const lb = doMes(filtroComparar);
    const catOf = (l: Lancamento) =>
      l.categoria || classificarCategoria(Number(l.peso_medio_kg ?? pastoById[l.pasto_id]?.peso_medio_kg ?? 0));
    return cats.map(c => ({
      categoria: c,
      a: mediaPonderada(la.filter(l => catOf(l) === c)),
      b: mediaPonderada(lb.filter(l => catOf(l) === c)),
    }));
  }, [comparando, filtroFazenda, filtroComparar, filtroMes, lancsDaFazenda, pastoById]);



  // 6. Alerts
  const alertas = useMemo(() => {
    const msgs: { tipo: "warning" | "info"; texto: string }[] = [];
    rankingFazendas.forEach(f => {
      if (f.desvio > 30 && f.consumoMedio < consumoEsperado) {
        msgs.push({ tipo: "warning", texto: `Fazenda ${f.nome} está ${f.desvio.toFixed(0)}% abaixo do consumo ideal` });
      }
      if (f.desvio > 30 && f.consumoMedio > consumoEsperado) {
        msgs.push({ tipo: "info", texto: `Fazenda ${f.nome} está ${f.desvio.toFixed(0)}% acima da média — possível desperdício` });
      }
    });
    if (filtroProduto !== "all") {
      const prod = produtoById[filtroProduto];
      if (prod && consumoMedioReal > 0 && consumoEsperado > 0 && Math.abs(desvioPercent) > 20) {
        msgs.push({ tipo: "warning", texto: `Produto ${prod.nome} apresenta consumo ${desvioPercent > 0 ? "acima" : "abaixo"} da média regional` });
      }
    }
    return msgs;
  }, [rankingFazendas, consumoEsperado, consumoMedioReal, desvioPercent, filtroProduto, produtoById]);

  // 7. Map: consumption by estado
  const consumoPorEstado = useMemo(() => {
    const map: Record<string, { weightedSum: number; totalAnimais: number }> = {};
    consumosPorLanc.forEach(({ lancamento: l }) => {
      const faz = getFazendaForLancamento(l);
      const consumo = Number(l.consumo_g_cab_dia ?? 0);
      const animais = Number(l.num_animais ?? 0);
      if (!faz || consumo <= 0 || animais <= 0) return;
      if (!map[faz.estado]) map[faz.estado] = { weightedSum: 0, totalAnimais: 0 };
      map[faz.estado].weightedSum += consumo * animais;
      map[faz.estado].totalAnimais += animais;
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([estado, v]) => { result[estado] = v.totalAnimais > 0 ? v.weightedSum / v.totalAnimais : 0; });
    return result;
  }, [consumosPorLanc, fazendaById]);

  const mediaGeral = useMemo(() => {
    const vals = Object.values(consumoPorEstado);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [consumoPorEstado]);

  // 8. Fazendas for selected estado on map
  const fazendasDoEstado = useMemo(() => {
    if (!selectedEstado) return [];
    return rankingFazendas.filter(f => f.estado === selectedEstado);
  }, [selectedEstado, rankingFazendas]);

  // 9. Product analysis
  const analisesProduto = useMemo(() => {
    if (filtroProduto === "all") return [];
    return rankingFazendas;
  }, [filtroProduto, rankingFazendas]);

  // 10. Category metrics for PDF export
  const CATEGORIAS_PDF = ["Recria 1", "Recria 2", "Engorda"] as const;
  const metricasCategoria = useMemo((): CatMetricsPDF[] => {
    const catMap: Record<string, { weightedSum: number; totalAnimais: number; sacos: number; custoTotal: number; gmds: number[]; diasTotal: number }> = {};
    CATEGORIAS_PDF.forEach(c => { catMap[c] = { weightedSum: 0, totalAnimais: 0, sacos: 0, custoTotal: 0, gmds: [], diasTotal: 0 }; });

    filteredLancamentos.forEach(l => {
      const pesoMedio = l.peso_medio_kg ?? pastoById[l.pasto_id]?.peso_medio_kg ?? 0;
      const cat = l.categoria || classificarCategoria(pesoMedio);
      if (!catMap[cat]) return;
      const entry = catMap[cat];
      const animais = Number(l.num_animais ?? 0);
      entry.totalAnimais += animais;
      entry.sacos += l.num_sacos;
      entry.diasTotal += l.dias_no_pasto;
      // Weighted sum for consumption average
      const consumo = Number(l.consumo_g_cab_dia ?? 0);
      if (consumo > 0 && animais > 0) {
        entry.weightedSum += consumo * animais;
      }
      // Cost: use total_sal_kg * preco_por_kg from view
      const sal = Number(l.total_sal_kg ?? 0);
      const preco = Number(l.preco_por_kg ?? 0);
      if (sal > 0 && preco > 0) {
        entry.custoTotal += sal * preco;
      }
      const pasto = pastoById[l.pasto_id];
      if (pasto?.gmd_kg_dia && pasto.gmd_kg_dia > 0) entry.gmds.push(pasto.gmd_kg_dia);
    });

    return CATEGORIAS_PDF.map(cat => {
      const e = catMap[cat];
      const consumoMedio = e.totalAnimais > 0 ? e.weightedSum / e.totalAnimais : 0;
      const gmd = e.gmds.length > 0 ? e.gmds.reduce((a, b) => a + b, 0) / e.gmds.length : 0;
      const custoMedio = e.totalAnimais > 0 ? e.custoTotal / e.totalAnimais : 0;
      const avgDias = e.sacos > 0 ? e.diasTotal / e.sacos : 30;
      const kgGanho = e.totalAnimais > 0 && gmd > 0 ? e.totalAnimais * gmd * avgDias : 0;
      const custoPorKgGanho = kgGanho > 0 ? e.custoTotal / kgGanho : 0;
      return { categoria: cat, consumoMedio, totalAnimais: e.totalAnimais, totalSacos: e.sacos, custoMedio, custoPorKgGanho, gmd, custoTotal: e.custoTotal };
    });
  }, [filteredLancamentos, pastoById]);

  const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      const filtros: { label: string; valor: string }[] = [];
      if (filtroFazenda !== "all") filtros.push({ label: "Fazenda", valor: fazendaById[filtroFazenda]?.nome ?? filtroFazenda });
      if (filtroEstado !== "all") filtros.push({ label: "Estado", valor: filtroEstado });
      if (filtroCidade !== "all") filtros.push({ label: "Cidade", valor: filtroCidade });
      if (filtroProduto !== "all") filtros.push({ label: "Produto", valor: produtoById[filtroProduto]?.nome ?? filtroProduto });
      if (filtroCategoria !== "all") filtros.push({ label: "Categoria", valor: filtroCategoria });
      if (filtroSexo !== "all") filtros.push({ label: "Sexo", valor: filtroSexo });

      const categoriasExibidas = filtroCategoria === "all" ? metricasCategoria : metricasCategoria.filter(m => m.categoria === filtroCategoria);

      const pdfData: PainelPDFData = {
        fazendaNome: filtroFazenda !== "all" ? (fazendaById[filtroFazenda]?.nome ?? "Fazenda") : "Todas as Fazendas",
        periodo: `${MESES_NOMES[filtroMes - 1]} ${filtroAno}`,
        dataGeracao: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        filtros,
        consumoMedioReal,
        consumoEsperado,
        desvioPercent,
        intervaloMedio,
        painelConsumoReal: filtroFazenda !== "all" ? painelMae.consumo_real_g_cab_dia : null,
        painelConsumoGlobal: filtroFazenda !== "all" ? painelMae.consumo_global_g_cab_dia : null,
        painelEficiencia: filtroFazenda !== "all" ? painelMae.eficiencia : null,
        painelPesoMedio: filtroFazenda !== "all" ? painelMae.peso_medio_kg : null,
        alertas,
        metricas: categoriasExibidas,
        tendencia,
        ranking: rankingFazendas.map(f => ({
          nome: f.nome, estado: f.estado, consumoMedio: f.consumoMedio,
          desvio: f.desvio, intervaloMedio: f.intervaloMedio, lancamentos: f.lancamentos,
        })),
      };

      const blob = await pdf(<PainelInteligenciaPDF data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `painel_inteligencia_${MESES_NOMES[filtroMes - 1].toLowerCase()}_${filtroAno}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setExportingPDF(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Painel de Inteligência Nutricional</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Painel de Inteligência Nutricional – CONSUBOV</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise comparativa e insights automáticos</p>
        </div>
        <Button onClick={handleExportPDF} disabled={exportingPDF} className="gap-1.5">
          {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar em PDF
        </Button>
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fazenda</label>
              <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Comparar com</label>
              <Select value={filtroComparar} onValueChange={setFiltroComparar} disabled={filtroFazenda === "all"}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {fazendas.filter(f => f.id !== filtroFazenda).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
              <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); setFiltroCidade("all"); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {estados.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
              <Select value={filtroCidade} onValueChange={setFiltroCidade}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Produto</label>
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {produtosUtilizados.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categorias.map(c => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sexo</label>
              <Select value={filtroSexo} onValueChange={setFiltroSexo}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sexos.map(s => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
              <Select value={String(filtroMes)} onValueChange={(v) => setFiltroMes(Number(v))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
              <Select value={String(filtroAno)} onValueChange={(v) => setFiltroAno(Number(v))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ALERTS */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <Alert key={i} variant={a.tipo === "warning" ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{a.tipo === "warning" ? "Alerta" : "Informação"}</AlertTitle>
              <AlertDescription className="text-sm">{a.texto}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Consumo Real Médio</CardTitle>
              <Activity className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{consumoMedioReal.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">g/cab/dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Consumo Esperado</CardTitle>
              <BarChart3 className="w-4 h-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{consumoEsperado > 0 ? consumoEsperado.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">{filtroProduto === "all" ? "Selecione um produto" : "g/cab/dia"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Desvio</CardTitle>
              {desvioPercent > 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${statusConsumo.color}`}>
              {consumoEsperado > 0 ? `${desvioPercent > 0 ? "+" : ""}${desvioPercent.toFixed(1)}%` : "—"}
            </p>
            {consumoEsperado > 0 && (
              <p className="text-xs text-muted-foreground">{statusConsumo.emoji} {statusConsumo.label}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Intervalo Médio</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{intervaloMedio > 0 ? intervaloMedio.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">dias entre salgas</p>
          </CardContent>
        </Card>
      </div>

      {/* PAINEL MÃE — Consumo Real / Global / Eficiência / Peso Médio */}
      {comparando ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { nome: fazendaANome, dados: painelMae, accent: "text-primary", border: "border-l-4 border-l-primary" },
            { nome: fazendaBNome, dados: painelMaeB, accent: "text-secondary", border: "border-l-4 border-l-secondary" },
          ].map((bloco) => (
            <Card key={bloco.nome} className={bloco.border}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className={`text-sm font-semibold ${bloco.accent}`}>{bloco.nome}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Consumo Real</p>
                  <p className="text-2xl font-bold text-foreground">{bloco.dados.consumo_real_g_cab_dia.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">g/cab/dia</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consumo Global</p>
                  <p className="text-2xl font-bold text-foreground">{bloco.dados.consumo_global_g_cab_dia.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">g/cab/dia</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Eficiência</p>
                  <p className="text-2xl font-bold text-foreground">{bloco.dados.eficiencia.toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground">índice</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso Médio</p>
                  <p className="text-2xl font-bold text-foreground">{bloco.dados.peso_medio_kg.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">kg</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Consumo Real</CardTitle>
                <Activity className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">
                {filtroFazenda !== "all" ? painelMae.consumo_real_g_cab_dia.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">{filtroFazenda !== "all" ? "g/cab/dia" : "Selecione uma fazenda"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Consumo Global</CardTitle>
                <Gauge className="w-4 h-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">
                {filtroFazenda !== "all" ? painelMae.consumo_global_g_cab_dia.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">{filtroFazenda !== "all" ? "g/cab/dia" : "Selecione uma fazenda"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Peso Médio</CardTitle>
                <Scale className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">
                {filtroFazenda !== "all" ? painelMae.peso_medio_kg.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">{filtroFazenda !== "all" ? "kg" : "Selecione uma fazenda"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TREND CHART */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendência de Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparando ? (
            tendenciaComparacao.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={tendenciaComparacao}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(1)} g/cab/dia`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="a" name={fazendaANome} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="b" name={fazendaBNome} stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
            )
          ) : tendencia.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tendencia}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} g/cab/dia`, "Consumo"]} />
                <Line type="monotone" dataKey="consumo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                {consumoEsperado > 0 && (
                  <Line type="monotone" dataKey={() => consumoEsperado} stroke="hsl(var(--secondary))" strokeWidth={1} strokeDasharray="5 5" name="Esperado" dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* BRAZIL MAP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Mapa de Consumo por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 720 620" className="w-full h-auto">
              <rect width="720" height="620" fill="transparent" />
              {Object.entries(ESTADOS_BR).map(([uf, pos]) => {
                const consumo = consumoPorEstado[uf] || 0;
                const fillColor = consumo > 0 ? getMapColor(consumo, mediaGeral) : "hsl(var(--muted))";
                const isSelected = selectedEstado === uf;
                const hasData = consumo > 0;
                return (
                  <g key={uf} onClick={() => hasData && setSelectedEstado(isSelected ? null : uf)} className={hasData ? "cursor-pointer" : ""}>
                    <circle
                      cx={pos.x} cy={pos.y} r={isSelected ? 24 : 18}
                      fill={fillColor}
                      stroke={isSelected ? "hsl(var(--foreground))" : "hsl(var(--border))"}
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={hasData ? 0.9 : 0.3}
                    />
                    <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold fill-foreground select-none" style={{ fontSize: 10 }}>
                      {uf}
                    </text>
                    {hasData && (
                      <text x={pos.x} y={pos.y + 30} textAnchor="middle" className="text-[8px] fill-muted-foreground select-none" style={{ fontSize: 8 }}>
                        {consumo.toFixed(0)}g
                      </text>
                    )}
                  </g>
                );
              })}
              <g transform="translate(10, 580)">
                <circle cx={10} cy={0} r={6} fill="#ef4444" /><text x={22} y={4} style={{ fontSize: 9 }} className="fill-muted-foreground">Baixo</text>
                <circle cx={70} cy={0} r={6} fill="#eab308" /><text x={82} y={4} style={{ fontSize: 9 }} className="fill-muted-foreground">Médio</text>
                <circle cx={130} cy={0} r={6} fill="#22c55e" /><text x={142} y={4} style={{ fontSize: 9 }} className="fill-muted-foreground">Alto</text>
              </g>
            </svg>

            {selectedEstado && (
              <div className="mt-4 border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">Fazendas em {selectedEstado}</h4>
                {fazendasDoEstado.length > 0 ? (
                  <div className="space-y-1">
                    {fazendasDoEstado.map(f => (
                      <div key={f.id} className="flex justify-between text-sm py-1 border-b border-border/50">
                        <span>{f.nome}</span>
                        <span className="font-medium">{f.consumoMedio.toFixed(1)} g/cab/dia</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum dado para este estado.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRODUCT ANALYSIS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-secondary" />
              Análise por Produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtroProduto !== "all" ? (
              <>
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">{produtoById[filtroProduto]?.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">Consumo médio geral: <strong>{consumoMedioReal.toFixed(1)} g/cab/dia</strong></p>
                </div>
                {analisesProduto.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analisesProduto.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)} g/cab/dia`, "Consumo"]} />
                      <Bar dataKey="consumoMedio" radius={[0, 4, 4, 0]}>
                        {analisesProduto.slice(0, 10).map((entry, i) => (
                          <Cell key={i} fill={consumoEsperado > 0 ? getMapColor(entry.consumoMedio, consumoEsperado) : "hsl(var(--primary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma fazenda utiliza este produto.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Selecione um produto no filtro acima para ver a análise.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CONSUMO POR CATEGORIA — COMPARAÇÃO ENTRE FAZENDAS */}
      {comparando && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              Consumo por Categoria — Comparação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoriasComparacao.some(c => c.a > 0 || c.b > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoriasComparacao}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(1)} g/cab/dia`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="a" name={fazendaANome} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="b" name={fazendaBNome} fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* MÉTRICAS POR CATEGORIA ANIMAL */}
      <MetricasPorCategoria
        filteredLancamentos={filteredLancamentos}
        consumosPorLanc={consumosPorLanc}
        pastoById={pastoById}
        retiroById={retiroById}
        produtoById={produtoById}
        filtroCategoria={filtroCategoria}
        getEffectiveProdutoId={getEffectiveProdutoId}
      />

      {/* RANKING TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Eficiência por Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          {rankingFazendas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Fazenda</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Consumo Médio</TableHead>
                    <TableHead className="text-xs">Desvio</TableHead>
                    <TableHead className="text-xs">Intervalo Médio</TableHead>
                    <TableHead className="text-xs">Lançamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingFazendas.map((f, i) => {
                    const idx = consumoEsperado > 0 ? f.consumoMedio / consumoEsperado : 0;
                    const st = consumoEsperado > 0
                      ? getStatusColor(idx, formulas.classificacao)
                      : { emoji: "", color: "", label: "" };
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-bold text-sm">{i + 1}º</TableCell>
                        <TableCell className="font-medium text-sm">{f.nome}</TableCell>
                        <TableCell className="text-sm">{f.estado}</TableCell>
                        <TableCell className="text-sm">{f.consumoMedio.toFixed(1)} g/cab/dia</TableCell>
                        <TableCell className="text-sm">
                          {consumoEsperado > 0 ? (
                            <Badge variant="outline" className={st.color}>{st.emoji} {f.desvio.toFixed(0)}%</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{f.intervaloMedio.toFixed(1)} dias</TableCell>
                        <TableCell className="text-sm">{f.lancamentos}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
