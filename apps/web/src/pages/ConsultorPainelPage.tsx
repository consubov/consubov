import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Landmark, Calendar, AlertTriangle, TrendingUp, Beef } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Periodo = "7d" | "30d" | "mes" | "custom";

const GREEN = "#1F7A4D";
const GOLD = "#C9A84C";
const RED = "#B91C1C";
const GRAY = "#94A3B8";

export default function ConsultorPainelPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [dataInicio, setDataInicio] = useState<Date>(subDays(new Date(), 30));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [customIni, setCustomIni] = useState("");
  const [customFim, setCustomFim] = useState("");

  const [fazendas, setFazendas] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [nomeConsultor, setNomeConsultor] = useState("");
  const [animaisAvaliados, setAnimaisAvaliados] = useState(0);
  const [evolucaoScore, setEvolucaoScore] = useState<{ data: string; score: number }[]>([]);

  useEffect(() => {
    const now = new Date();
    if (periodo === "7d") { setDataInicio(subDays(now, 7)); setDataFim(now); }
    else if (periodo === "30d") { setDataInicio(subDays(now, 30)); setDataFim(now); }
    else if (periodo === "mes") { setDataInicio(startOfMonth(now)); setDataFim(endOfMonth(now)); }
    else if (periodo === "custom" && customIni && customFim) {
      setDataInicio(new Date(customIni)); setDataFim(new Date(customFim));
    }
  }, [periodo, customIni, customFim]);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dataInicio, dataFim]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: cons } = await supabase.from("consultores").select("id, nome").eq("user_id", user.id).maybeSingle();
      const consultorId = cons?.id;
      setNomeConsultor((cons as any)?.nome ?? "");
      if (!consultorId) { setLoading(false); return; }

      const { data: vinc } = await supabase.from("fazendas_consultor").select("id, nome_fazenda").eq("consultor_id", consultorId).is("deleted_at", null);
      const listaFaz = vinc ?? [];
      setFazendas(listaFaz);

      const iniISO = format(dataInicio, "yyyy-MM-dd");
      const fimISO = format(dataFim, "yyyy-MM-dd");

      const { data: vs } = await supabase
        .from("visitas_tecnicas")
        .select("id, fazenda_consultor_id, hora_inicio, status, tipo")
        .eq("consultor_id", consultorId)
        .is("deleted_at", null)
        .gte("hora_inicio", iniISO)
        .lte("hora_inicio", fimISO + "T23:59:59");
      setVisitas(vs ?? []);

      // Animais avaliados no período (pastos/currais das visitas)
      const visitaIds = (vs ?? []).map((v: any) => v.id);
      if (visitaIds.length) {
        const { data: pastos } = await supabase
          .from("visita_pastos")
          .select("qtd_animais")
          .in("visita_id", visitaIds);
        const total = (pastos ?? []).reduce((acc: number, p: any) => acc + (Number(p.qtd_animais) || 0), 0);
        setAnimaisAvaliados(total);
      } else {
        setAnimaisAvaliados(0);
      }

      // Evolução: pontos por visita ordenados
      const evo: { data: string; score: number }[] = [];
      for (const v of (vs ?? []).sort((a: any, b: any) => new Date(a.hora_inicio).getTime() - new Date(b.hora_inicio).getTime())) {
        const { data: p } = await supabase.from("visita_pastos").select("id").eq("visita_id", v.id);
        const ids = (p ?? []).map((x: any) => x.id);
        if (!ids.length) continue;
        const { data: sc } = await supabase.from("avaliacoes_score").select("nota").in("visita_pasto_id", ids);
        const arr = (sc ?? []).map((x: any) => Number(x.nota)).filter((n) => n > 0);
        if (arr.length) evo.push({
          data: format(new Date(v.hora_inicio), "dd/MM"),
          score: arr.reduce((a, b) => a + b, 0) / arr.length,
        });
      }
      setEvolucaoScore(evo);
    } finally {
      setLoading(false);
    }
  }

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const now = new Date();
  const semanaIni = startOfWeek(now, { locale: ptBR });
  const semanaFim = endOfWeek(now, { locale: ptBR });
  const mesIni = startOfMonth(now);
  const mesFim = endOfMonth(now);

  const visitasSemana = useMemo(() =>
    visitas.filter((v) => {
      const d = new Date(v.hora_inicio);
      return d >= semanaIni && d <= semanaFim;
    }).length, [visitas, semanaIni, semanaFim]);

  const visitasMes = useMemo(() =>
    visitas.filter((v) => {
      const d = new Date(v.hora_inicio);
      return d >= mesIni && d <= mesFim;
    }).length, [visitas, mesIni, mesFim]);

  const fazendasVisitadas = useMemo(() => new Set(visitas.map((v) => v.fazenda_consultor_id)), [visitas]);
  const semVisita = Math.max(0, fazendas.length - fazendasVisitadas.size);

  const donutFazendas = [
    { name: "Visitadas", value: fazendasVisitadas.size, fill: GREEN },
    { name: "Sem visita", value: semVisita, fill: RED },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {saudacao}{nomeConsultor ? `, ${nomeConsultor.trim().split(/\s+/)[0]}` : ""}!
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral do período selecionado</p>
      </div>

      <Card className="p-3 flex flex-wrap gap-2 items-center">
        {(["7d", "30d", "mes", "custom"] as Periodo[]).map((p) => (
          <Button
            key={p}
            variant={periodo === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo(p)}
          >
            {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : p === "mes" ? "Este mês" : "Personalizado"}
          </Button>
        ))}
        {periodo === "custom" && (
          <>
            <input type="date" value={customIni} onChange={(e) => setCustomIni(e.target.value)} className="text-sm border rounded px-2 py-1" />
            <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} className="text-sm border rounded px-2 py-1" />
          </>
        )}
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard icon={<Landmark className="w-4 h-4" />} label="Fazendas" value={String(fazendas.length)} />
          <MetricCard icon={<Calendar className="w-4 h-4" />} label="Visitas (semana)" value={String(visitasSemana)} />
          <MetricCard icon={<Calendar className="w-4 h-4" />} label="Visitas (mês)" value={String(visitasMes)} />
          <MetricCard icon={<Beef className="w-4 h-4" />} label="Animais avaliados" value={animaisAvaliados.toLocaleString("pt-BR")} />

          <Card className="p-3 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div className="text-sm font-semibold">Fazendas sem visita no período</div>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={donutFazendas} dataKey="value" innerRadius={40} outerRadius={60} strokeWidth={0}>
                    {donutFazendas.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: GREEN }} /> Visitadas: {fazendasVisitadas.size}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: RED }} /> Sem visita: {semVisita}</div>
              </div>
            </div>
          </Card>

          <Card className="p-3 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold">Evolução do Score</div>
            </div>
            {evolucaoScore.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={evolucaoScore}>
                  <XAxis dataKey="data" fontSize={11} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke={GREEN} strokeWidth={2} dot={{ fill: GOLD }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}<span className="text-sm font-normal text-muted-foreground">{suffix}</span></div>
    </Card>
  );
}
