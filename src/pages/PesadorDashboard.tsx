import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Scale, CalendarDays, Users, DollarSign } from "lucide-react";
import { calcularAnimais, totalizar, type PesagemCompraCfg, type PesoAnimal } from "@/lib/pesagemCompra";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CATEGORIAS_ORDER = [
  "boi_gordo",
  "vaca_gorda",
  "vaca_magra",
  "boi_magro",
  "garrote",
  "novilha",
  "bezerro",
  "bezerra",
] as const;

const CATEGORIA_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  aleatoria: "Aleatória",
};

const PIE_COLORS = [
  "#1B4332", "#2D6A4F", "#40916C", "#52B788",
  "#D4A017", "#E9C46A", "#B8860B", "#8B5E00",
];

const MESES = [
  { v: 1, l: "Janeiro" }, { v: 2, l: "Fevereiro" }, { v: 3, l: "Março" },
  { v: 4, l: "Abril" }, { v: 5, l: "Maio" }, { v: 6, l: "Junho" },
  { v: 7, l: "Julho" }, { v: 8, l: "Agosto" }, { v: 9, l: "Setembro" },
  { v: 10, l: "Outubro" }, { v: 11, l: "Novembro" }, { v: 12, l: "Dezembro" },
];

type PesagemRow = {
  id: string;
  cliente_id: string;
  categoria: string;
  finalizada_at: string;
  tipo_preco: string;
  preco_valor: number | null;
  modo_percentual: string | null;
  percentual_fixo: number | null;
  preco_arroba: number | null;
  preco_kg: number | null;
  preco_fixo_animal: number | null;
  valor_total_pago: number | null;
};

type CategoriaMap = Record<string, { tipo_preco: any; preco_valor: number }>;

