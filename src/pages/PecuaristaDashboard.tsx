import { useEffect, useMemo, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Warehouse, MapPin, TrendingUp, Users, Scale, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const CATEGORIAS_PADRAO: Record<string, string> = {
  boi_gordo: "Boi Gordo", vaca_gorda: "Vaca Gorda", vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro", garrote: "Garrote", novilha: "Novilha",
  bezerro: "Bezerro", bezerra: "Bezerra",
};

const MESES = [
  { v: 1, l: "Janeiro" }, { v: 2, l: "Fevereiro" }, { v: 3, l: "Março" },
  { v: 4, l: "Abril" }, { v: 5, l: "Maio" }, { v: 6, l: "Junho" },
  { v: 7, l: "Julho" }, { v: 8, l: "Agosto" }, { v: 9, l: "Setembro" },
  { v: 10, l: "Outubro" }, { v: 11, l: "Novembro" }, { v: 12, l: "Dezembro" },
];

const PIE_COLORS = ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#D4A017", "#E9C46A", "#B8860B", "#8B5E00", "#95D5B2", "#B7E4C7"];

type Lote = {
  id: string; fazenda_id: string; categoria: string;
  categoria_customizada_id: string | null; status: string; identificado: boolean;
};
type Pesagem = {
  id: string; lote_id: string; data_pesagem: string;
  quantidade_animais: number; gmd: number | null;
};

export default function PecuaristaDashboard() {
  const { nome } = useOutletContext<{ nome: string }>() ?? { nome: "" };
  const location = useLocation();
  const isLotes = location.pathname.endsWith("/lotes");

  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  const now = new Date();
  const [pecuaristaId, setPecuaristaId] = useState<string>("");
  const [fazendas, setFazendas] = useState<Array<{ id: string; nome_fazenda: string }>>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [pesosByPesagem, setPesosByPesagem] = useState<Record<string, Array<{ gmd_individual: number | null }>>>({});
  const [customCats, setCustomCats] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fFazenda, setFFazenda] = useState<string>("all");
  const [fAno, setFAno] = useState<number>(now.getFullYear());
  const [fMes, setFMes] = useState<string>("all"); // "all" ou 1..12
  const [aFazenda, setAFazenda] = useState<string>("all");
  const [aAno, setAAno] = useState<number>(now.getFullYear());
  const [aMes, setAMes] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: p } = await supabase.from("pecuaristas").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) { setLoading(false); return; }
      const pid = (p as any).id as string;
      setPecuaristaId(pid);

      const [fz, lts, cats] = await Promise.all([
        supabase.from("fazendas_pecuarista").select("id, nome_fazenda").eq("pecuarista_id", pid).order("nome_fazenda"),
        supabase.from("lotes_pecuarista").select("id, fazenda_id, categoria, categoria_customizada_id, status, identificado").eq("pecuarista_id", pid),
        supabase.from("categorias_pecuarista").select("id, nome").eq("pecuarista_id", pid),
      ]);
      setFazendas((fz.data ?? []) as any);
      setLotes(((lts.data ?? []) as any) as Lote[]);
      const cmap: Record<string, string> = {};
      (cats.data ?? []).forEach((c: any) => { cmap[c.id] = c.nome; });
      setCustomCats(cmap);

      const loteIds = (lts.data ?? []).map((l: any) => l.id);
      if (loteIds.length > 0) {
        const { data: pesRows } = await supabase
          .from("pesagens_lote_pecuarista")
          .select("id, lote_id, data_pesagem, quantidade_animais, gmd")
          .in("lote_id", loteIds)
          .order("data_pesagem", { ascending: false });
        const pes = ((pesRows ?? []) as any) as Pesagem[];
        setPesagens(pes);

        const pesIds = pes.map(p => p.id);
        if (pesIds.length > 0) {
          const { data: pesos } = await supabase
            .from("pesos_animais_pecuarista")
            .select("pesagem_lote_id, gmd_individual")
            .in("pesagem_lote_id", pesIds);
          const grp: Record<string, Array<{ gmd_individual: number | null }>> = {};
          (pesos ?? []).forEach((r: any) => {
            (grp[r.pesagem_lote_id] ??= []).push({ gmd_individual: r.gmd_individual });
          });
          setPesosByPesagem(grp);
        }
      }
      setLoading(false);
    })();
  }, []);

  const loteById = useMemo(() => {
    const m: Record<string, Lote> = {};
    lotes.forEach(l => { m[l.id] = l; });
    return m;
  }, [lotes]);

  const catLabel = (l: Lote | undefined): string => {
    if (!l) return "—";
    if (l.categoria === "customizada" && l.categoria_customizada_id) {
      return customCats[l.categoria_customizada_id] ?? "Personalizada";
    }
    return CATEGORIAS_PADRAO[l.categoria] ?? l.categoria;
  };

  // GMD de uma pesagem: média dos gmd_individual (identificado) ou p.gmd (não identificado)
  const gmdDaPesagem = (p: Pesagem): number | null => {
    const lote = loteById[p.lote_id];
    if (lote?.identificado) {
      const arr = (pesosByPesagem[p.id] ?? []).filter(x => x.gmd_individual != null);
      if (arr.length === 0) return p.gmd != null ? Number(p.gmd) : null;
      const soma = arr.reduce((s, x) => s + Number(x.gmd_individual), 0);
      return soma / arr.length;
    }
    return p.gmd != null ? Number(p.gmd) : null;
  };

  // Helper: última pesagem por lote dentro de um subconjunto (com GMD válido)
  const ultimaGmdPorLote = (pesagensSubset: Pesagem[]): Map<string, number> => {
    // pesagens já vêm ordenadas desc por data_pesagem → o primeiro match por lote é o mais recente
    const map = new Map<string, number>();
    for (const p of pesagensSubset) {
      if (map.has(p.lote_id)) continue;
      const g = gmdDaPesagem(p);
      if (g == null) continue;
      map.set(p.lote_id, g);
    }
    return map;
  };

  // KPIs (não usam filtros; refletem o rebanho atual e o mês corrente)
  const kpis = useMemo(() => {
    const lotesAtivos = lotes.filter(l => l.status === "ativo");
    const lotesAtivosIds = new Set(lotesAtivos.map(l => l.id));
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    // GMD médio (mês) = média SIMPLES entre lotes ativos com pesagem válida no mês
    const pesagensMesLotesAtivos = pesagens.filter(p => {
      if (!lotesAtivosIds.has(p.lote_id)) return false;
      const d = new Date(p.data_pesagem);
      return d.getFullYear() === anoAtual && d.getMonth() + 1 === mesAtual;
    });
    const gmdPorLote = ultimaGmdPorLote(pesagensMesLotesAtivos);
    const gmdValues = Array.from(gmdPorLote.values());
    const gmdMedio = gmdValues.length > 0
      ? gmdValues.reduce((s, v) => s + v, 0) / gmdValues.length
      : 0;
    const pesagensMes = pesagensMesLotesAtivos.length;

    // Total animais: última pesagem de cada lote ativo
    let totalAnimais = 0;
    const lotesAtrasados: string[] = [];
    const limite30 = new Date(); limite30.setDate(limite30.getDate() - 30);
    lotesAtivos.forEach(l => {
      const ps = pesagens.filter(p => p.lote_id === l.id);
      if (ps.length === 0) { lotesAtrasados.push(l.id); return; }
      const last = ps[0];
      totalAnimais += last.quantidade_animais || 0;
      if (new Date(last.data_pesagem) < limite30) lotesAtrasados.push(l.id);
    });

    return {
      lotesAtivos: lotesAtivos.length,
      fazendas: fazendas.length,
      gmdMedio,
      totalAnimais,
      pesagensMes,
      lotesAtrasados: lotesAtrasados.length,
    };
  }, [lotes, pesagens, pesosByPesagem, fazendas]);

  // Dados filtrados
  const filtered = useMemo(() => {
    return pesagens.filter(p => {
      const lote = loteById[p.lote_id];
      if (!lote) return false;
      if (aFazenda !== "all" && lote.fazenda_id !== aFazenda) return false;
      const d = new Date(p.data_pesagem);
      if (d.getFullYear() !== aAno) return false;
      if (aMes !== "all" && d.getMonth() + 1 !== Number(aMes)) return false;
      return true;
    });
  }, [pesagens, loteById, aFazenda, aAno, aMes]);

  // Gráfico linha: GMD médio SIMPLES por mês (média entre lotes com pesagem válida)
  const lineData = useMemo(() => {
    return MESES.map(m => {
      const psMes = pesagens.filter(p => {
        const lote = loteById[p.lote_id];
        if (!lote) return false;
        if (aFazenda !== "all" && lote.fazenda_id !== aFazenda) return false;
        const d = new Date(p.data_pesagem);
        return d.getFullYear() === aAno && d.getMonth() + 1 === m.v;
      });
      const gmdPorLote = ultimaGmdPorLote(psMes);
      const arr = Array.from(gmdPorLote.values());
      const gmd = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      return { mes: m.l.slice(0, 3), gmd: Math.round(gmd * 1000) / 1000 };
    });
  }, [pesagens, loteById, aFazenda, aAno, pesosByPesagem]);

  // Agregações por categoria: GMD médio SIMPLES entre lotes daquela categoria
  const porCategoria = useMemo(() => {
    // Última pesagem por lote no período filtrado (para animais e GMD)
    const latestPorLote = new Map<string, Pesagem>();
    for (const p of filtered) {
      if (!latestPorLote.has(p.lote_id)) latestPorLote.set(p.lote_id, p);
    }
    const map: Record<string, { nome: string; gmds: number[]; animais: number; lotes: number }> = {};
    for (const [loteId, p] of latestPorLote) {
      const lote = loteById[loteId];
      if (!lote) continue;
      const nome = catLabel(lote);
      const g = gmdDaPesagem(p);
      const item = (map[nome] ??= { nome, gmds: [], animais: 0, lotes: 0 });
      if (g != null) item.gmds.push(g);
      item.animais += p.quantidade_animais || 0;
      item.lotes += 1;
    }
    return Object.values(map).map(v => ({
      nome: v.nome,
      gmdMedio: v.gmds.length > 0 ? v.gmds.reduce((s, x) => s + x, 0) / v.gmds.length : 0,
      animais: v.animais,
      lotes: v.lotes,
    })).sort((a, b) => b.animais - a.animais);
  }, [filtered, loteById, pesosByPesagem, customCats]);


  const aplicarFiltros = () => {
    setAFazenda(fFazenda);
    setAAno(fAno);
    setAMes(fMes);
  };

  const anosDisponiveis = useMemo(() => {
    const s = new Set<number>();
    s.add(now.getFullYear());
    pesagens.forEach(p => s.add(new Date(p.data_pesagem).getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [pesagens]);

  if (isLotes) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card><CardContent className="py-16 text-center text-muted-foreground">Em breve</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}{nome ? `, ${nome}` : ""}!</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo ao Mais Arrobas.</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard icon={<Warehouse className="w-4 h-4" />} label="Lotes ativos" value={kpis.lotesAtivos.toString()} />
            <KpiCard icon={<MapPin className="w-4 h-4" />} label="Minhas fazendas" value={kpis.fazendas.toString()} />
            <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="GMD médio (mês)" value={`${kpis.gmdMedio.toFixed(3)} kg/d`} />
            <KpiCard icon={<Users className="w-4 h-4" />} label="Total de animais" value={kpis.totalAnimais.toString()} />
            <KpiCard icon={<Scale className="w-4 h-4" />} label="Pesagens no mês" value={kpis.pesagensMes.toString()} />
            <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Lotes atrasados (>30d)" value={kpis.lotesAtrasados.toString()} accent={kpis.lotesAtrasados > 0} />
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Fazenda</label>
                  <Select value={fFazenda} onValueChange={setFFazenda}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_fazenda}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ano</label>
                  <Select value={String(fAno)} onValueChange={(v) => setFAno(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mês</label>
                  <Select value={fMes} onValueChange={setFMes}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MESES.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={aplicarFiltros}>Filtrar</Button>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico linha */}
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução de GMD médio ({aAno})</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="gmd" stroke="#1B4332" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Barras */}
          <Card>
            <CardHeader><CardTitle className="text-base">GMD médio por categoria</CardTitle></CardHeader>
            <CardContent>
              {porCategoria.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={porCategoria}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(3)} kg/d`} />
                      <Bar dataKey="gmdMedio" fill="#D4A017" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pizza */}
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição por categoria</CardTitle></CardHeader>
            <CardContent>
              {porCategoria.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período.</p>
              ) : (
                <div className="h-[420px]">
                  <ResponsiveContainer>
                    <PieChart margin={{ top: 8, right: 8, bottom: 56, left: 8 }}>
                      <Pie
                        data={porCategoria}
                        dataKey="animais"
                        nameKey="nome"
                        cx="50%"
                        cy="42%"
                        outerRadius={85}
                        labelLine={false}
                        label={(e: any) => e.animais}
                      >
                        {porCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconSize={10}
                        wrapperStyle={{ paddingTop: 24, fontSize: 12, lineHeight: "1.6em" }}
                        formatter={(_v, _e, i) => {
                          const c = porCategoria[i as number];
                          return `${c.nome} — ${c.animais} anim. · ${c.gmdMedio.toFixed(3)} kg/d`;
                        }}
                      />
                      <Tooltip formatter={(v: any) => `${v} animais`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista */}
          <Card>
            <CardHeader><CardTitle className="text-base">Detalhes por categoria</CardTitle></CardHeader>
            <CardContent>
              {porCategoria.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período.</p>
              ) : (
                <div className="divide-y">
                  {porCategoria.map((c) => (
                    <div key={c.nome} className="py-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground">
                        {c.animais} anim. · {c.lotes} lote{c.lotes === 1 ? "" : "s"} · GMD {c.gmdMedio.toFixed(3)} kg/d
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-destructive/60" : ""}>
      <CardContent className="py-3 px-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}<span>{label}</span>
        </div>
        <div className={`text-lg font-bold mt-1 ${accent ? "text-destructive" : "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
