import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNomeUsuario } from "@/hooks/useNomeUsuario";
import { supabase } from "@/integrations/supabase/client";
import { usePainelData } from "@/hooks/usePainelData";
import { usePainelMae } from "@/hooks/usePainelMae";
import { resolvePainelPeriodo, usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import MonthScroller from "@/components/MonthScroller";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import { useMortalidadesData } from "@/hooks/useMortalidadesData";
import { usePastosRetiro } from "@/hooks/usePastosRetiro";
import PastosListaRetiro from "@/components/pastos/PastosListaRetiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Beef, Droplets, Target, Package, DollarSign, TrendingUp,
  BarChart3, FileDown, RefreshCw, Loader2, ArrowLeft, TreePine, AlertTriangle, Map, Gauge, Scale,
} from "lucide-react";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function MetricCard({ icon: Icon, label, value, sub, iconColor = "text-primary" }: {
  icon: any; label: string; value: string; sub?: string; iconColor?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-1 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{label}</CardTitle>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminRetiroPainelPage() {
  const { fazendaId, retiroId } = useParams<{ fazendaId?: string; retiroId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role, roleData } = useAuth();
  const isGerente = role === "gerente";
  const nomeGeradoPor = useNomeUsuario(isGerente ? ["gerentes"] : ["administradores"], isGerente ? "Gerente" : "Administrador");
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedFazendaId, setResolvedFazendaId] = useState<string | null>(fazendaId ?? null);
  const [resolvingRoute, setResolvingRoute] = useState(!fazendaId);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [retiroNomeFallback, setRetiroNomeFallback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveRoute() {
      if (!retiroId) {
        if (!cancelled) {
          setResolvedFazendaId(null);
          setRouteError("Retiro inválido ou não informado.");
          setResolvingRoute(false);
        }
        return;
      }

      if (fazendaId) {
        if (!cancelled) {
          setResolvedFazendaId(fazendaId);
          setRouteError(null);
          setResolvingRoute(false);
        }
        return;
      }

      if (!cancelled) {
        setResolvingRoute(true);
      }

      const { data, error } = await supabase
        .from("retiros")
        .select("fazenda_id")
        .eq("id", retiroId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data?.fazenda_id) {
        setResolvedFazendaId(null);
        setRouteError("Retiro não encontrado ou indisponível.");
        setResolvingRoute(false);
        return;
      }

      if (isGerente && roleData.fazendaId && data.fazenda_id !== roleData.fazendaId) {
        setResolvedFazendaId(null);
        setRouteError("Você não tem permissão para visualizar este retiro.");
        setResolvingRoute(false);
        return;
      }

      setResolvedFazendaId(data.fazenda_id);
      setRouteError(null);
      setResolvingRoute(false);
    }

    void resolveRoute();

    return () => {
      cancelled = true;
    };
  }, [fazendaId, retiroId, isGerente, roleData.fazendaId]);

  useEffect(() => {
    const periodoInicial = resolvePainelPeriodo(searchParams);
    setPeriodo(periodoInicial.mes, periodoInicial.ano);
  }, [searchParams, setPeriodo]);

  useEffect(() => {
    if (searchParams.get("mes") === String(mes) && searchParams.get("ano") === String(ano)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mes", String(mes));
    nextParams.set("ano", String(ano));
    setSearchParams(nextParams, { replace: true });
  }, [mes, ano, searchParams, setSearchParams]);

  const activeFazendaId = fazendaId ?? resolvedFazendaId ?? "";

  const filters = useMemo(() => ({
    fazendaId: activeFazendaId,
    retiroId: retiroId ?? null,
    mes,
    ano,
  }), [activeFazendaId, retiroId, mes, ano]);

  const { loading, fazendaNome, metrics, retirosResumo, refresh } = usePainelData(filters, { useFormulasSistema: true });
  const { painelMae, refresh: refreshPainelMae } = usePainelMae(activeFazendaId || null, retiroId ?? null, mes, ano);
  const { mortalidadesAno, refresh: refreshMortalidades } = useMortalidadesData(activeFazendaId || undefined, ano, retiroId);

  // Fonte única por pasto: view_painel_mae_pasto (Consumo Real + Status Real)
  const [pastoMae, setPastoMae] = useState<Record<string, any>>({});
  const loadPastoMae = useCallback(async () => {
    if (!retiroId) { setPastoMae({}); return; }
    const { data, error } = await (supabase as any)
      .from("view_painel_mae_pasto")
      .select("pasto_id, consumo_real_g_cab_dia, indice_real, status_real, num_sacos, num_animais, peso_medio_kg")
      .eq("retiro_id", retiroId)
      .eq("mes_referencia", mes)
      .eq("ano_referencia", ano);
    if (error) { console.error("view_painel_mae_pasto error:", error); setPastoMae({}); return; }
    const map: Record<string, any> = {};
    for (const row of (data ?? [])) map[row.pasto_id] = row;
    setPastoMae(map);
  }, [retiroId, mes, ano]);
  useEffect(() => { void loadPastoMae(); }, [loadPastoMae]);

  // Lista de Pastos: fonte única compartilhada com gerente/capataz e com o Mapa
  // (view_painel_mae_pasto_atual → consumo_global_g_cab_dia / status_global).
  const { pastos: pastosLista, refresh: refreshPastosLista } = usePastosRetiro(retiroId ?? null, mes, ano);

  const retiroData = retirosResumo.find(r => r.id === retiroId);
  const retiroNome = retiroData?.nome ?? "Retiro";

  // Restringe métricas do painel apenas aos pastos com lançamento no mês/ano
  // selecionado — mesma regra usada no PDF do Relatório de Consumo.
  const metricsPeriodo = useMemo(() => {
    if (!retiroData) return metrics;
    const pastosComLanc = retiroData.pastos.filter(p => (retiroData.pastosConsumo.get(p.id)?.length ?? 0) > 0);
    // "Pastos na Meta" mantém denominador = total de pastos ativos do retiro
    // (mesmo do rodapé). "Total Animais" é o rebanho REAL do retiro — fonte
    // única: SUM(pastos.num_animais) dos pastos ativos, a mesma contagem
    // usada pelo mapa do Capataz. Independe do mês selecionado e não deriva
    // de lançamentos de consumo.
    const totalPastos = retiroData.pastos.length;
    const totalAnimais = retiroData.pastos.reduce((sum, p) => sum + (p.num_animais || 0), 0);

    const gmdVals = pastosComLanc
      .filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0)
      .map(p => Number(p.gmd_kg_dia));
    const gmdMedio = gmdVals.length ? gmdVals.reduce((a, b) => a + b, 0) / gmdVals.length : 0;

    // Distribuição de Status: fonte única = view_painel_mae_pasto (status_real),
    // mesma fonte da lista de pastos abaixo e do PDF.
    let baixo = 0, ideal = 0, alto = 0;
    for (const p of retiroData.pastos) {
      const status = pastoMae[p.id]?.status_real ?? null;
      if (status === "Ideal") ideal++;
      else if (status === "Baixo") baixo++;
      else if (status === "Alto") alto++;
    }
    const totalStatus = baixo + ideal + alto;

    return {
      ...metrics,
      totalAnimais,
      totalPastos,
      consumoMedio: painelMae.consumo_real_g_cab_dia,
      gmdMedio,
      statusDist: {
        baixo, ideal, alto,
        baixoPct: totalStatus > 0 ? (baixo / totalStatus) * 100 : 0,
        idealPct: totalStatus > 0 ? (ideal / totalStatus) * 100 : 0,
        altoPct: totalStatus > 0 ? (alto / totalStatus) * 100 : 0,
      },
    };
  }, [retiroData, metrics, pastoMae, painelMae]);

  const handleBack = () => {
    if (isGerente) {
      navigate("/gerente");
      return;
    }

    if (activeFazendaId) {
      navigate(`/admin/fazendas/${activeFazendaId}/painel?mes=${mes}&ano=${ano}`);
      return;
    }

    navigate("/app");
  };

  const renderErrorState = (title: string, description: string) => (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-destructive font-semibold text-lg">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" onClick={handleBack}>
          Voltar
        </Button>
      </div>
    </div>
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshPainelMae(), refreshMortalidades(), loadPastoMae(), refreshPastosLista()]);
    setRefreshing(false);
  };

  if (resolvingRoute) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (routeError) {
    return renderErrorState("Não foi possível abrir o painel", routeError);
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!retiroId || (!retiroData && pastosLista.length === 0)) {
    return renderErrorState(
      "Retiro não encontrado",
      "Verifique se o retiro existe e se você possui permissão para visualizar seus dados.",
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {!isGerente && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${activeFazendaId}`}>{fazendaNome}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${activeFazendaId}/painel?mes=${mes}&ano=${ano}`}>Painel</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{retiroNome}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4" /> {isGerente ? "Voltar" : "Voltar ao Painel"}
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
            if (retiroId) {
              navigate(`/mapa/retiro/${retiroId}`);
            }
          }}>
            <Map className="w-4 h-4" /> Ver Mapa
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRelatorioOpen(true)}>
            <FileDown className="w-4 h-4" /> Relatório
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <h1 className="text-xl font-bold text-foreground">{retiroNome} — Painel</h1>
      {retiroData && <p className="text-sm text-muted-foreground">Capataz: {retiroData.capataz}</p>}

      <Card className="p-2">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(month, year) => setPeriodo(month, year)} />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Beef} label="Total Animais" value={fmtNum(metricsPeriodo.totalAnimais)} />
        <MetricCard icon={Droplets} label="Consumo Real" value={fmtNum(painelMae.consumo_real_g_cab_dia, 1)} sub="g/cab/dia" iconColor="text-primary" />
        <MetricCard icon={Gauge} label="Consumo Global" value={fmtNum(painelMae.consumo_global_g_cab_dia, 1)} sub="g/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={Target} label="Pastos na Meta" value={`${painelMae.pastos_na_meta_num}/${painelMae.pastos_na_meta_den}`}
          sub={painelMae.pastos_na_meta_den > 0 ? `${fmtNum((painelMae.pastos_na_meta_num / painelMae.pastos_na_meta_den) * 100, 0)}%` : ""} iconColor="text-secondary" />
        <MetricCard icon={Scale} label="Peso Médio" value={fmtNum(painelMae.peso_medio_kg, 1)} sub="kg" iconColor="text-primary" />
        <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(metricsPeriodo.sacosUtilizados)} />
        <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(metricsPeriodo.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(metricsPeriodo.custoMensal)} />
        <MetricCard icon={BarChart3} label="Eficiência" value={`${fmtNum(painelMae.eficiencia, 0)}%`} sub="índice médio" iconColor="text-secondary" />
        <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(metricsPeriodo.gmdMedio, 3)} sub="kg/dia" />
        <MetricCard icon={AlertTriangle} label={`Mortalidade (${ano})`} value={fmtNum(mortalidadesAno)} iconColor="text-destructive" />
      </div>

      {(metricsPeriodo.statusDist.baixo + metricsPeriodo.statusDist.ideal + metricsPeriodo.statusDist.alto) > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {metricsPeriodo.statusDist.baixoPct > 0 && <div className="bg-destructive transition-all" style={{ width: `${metricsPeriodo.statusDist.baixoPct}%` }} />}
              {metricsPeriodo.statusDist.idealPct > 0 && <div className="bg-primary transition-all" style={{ width: `${metricsPeriodo.statusDist.idealPct}%` }} />}
              {metricsPeriodo.statusDist.altoPct > 0 && <div className="bg-secondary transition-all" style={{ width: `${metricsPeriodo.statusDist.altoPct}%` }} />}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-destructive font-medium">Baixo {fmtNum(metricsPeriodo.statusDist.baixoPct, 0)}%</span>
              <span className="text-primary font-medium">Ideal {fmtNum(metricsPeriodo.statusDist.idealPct, 0)}%</span>
              <span className="text-secondary font-medium">Alto {fmtNum(metricsPeriodo.statusDist.altoPct, 0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <PastosListaRetiro pastos={pastosLista} />

      {retiroData && retiroData.diasSemSalga != null && (
        <Card className="border-secondary/50">
          <CardContent className="p-3 text-sm">
            <p className="text-muted-foreground">Dias sem salga: <strong className="text-foreground">{retiroData.diasSemSalga}</strong></p>
          </CardContent>
        </Card>
      )}

      <ExportarRelatorioModal
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        fazendaId={activeFazendaId}
        fazendaNome={fazendaNome}
        geradoPor={nomeGeradoPor}
        initialMes={mes}
        initialAno={ano}
        lockedRetiroId={retiroId}
      />
    </div>
  );
}