export default function PesadorDashboard() {
  const [loading, setLoading] = useState(true);
  const [nomePesador, setNomePesador] = useState<string>("");
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("");
  const [pesagens, setPesagens] = useState<PesagemRow[]>([]);
  const [pesosByPesagem, setPesosByPesagem] = useState<Record<string, PesoAnimal[]>>({});
  const [catsByPesagem, setCatsByPesagem] = useState<Record<string, CategoriaMap>>({});
  const [totalClientes, setTotalClientes] = useState(0);

  const now = new Date();
  const [selYear, setSelYear] = useState<number>(now.getFullYear());
  const [selMonth, setSelMonth] = useState<number | "all">("all");
  const [appliedYear, setAppliedYear] = useState<number>(now.getFullYear());
  const [appliedMonth, setAppliedMonth] = useState<number | "all">("all");

  useEffect(() => {
    (async () => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser.user?.id;
      if (!uid) { setLoading(false); return; }

      const { data: pes } = await supabase
        .from("pesadores")
        .select("id, nome, nome_empresa")
        .eq("user_id", uid)
        .maybeSingle();
      const pesadorId = (pes as any)?.id as string | undefined;
      setNomePesador((pes as any)?.nome ?? "");
      setNomeEmpresa((pes as any)?.nome_empresa ?? "");
      if (!pesadorId) { setLoading(false); return; }

      const { data: pAll } = await supabase
        .from("pesagens_compra")
        .select("id, cliente_id, categoria, finalizada_at, tipo_preco, preco_valor, modo_percentual, percentual_fixo, preco_arroba, preco_kg, preco_fixo_animal")
        .eq("pesador_id", pesadorId)
        .not("finalizada_at", "is", null)
        .order("finalizada_at", { ascending: false });
      const rows = (pAll ?? []) as PesagemRow[];
      setPesagens(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: pesos } = await supabase
          .from("pesos_pesagem_compra")
          .select("pesagem_id, ordem, peso_kg, percentual_individual, tipo_preco_individual, categoria_individual")
          .in("pesagem_id", ids);
        const map: Record<string, PesoAnimal[]> = {};
        for (const p of pesos ?? []) {
          const key = (p as any).pesagem_id as string;
          (map[key] ||= []).push({
            ordem: (p as any).ordem,
            peso_kg: Number((p as any).peso_kg),
            percentual_individual: (p as any).percentual_individual != null ? Number((p as any).percentual_individual) : null,
            tipo_preco_individual: (p as any).tipo_preco_individual ?? null,
            categoria_individual: (p as any).categoria_individual ?? null,
          });
        }
        setPesosByPesagem(map);

        const mistoIds = rows.filter((r) => r.tipo_preco === "misto").map((r) => r.id);
        if (mistoIds.length > 0) {
          const { data: cats } = await supabase
            .from("pesagens_compra_categorias")
            .select("pesagem_id, categoria, tipo_preco, preco_valor")
            .in("pesagem_id", mistoIds);
          const cmap: Record<string, CategoriaMap> = {};
          for (const c of cats ?? []) {
            const key = (c as any).pesagem_id as string;
            (cmap[key] ||= {})[(c as any).categoria] = {
              tipo_preco: (c as any).tipo_preco,
              preco_valor: Number((c as any).preco_valor),
            };
          }
          setCatsByPesagem(cmap);
        }
      }

      const { count } = await supabase
        .from("clientes_pesador")
        .select("id", { count: "exact", head: true })
        .eq("pesador_id", pesadorId);
      setTotalClientes(count ?? 0);

      setLoading(false);
    })();
  }, []);

  function buildCfg(p: PesagemRow): PesagemCompraCfg {
    return {
      tipo_preco: p.tipo_preco as any,
      preco_valor: Number(p.preco_valor ?? 0),
      modo_percentual: (p.modo_percentual as any) ?? "na",
      percentual_fixo: p.percentual_fixo != null ? Number(p.percentual_fixo) : null,
      preco_arroba: p.preco_arroba != null ? Number(p.preco_arroba) : null,
      preco_kg: p.preco_kg != null ? Number(p.preco_kg) : null,
      preco_fixo_animal: p.preco_fixo_animal != null ? Number(p.preco_fixo_animal) : null,
      categorias_map: catsByPesagem[p.id] ?? null,
    };
  }

  // KPI stats (mês/ano atual — NÃO reagem ao filtro, conforme instrução)
  const stats = useMemo(() => {
    const month = now.getMonth();
    const year = now.getFullYear();
    let animaisAno = 0;
    let animaisMes = 0;
    let valorMes = 0;
    for (const p of pesagens) {
      const d = new Date(p.finalizada_at);
      const pesos = pesosByPesagem[p.id] ?? [];
      if (d.getFullYear() === year) animaisAno += pesos.length;
      if (d.getFullYear() === year && d.getMonth() === month) {
        animaisMes += pesos.length;
        const t = totalizar(calcularAnimais(buildCfg(p), pesos));
        valorMes += t.totalValor;
      }
    }
    return { animaisAno, animaisMes, valorMes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesagens, pesosByPesagem, catsByPesagem]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    for (const p of pesagens) set.add(new Date(p.finalizada_at).getFullYear());
    if (set.size === 0) set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesagens]);

  // Financeiro: recalcula com base no ano/mês aplicados
  const financeiro = useMemo(() => {
    const totalPorMes: number[] = Array(12).fill(0);
    const porCategoria: Record<string, { animais: number; arrobas: number; valor: number }> = {};
    let totalValor = 0;
    let totalAnimais = 0;
    let totalArrobas = 0;

    for (const p of pesagens) {
      const d = new Date(p.finalizada_at);
      if (d.getFullYear() !== appliedYear) continue;
      const mes = d.getMonth();
      const pesos = pesosByPesagem[p.id] ?? [];
      const cfg = buildCfg(p);
      const animais = calcularAnimais(cfg, pesos);
      const t = totalizar(animais);
      totalPorMes[mes] += t.totalValor;

      if (appliedMonth === "all" || mes + 1 === appliedMonth) {
        totalValor += t.totalValor;
        totalAnimais += animais.length;
        totalArrobas += t.totalArroba;

        for (const a of animais) {
          let cat: string;
          if (p.categoria === "aleatoria") {
            cat = a.categoria_individual ?? "aleatoria";
          } else {
            cat = p.categoria;
          }
          if (!porCategoria[cat]) porCategoria[cat] = { animais: 0, arrobas: 0, valor: 0 };
          porCategoria[cat].animais += 1;
          porCategoria[cat].arrobas += a.arroba_pagavel ?? 0;
          porCategoria[cat].valor += a.valor;
        }
      }
    }

    const lineData = MESES.map((m, i) => ({ mes: m.l.slice(0, 3), valor: Math.round(totalPorMes[i] * 100) / 100 }));

    const catEntries = Object.entries(porCategoria)
      .map(([cat, v]) => ({
        cat,
        label: CATEGORIA_LABELS[cat] ?? cat,
        animais: v.animais,
        arrobas: Math.round(v.arrobas * 100) / 100,
        valor: Math.round(v.valor * 100) / 100,
      }))
      .sort((a, b) => {
        const ia = CATEGORIAS_ORDER.indexOf(a.cat as any);
        const ib = CATEGORIAS_ORDER.indexOf(b.cat as any);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

    return {
      totalValor,
      totalAnimais,
      totalArrobas,
      lineData,
      catEntries,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesagens, pesosByPesagem, catsByPesagem, appliedYear, appliedMonth]);

  function aplicarFiltro() {
    setAppliedYear(selYear);
    setAppliedMonth(selMonth);
  }

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtNum = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando painel...
      </div>
    );
  }

  const periodoLabel =
    appliedMonth === "all"
      ? `Ano ${appliedYear}`
      : `${MESES.find((m) => m.v === appliedMonth)?.l} / ${appliedYear}`;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bem-vindo, {nomePesador || "Pesador"}
        </h1>
        {nomeEmpresa && (
          <p className="text-sm text-muted-foreground">{nomeEmpresa}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<Scale className="w-4 h-4" />} label="Animais pesados no ano" value={stats.animaisAno.toString()} />
        <KpiCard icon={<CalendarDays className="w-4 h-4" />} label="Animais pesados no mês" value={stats.animaisMes.toString()} />
        <KpiCard icon={<Users className="w-4 h-4" />} label="Clientes cadastrados" value={totalClientes.toString()} />
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Valor pago no mês" value={brl(stats.valorMes)} />
      </div>

      {/* Seção Financeiro */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Financeiro</h2>
          <span className="text-xs text-muted-foreground">{periodoLabel}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Ano</label>
            <Select value={String(selYear)} onValueChange={(v) => setSelYear(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mês</label>
            <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(v === "all" ? "all" : Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m.v} value={String(m.v)}>{m.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" onClick={aplicarFiltro}>Filtrar</Button>

        <div className="grid grid-cols-3 gap-2">
          <ResumoCard label="Total (R$)" value={brl(financeiro.totalValor)} />
          <ResumoCard label="Animais" value={financeiro.totalAnimais.toString()} />
          <ResumoCard label="Arrobas" value={fmtNum(financeiro.totalArrobas, 2)} />
        </div>

        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Valor por período ({appliedYear})</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={financeiro.lineData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Line type="monotone" dataKey="valor" stroke="#1B4332" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {financeiro.catEntries.length > 0 ? (
          <>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Valor por categoria</div>
              <div style={{ width: "100%", height: Math.max(180, financeiro.catEntries.length * 34) }}>
                <ResponsiveContainer>
                  <BarChart data={financeiro.catEntries} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="label" fontSize={11} width={90} />
                    <Tooltip formatter={(v: any) => brl(Number(v))} />
                    <Bar dataKey="valor" fill="#1B4332" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Distribuição por categoria</div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={financeiro.catEntries}
                      dataKey="animais"
                      nameKey="label"
                      cx="50%"
                      cy="45%"
                      outerRadius={80}
                      label={(e: any) => `${e.animais}`}
                    >
                      {financeiro.catEntries.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, _n: any, item: any) => [`${v} animais`, item?.payload?.label]} />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={10}
                      formatter={(_v: any, entry: any) => `${entry?.payload?.label} (${entry?.payload?.animais})`}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Detalhes por categoria</div>
              <div className="text-xs space-y-1">
                <div className="grid grid-cols-4 gap-1 text-muted-foreground border-b pb-1 mb-1">
                  <span>Categoria</span>
                  <span className="text-right">Animais</span>
                  <span className="text-right">@</span>
                  <span className="text-right">Valor</span>
                </div>
                {financeiro.catEntries.map((c) => (
                  <div key={c.cat} className="grid grid-cols-4 gap-1 py-1 border-b border-border/40">
                    <span>{c.label}</span>
                    <span className="text-right">{c.animais}</span>
                    <span className="text-right">{c.arrobas > 0 ? fmtNum(c.arrobas, 2) : "—"}</span>
                    <span className="text-right">{brl(c.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem pesagens no período selecionado.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function ResumoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground truncate">{value}</div>
    </div>
  );
}
