import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Beef, DollarSign, Droplets, Package, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { classificarCategoria } from "@/lib/consumoCalc";

const CATEGORIAS = ["Recria 1", "Recria 2", "Engorda"] as const;
const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Lancamento {
  id: string; fazenda_id: string; retiro_id: string; pasto_id: string;
  mes_referencia: number; ano_referencia: number;
  num_animais: number; num_sacos: number; dias_no_pasto: number;
  categoria: string | null; peso_medio_kg: number | null;
  consumo_g_cab_dia?: number | null;
}

interface Pasto {
  id: string; num_animais: number; peso_medio_kg: number | null;
  categoria: string | null; produto_id: string | null; gmd_kg_dia: number | null;
}

interface Retiro { id: string; produto_id: string | null; }

interface Produto {
  id: string; nome: string; peso_saco_kg: number; preco_por_kg: number | null;
  consumo_engorda: number | null; consumo_recria1: number | null; consumo_recria2: number | null;
  margem_engorda: number | null; margem_recria1: number | null; margem_recria2: number | null;
}

interface CatMetrics {
  categoria: string;
  consumoMedio: number;
  totalAnimais: number;
  totalSacos: number;
  custoMedio: number;
  custoPorKgGanho: number;
  gmd: number;
  custoTotal: number;
}

interface Props {
  filteredLancamentos: Lancamento[];
  consumosPorLanc: { lancamento: Lancamento; consumo: number | null }[];
  pastoById: Record<string, Pasto>;
  retiroById: Record<string, Retiro>;
  produtoById: Record<string, Produto>;
  filtroCategoria: string;
  getEffectiveProdutoId: (l: Lancamento) => string | null;
}

export default function MetricasPorCategoria({
  filteredLancamentos, consumosPorLanc, pastoById, retiroById, produtoById,
  filtroCategoria, getEffectiveProdutoId,
}: Props) {
  const metricas = useMemo(() => {
    const catMap: Record<string, {
      weightedSum: number; totalAnimais: number; sacos: number;
      custoTotal: number; gmds: number[]; diasTotal: number;
    }> = {};

    CATEGORIAS.forEach(c => {
      catMap[c] = { weightedSum: 0, totalAnimais: 0, sacos: 0, custoTotal: 0, gmds: [], diasTotal: 0 };
    });

    filteredLancamentos.forEach(l => {
      const pesoMedio = l.peso_medio_kg ?? pastoById[l.pasto_id]?.peso_medio_kg ?? 0;
      const cat = l.categoria || classificarCategoria(pesoMedio);
      if (!catMap[cat]) return;

      const entry = catMap[cat];
      const animais = Number(l.num_animais ?? 0);
      entry.totalAnimais += animais;
      entry.sacos += l.num_sacos;
      entry.diasTotal += l.dias_no_pasto;

      // Weighted sum for consumption average (by num_animais)
      const consumoReal = Number(l.consumo_g_cab_dia ?? 0);
      if (consumoReal > 0 && animais > 0) {
        entry.weightedSum += consumoReal * animais;
      }

      // Cost: product peso_saco_kg * preco_por_kg (read-only lookup)
      const produtoId = getEffectiveProdutoId(l);
      if (produtoId) {
        const prod = produtoById[produtoId];
        if (prod && l.num_sacos > 0) {
          const preco = prod.preco_por_kg ?? 0;
          entry.custoTotal += l.num_sacos * prod.peso_saco_kg * preco;
        }
      }

      // GMD from pasto
      const pasto = pastoById[l.pasto_id];
      if (pasto?.gmd_kg_dia && pasto.gmd_kg_dia > 0) {
        entry.gmds.push(pasto.gmd_kg_dia);
      }
    });

    const result: CatMetrics[] = [];
    CATEGORIAS.forEach(cat => {
      const e = catMap[cat];
      const consumoMedio = e.totalAnimais > 0
        ? e.weightedSum / e.totalAnimais : 0;
      const gmd = e.gmds.length > 0
        ? e.gmds.reduce((a, b) => a + b, 0) / e.gmds.length : 0;
      const custoMedio = e.totalAnimais > 0 ? e.custoTotal / e.totalAnimais : 0;
      const avgDias = e.sacos > 0 ? e.diasTotal / e.sacos : 30;
      const kgGanho = e.totalAnimais > 0 && gmd > 0 ? e.totalAnimais * gmd * avgDias : 0;
      const custoPorKgGanho = kgGanho > 0 ? e.custoTotal / kgGanho : 0;

      result.push({
        categoria: cat,
        consumoMedio,
        totalAnimais: e.totalAnimais,
        totalSacos: e.sacos,
        custoMedio,
        custoPorKgGanho,
        gmd,
        custoTotal: e.custoTotal,
      });
    });

    return result;
  }, [filteredLancamentos, pastoById, produtoById, getEffectiveProdutoId]);

  const categoriasExibidas = filtroCategoria === "all"
    ? metricas
    : metricas.filter(m => m.categoria === filtroCategoria);

  const chartData = metricas.map(m => ({
    name: m.categoria,
    consumo: Math.round(m.consumoMedio * 10) / 10,
  }));

  const BAR_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Métricas por Categoria Animal
      </h2>

      {/* Category Cards */}
      <div className={`grid gap-4 ${categoriasExibidas.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
        {categoriasExibidas.map(m => (
          <Card key={m.categoria}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Beef className="w-4 h-4 text-primary" />
                {m.categoria}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{fmtNum(m.consumoMedio, 1)}</span>
                <span className="text-xs text-muted-foreground">g/cab/dia</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Beef className="w-3 h-3" /> Animais
                </div>
                <div className="font-medium text-foreground">{fmtNum(m.totalAnimais)}</div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <Package className="w-3 h-3" /> Sacos
                </div>
                <div className="font-medium text-foreground">{fmtNum(m.totalSacos)}</div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" /> R$/cab/mês
                </div>
                <div className="font-medium text-foreground">{fmtBRL(m.custoMedio)}</div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" /> R$/kg ganho
                </div>
                <div className="font-medium text-foreground">{m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="w-3 h-3" /> GMD
                </div>
                <div className="font-medium text-foreground">{m.gmd > 0 ? `${fmtNum(m.gmd, 3)} kg/dia` : "—"}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            Consumo por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.some(d => d.consumo > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} g/cab/dia`, "Consumo"]} />
                <Bar dataKey="consumo" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs">Animais</TableHead>
                  <TableHead className="text-xs">Consumo Médio</TableHead>
                  <TableHead className="text-xs">Custo Total</TableHead>
                  <TableHead className="text-xs">Custo/Animal</TableHead>
                  <TableHead className="text-xs">Custo/kg Ganho</TableHead>
                  <TableHead className="text-xs">GMD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasExibidas.map(m => (
                  <TableRow key={m.categoria}>
                    <TableCell className="font-medium text-sm">{m.categoria}</TableCell>
                    <TableCell className="text-sm">{fmtNum(m.totalAnimais)}</TableCell>
                    <TableCell className="text-sm">{fmtNum(m.consumoMedio, 1)} g/cab/dia</TableCell>
                    <TableCell className="text-sm">{fmtBRL(m.custoTotal)}</TableCell>
                    <TableCell className="text-sm">{fmtBRL(m.custoMedio)}</TableCell>
                    <TableCell className="text-sm">{m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</TableCell>
                    <TableCell className="text-sm">{m.gmd > 0 ? `${fmtNum(m.gmd, 3)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
