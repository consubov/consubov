import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, TrendingDown, TrendingUp, Activity, BarChart3, MapPin, Package, Users } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from "recharts";

interface Fazenda { id: string; nome: string; cidade: string; estado: string; }
interface Retiro { id: string; nome: string; fazenda_id: string; produto_id: string | null; }
interface Pasto { id: string; nome: string; retiro_id: string; num_animais: number; peso_medio_kg: number | null; categoria: string | null; sexo: string | null; produto_id: string | null; }
interface Produto { id: string; nome: string; peso_saco_kg: number; consumo_engorda: number | null; consumo_recria1: number | null; consumo_recria2: number | null; }
interface Lancamento {
  id: string; pasto_id: string; ciclo_id: string; num_sacos: number; num_animais: number;
  lancado_em: string | null; produto_id: string | null; consumo_g_cab_dia: number | null;
  consumo_esperado_kg: number | null; consumo_real_kg: number | null; dias_intervalo: number | null;
  categoria: string | null; sexo: string | null;
}
interface Ciclo { id: string; fazenda_id: string; mes: number; ano: number; num_dias: number; }

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

function getStatusColor(desvio: number): { color: string; label: string; emoji: string } {
  if (desvio < -15) return { color: "text-red-500", label: "Abaixo do ideal", emoji: "🔴" };
  if (desvio > 15) return { color: "text-green-600", label: "Acima (possível desperdício)", emoji: "🟢" };
  return { color: "text-yellow-500", label: "Dentro do padrão", emoji: "🟡" };
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
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroFazenda, setFiltroFazenda] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroSexo, setFiltroSexo] = useState("all");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1); // 1-12
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [fRes, rRes, pRes, prRes, lRes, cRes] = await Promise.all([
        supabase.from("fazendas").select("id, nome, cidade, estado").eq("ativo", true),
        supabase.from("retiros").select("id, nome, fazenda_id, produto_id").eq("ativo", true),
        supabase.from("pastos").select("id, nome, retiro_id, num_animais, peso_medio_kg, categoria, sexo, produto_id").eq("ativo", true),
        supabase.from("produtos").select("id, nome, peso_saco_kg, consumo_engorda, consumo_recria1, consumo_recria2").eq("ativo", true),
        supabase.from("lancamentos").select("id, pasto_id, ciclo_id, num_sacos, num_animais, lancado_em, produto_id, consumo_g_cab_dia, consumo_esperado_kg, consumo_real_kg, dias_intervalo, categoria, sexo").order("lancado_em", { ascending: false }),
        supabase.from("ciclos").select("id, fazenda_id, mes, ano, num_dias"),
      ]);
      setFazendas(fRes.data ?? []);
      setRetiros(rRes.data ?? []);
      setPastos(pRes.data ?? []);
      setProdutos(prRes.data ?? []);
      setLancamentos(lRes.data ?? []);
      setCiclos(cRes.data ?? []);
      setLoading(false);
    }
    load();

    // Real-time subscription
    const channel = supabase.channel("inteligencia-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => {
        supabase.from("lancamentos").select("id, pasto_id, ciclo_id, num_sacos, num_animais, lancado_em, produto_id, consumo_g_cab_dia, consumo_esperado_kg, consumo_real_kg, dias_intervalo, categoria, sexo").order("lancado_em", { ascending: false }).then(({ data }) => {
          if (data) setLancamentos(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Lookup helpers
  const retiroByPasto = useMemo(() => {
    const map: Record<string, Retiro> = {};
    pastos.forEach(p => { const r = retiros.find(r => r.id === p.retiro_id); if (r) map[p.id] = r; });
    return map;
  }, [pastos, retiros]);

  const fazendaByRetiro = useMemo(() => {
    const map: Record<string, Fazenda> = {};
    retiros.forEach(r => { const f = fazendas.find(f => f.id === r.fazenda_id); if (f) map[r.id] = f; });
    return map;
  }, [retiros, fazendas]);

  const getFazendaForLancamento = (l: Lancamento): Fazenda | undefined => {
    const retiro = retiroByPasto[l.pasto_id];
    if (!retiro) return undefined;
    return fazendaByRetiro[retiro.id];
  };

  // Filtered lancamentos
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter(l => {
      const fazenda = getFazendaForLancamento(l);
      if (!fazenda) return false;
      if (filtroFazenda !== "all" && fazenda.id !== filtroFazenda) return false;
      if (filtroEstado !== "all" && fazenda.estado !== filtroEstado) return false;
      if (filtroCidade !== "all" && fazenda.cidade !== filtroCidade) return false;
      if (filtroProduto !== "all" && l.produto_id !== filtroProduto) return false;
      if (filtroCategoria !== "all" && l.categoria !== filtroCategoria) return false;
      if (filtroSexo !== "all" && l.sexo !== filtroSexo) return false;
      return true;
    });
  }, [lancamentos, filtroFazenda, filtroEstado, filtroCidade, filtroProduto, filtroCategoria, filtroSexo, retiroByPasto, fazendaByRetiro]);

  // Unique filter options
  const estados = useMemo(() => [...new Set(fazendas.map(f => f.estado))].sort(), [fazendas]);
  const cidades = useMemo(() => {
    const filtered = filtroEstado !== "all" ? fazendas.filter(f => f.estado === filtroEstado) : fazendas;
    return [...new Set(filtered.map(f => f.cidade))].sort();
  }, [fazendas, filtroEstado]);
  const categorias = useMemo(() => [...new Set(lancamentos.map(l => l.categoria).filter(Boolean))].sort(), [lancamentos]);
  const sexos = useMemo(() => [...new Set(lancamentos.map(l => l.sexo).filter(Boolean))].sort(), [lancamentos]);

  // ========= METRICS =========

  // 1. Average consumption
  const consumoMedioReal = useMemo(() => {
    const vals = filteredLancamentos.filter(l => l.consumo_g_cab_dia && l.consumo_g_cab_dia > 0).map(l => l.consumo_g_cab_dia!);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [filteredLancamentos]);

  // 2. Expected consumption (from product)
  const consumoEsperado = useMemo(() => {
    if (filtroProduto === "all") return 0;
    const prod = produtos.find(p => p.id === filtroProduto);
    if (!prod) return 0;
    return prod.consumo_engorda ?? prod.consumo_recria1 ?? prod.consumo_recria2 ?? 0;
  }, [filtroProduto, produtos]);

  const desvioPercent = consumoEsperado > 0 ? ((consumoMedioReal - consumoEsperado) / consumoEsperado) * 100 : 0;
  const statusConsumo = getStatusColor(desvioPercent);

  // 3. Average interval between "salgas"
  const intervaloMedio = useMemo(() => {
    const vals = filteredLancamentos.filter(l => l.dias_intervalo && l.dias_intervalo > 0).map(l => l.dias_intervalo!);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [filteredLancamentos]);

  // 4. Ranking by fazenda
  const rankingFazendas = useMemo(() => {
    const fazMap: Record<string, { nome: string; estado: string; consumos: number[]; intervalos: number[] }> = {};
    filteredLancamentos.forEach(l => {
      const faz = getFazendaForLancamento(l);
      if (!faz) return;
      if (!fazMap[faz.id]) fazMap[faz.id] = { nome: faz.nome, estado: faz.estado, consumos: [], intervalos: [] };
      if (l.consumo_g_cab_dia && l.consumo_g_cab_dia > 0) fazMap[faz.id].consumos.push(l.consumo_g_cab_dia);
      if (l.dias_intervalo && l.dias_intervalo > 0) fazMap[faz.id].intervalos.push(l.dias_intervalo);
    });

    return Object.entries(fazMap).map(([id, data]) => {
      const avg = data.consumos.length ? data.consumos.reduce((a, b) => a + b, 0) / data.consumos.length : 0;
      const avgIntervalo = data.intervalos.length ? data.intervalos.reduce((a, b) => a + b, 0) / data.intervalos.length : 0;
      const desvio = consumoEsperado > 0 ? Math.abs((avg - consumoEsperado) / consumoEsperado * 100) : 0;
      return { id, nome: data.nome, estado: data.estado, consumoMedio: avg, intervaloMedio: avgIntervalo, desvio, lancamentos: data.consumos.length };
    }).sort((a, b) => a.desvio - b.desvio);
  }, [filteredLancamentos, consumoEsperado]);

  // 5. Consumption trend over time
  const tendencia = useMemo(() => {
    const grouped: Record<string, { sum: number; count: number }> = {};
    filteredLancamentos.forEach(l => {
      if (!l.lancado_em || !l.consumo_g_cab_dia) return;
      const d = new Date(l.lancado_em);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
      grouped[key].sum += l.consumo_g_cab_dia;
      grouped[key].count += 1;
    });
    return Object.entries(grouped)
      .map(([periodo, v]) => ({ periodo, consumo: Math.round(v.sum / v.count * 100) / 100 }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [filteredLancamentos, filtroPeriodo]);

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
      const prod = produtos.find(p => p.id === filtroProduto);
      if (prod && consumoMedioReal > 0 && consumoEsperado > 0 && Math.abs(desvioPercent) > 20) {
        msgs.push({ tipo: "warning", texto: `Produto ${prod.nome} apresenta consumo ${desvioPercent > 0 ? "acima" : "abaixo"} da média regional` });
      }
    }
    return msgs;
  }, [rankingFazendas, consumoEsperado, consumoMedioReal, desvioPercent, filtroProduto, produtos]);

  // 7. Map: consumption by estado
  const consumoPorEstado = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filteredLancamentos.forEach(l => {
      const faz = getFazendaForLancamento(l);
      if (!faz || !l.consumo_g_cab_dia) return;
      if (!map[faz.estado]) map[faz.estado] = { sum: 0, count: 0 };
      map[faz.estado].sum += l.consumo_g_cab_dia;
      map[faz.estado].count += 1;
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([estado, v]) => { result[estado] = v.sum / v.count; });
    return result;
  }, [filteredLancamentos]);

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

  // 9. Product analysis - fazendas using selected product
  const analisesProduto = useMemo(() => {
    if (filtroProduto === "all") return [];
    return rankingFazendas;
  }, [filtroProduto, rankingFazendas]);

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
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Painel de Inteligência Nutricional – CONSUBOV</h1>
        <p className="text-sm text-muted-foreground mt-1">Análise comparativa e insights automáticos</p>
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
                  {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
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

      {/* TREND CHART */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendência de Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tendencia.length > 0 ? (
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
              {/* Legend */}
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
                  <p className="text-sm font-medium">{produtos.find(p => p.id === filtroProduto)?.nome}</p>
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
                    const st = consumoEsperado > 0
                      ? getStatusColor(((f.consumoMedio - consumoEsperado) / consumoEsperado) * 100)
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
