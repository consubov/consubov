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

interface Dados { anos: number[]; valores: (number | null)[] }

export default function CurvaConsumoCard({ fazendaId, retiroId, produtoId, mes, ano }: Props) {
  const [anoSel, setAnoSel] = useState(ano);
  useEffect(() => { setAnoSel(ano); }, [ano]);
  const prod = produtoId && produtoId !== "todos" ? produtoId : null;
  const key = screenCacheKey("curvaConsumo", [fazendaId, retiroId, prod, anoSel]);
  const [dados, setDados] = useState<Dados | null>(() => getScreenCache<Dados>(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [largura, setLargura] = useState(0);

  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    if (!fazendaId) { setDados(null); return; }
    setLoading(true);
    try {
      // Fonte única: view_lancamento_consumo_real agrupada por mês — mesma conta
      // do card "Consumo Real" (SUM(kg)*1000 / SUM(cab_dias_assumidos)).
      // Produto: a view não tem coluna de produto, então o filtro é ignorado
      // (nota "Curva de todos os produtos" é exibida no rodapé do card).
      let q = (supabase as any).from("view_lancamento_consumo_real")
        .select("ano_referencia, mes_referencia, kg_fornecido, cab_dias_assumidos")
        .eq("fazenda_id", fazendaId);
      if (retiroId) q = q.eq("retiro_id", retiroId);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      const kg = Array(12).fill(0), cab = Array(12).fill(0);
      const anosSet = new Set<number>();
      for (const r of (data ?? []) as any[]) {
        const a = Number(r.ano_referencia);
        if (a) anosSet.add(a);
        if (a !== anoSel) continue;
        const i = Number(r.mes_referencia) - 1;
        if (i < 0 || i > 11) continue;
        kg[i] += Number(r.kg_fornecido) || 0;
        cab[i] += Number(r.cab_dias_assumidos) || 0;
      }
      const valores = kg.map((k: number, i: number) => (cab[i] > 0 ? Number(((k * 1000) / cab[i]).toFixed(2)) : null));
      const novo = { anos: Array.from(anosSet).sort((a, b) => b - a), valores };
      setScreenCache(key, novo);
      setDados(novo);
      setErro(false);
    } catch (e) {
      console.error("CurvaConsumo", e);
      setErro(true);
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
        {erro ? (
          <div className="h-[220px] w-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Não foi possível carregar a curva</p>
          </div>
        ) : (
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
