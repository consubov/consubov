import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getScreenCache, screenCacheKey, setScreenCache, useScreenCacheInvalidation } from "@/lib/screenCache";
import { Loader2 } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Props {
  fazendaId: string | null;
  retiroId: string | null;
  produtoId: string | null; // "todos"/null = sem filtro
  mes: number;
  ano: number;
}

/** Pastos cujo produto ativo (ocupação aberta → pasto → retiro) é o produto — mesma regra do filtro do painel. */
async function pastosDoProduto(fazendaId: string, retiroId: string | null, produtoId: string): Promise<string[]> {
  const { data: rs } = await supabase.from("retiros").select("id, produto_id").eq("fazenda_id", fazendaId).eq("ativo", true);
  let retiros = (rs ?? []) as { id: string; produto_id: string | null }[];
  if (retiroId) retiros = retiros.filter((r) => r.id === retiroId);
  if (!retiros.length) return [];
  const rp: Record<string, string | null> = {};
  for (const r of retiros) rp[r.id] = r.produto_id;
  const { data: ps } = await supabase.from("pastos").select("id, retiro_id, produto_id").in("retiro_id", retiros.map((r) => r.id)).eq("ativo", true);
  const pastos = (ps ?? []) as { id: string; retiro_id: string; produto_id: string | null }[];
  if (!pastos.length) return [];
  const { data: oc } = await (supabase as any).from("ocupacoes_pasto").select("pasto_id, produto_id, data_entrada")
    .in("pasto_id", pastos.map((p) => p.id)).is("data_saida", null).order("data_entrada", { ascending: false });
  const op: Record<string, string> = {};
  for (const o of (oc ?? []) as any[]) if (o.produto_id && !op[o.pasto_id]) op[o.pasto_id] = o.produto_id;
  return pastos.filter((p) => (op[p.id] ?? p.produto_id ?? rp[p.retiro_id] ?? null) === produtoId).map((p) => p.id);
}

interface Dados { anos: number[]; valores: (number | null)[] }

export default function CurvaConsumoCard({ fazendaId, retiroId, produtoId, mes, ano }: Props) {
  const [anoSel, setAnoSel] = useState(ano);
  useEffect(() => { setAnoSel(ano); }, [ano]);
  const prod = produtoId && produtoId !== "todos" ? produtoId : null;
  const key = screenCacheKey("curvaConsumo", [fazendaId, retiroId, prod, anoSel]);
  const [dados, setDados] = useState<Dados | null>(() => getScreenCache<Dados>(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [largura, setLargura] = useState(0);

  const carregar = useCallback(async () => {
    if (!fazendaId) { setDados(null); return; }
    setLoading(true);
    try {
      let pastoIds: string[] | null = null;
      if (prod) pastoIds = await pastosDoProduto(fazendaId, retiroId, prod);
      const base = () => {
        let q = (supabase as any).from("view_lancamento_consumo_real").eq("fazenda_id", fazendaId);
        if (retiroId) q = q.eq("retiro_id", retiroId);
        if (pastoIds) q = q.in("pasto_id", pastoIds.length ? pastoIds : ["00000000-0000-0000-0000-000000000000"]);
        return q;
      };
      // Mesma fórmula do get_painel_mae: SUM(kg)*1000 / SUM(cab_dias_assumidos), numa única consulta anual.
      const [anoRes, anosRes] = await Promise.all([
        base().select("mes_referencia, kg_fornecido, cab_dias_assumidos").eq("ano_referencia", anoSel).limit(10000),
        base().select("ano_referencia").limit(10000),
      ].map((q: any) => q));
      const kg = Array(12).fill(0), cab = Array(12).fill(0), tem = Array(12).fill(false);
      for (const r of (anoRes.data ?? []) as any[]) {
        const i = Number(r.mes_referencia) - 1;
        if (i < 0 || i > 11) continue;
        kg[i] += Number(r.kg_fornecido) || 0;
        cab[i] += Number(r.cab_dias_assumidos) || 0;
        tem[i] = true;
      }
      const valores = kg.map((k, i) => (tem[i] && cab[i] > 0 ? Math.round((k * 1000 / cab[i]) * 100) / 100 : null));
      const anosSet = new Set<number>(((anosRes.data ?? []) as any[]).map((r) => Number(r.ano_referencia)).filter(Boolean));
      const novo = { anos: Array.from(anosSet).sort((a, b) => b - a), valores };
      setScreenCache(key, novo);
      setDados(novo);
    } catch (e) {
      console.error("CurvaConsumo", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, retiroId, prod, anoSel, key]);

  useEffect(() => {
    const c = getScreenCache<Dados>(key);
    setDados(c ?? null);
    void carregar();
  }, [key, carregar]);
  useScreenCacheInvalidation(() => { void carregar(); });

  const pontos = useMemo(() => MESES.map((m, i) => ({
    mes: m, idx: i + 1, valor: dados?.valores[i] ?? null,
  })), [dados]);

  const anos = useMemo(() => {
    const s = new Set(dados?.anos ?? []);
    s.add(anoSel);
    return Array.from(s).sort((a, b) => b - a);
  }, [dados, anoSel]);

  const mesDestaque = anoSel === ano ? mes : null;
  const mostrarRotulos = largura >= 320;

  const Dot = (p: any) => {
    const { cx, cy, payload } = p;
    if (cx == null || cy == null || payload?.valor == null) return null;
    const sel = payload.idx === mesDestaque;
    return (
      <circle key={payload.idx} cx={cx} cy={cy} r={sel ? 6 : 3}
        fill={sel ? "hsl(var(--secondary))" : "hsl(var(--primary))"}
        stroke="hsl(var(--background))" strokeWidth={sel ? 2 : 1} />
    );
  };

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Curva de Consumo</CardTitle>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Select value={String(anoSel)} onValueChange={(v) => setAnoSel(Number(v))}>
            <SelectTrigger className="h-7 w-[84px] text-xs" aria-label="Ano da curva de consumo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" onResize={(w) => setLargura(w)}>
            <LineChart data={pontos} margin={{ top: 20, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" interval={0} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))" }}
                content={({ active, payload }: any) => {
                  const d = payload?.[0]?.payload;
                  if (!active || !d || d.valor == null) return null;
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow">
                      {d.mes}/{anoSel} · {fmt1(d.valor)} g/cab/dia
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2}
                connectNulls={false} dot={Dot} activeDot={{ r: 5 }} isAnimationActive={false}>
                {mostrarRotulos && (
                  <LabelList dataKey="valor" position="top" offset={8}
                    formatter={(v: any) => (v == null ? "" : String(Math.round(Number(v))))}
                    style={{ fontSize: 9, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                )}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
