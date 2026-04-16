import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePainelData } from "@/hooks/usePainelData";
import { resolvePainelPeriodo, usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import MonthScroller from "@/components/MonthScroller";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import { useMortalidadesData } from "@/hooks/useMortalidadesData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Beef, Droplets, Target, Package, DollarSign, TrendingUp,
  BarChart3, FileDown, RefreshCw, Loader2, ArrowLeft, TreePine, AlertTriangle, Map,
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
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedFazendaId, setResolvedFazendaId] = useState<string | null>(fazendaId ?? null);
  const [resolvingRoute, setResolvingRoute] = useState(!fazendaId);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  const { loading, fazendaNome, metrics, retirosResumo, refresh } = usePainelData(filters);
  const { mortalidadesAno, refresh: refreshMortalidades } = useMortalidadesData(activeFazendaId || undefined, ano, retiroId);

  const retiroData = retirosResumo.find(r => r.id === retiroId);
  const retiroNome = retiroData?.nome ?? "Retiro";

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
    await Promise.all([refresh(), refreshMortalidades()]);
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

  if (!activeFazendaId || !retiroId || !retiroData) {
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
        <MetricCard icon={Beef} label="Total Animais" value={fmtNum(metrics.totalAnimais)} />
        <MetricCard icon={Droplets} label="Consumo Médio" value={fmtNum(metrics.consumoMedio, 1)} sub="g/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={Target} label="Pastos na Meta" value={`${metrics.pastosNaMeta}/${metrics.totalPastos}`}
          sub={metrics.totalPastos > 0 ? `${fmtNum((metrics.pastosNaMeta / metrics.totalPastos) * 100, 0)}%` : ""} iconColor="text-secondary" />
        <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(metrics.sacosUtilizados)} />
        <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(metrics.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(metrics.custoMensal)} />
        <MetricCard icon={BarChart3} label="Eficiência" value={`${fmtNum(metrics.eficiencia, 0)}%`} sub="índice médio" iconColor="text-secondary" />
        <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(metrics.gmdMedio, 3)} sub="kg/dia" />
        <MetricCard icon={AlertTriangle} label={`Mortalidade (${ano})`} value={fmtNum(mortalidadesAno)} iconColor="text-destructive" />
      </div>

      {(metrics.statusDist.baixo + metrics.statusDist.ideal + metrics.statusDist.alto) > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {metrics.statusDist.baixoPct > 0 && <div className="bg-destructive transition-all" style={{ width: `${metrics.statusDist.baixoPct}%` }} />}
              {metrics.statusDist.idealPct > 0 && <div className="bg-primary transition-all" style={{ width: `${metrics.statusDist.idealPct}%` }} />}
              {metrics.statusDist.altoPct > 0 && <div className="bg-secondary transition-all" style={{ width: `${metrics.statusDist.altoPct}%` }} />}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-destructive font-medium">Baixo {fmtNum(metrics.statusDist.baixoPct, 0)}%</span>
              <span className="text-primary font-medium">Ideal {fmtNum(metrics.statusDist.idealPct, 0)}%</span>
              <span className="text-secondary font-medium">Alto {fmtNum(metrics.statusDist.altoPct, 0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {retiroData && retiroData.pastos.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <TreePine className="w-4 h-4" /> Pastos ({retiroData.pastos.length})
          </h2>
          <div className="space-y-2">
            {retiroData.pastos.map(p => {
              const consumoList = retiroData.pastosConsumo.get(p.id) ?? [];
              const totalSacos = consumoList.reduce((s, c) => s + c.num_sacos, 0);
              const numAnimais = consumoList.length > 0
                ? Math.max(...consumoList.map(c => c.num_animais))
                : p.num_animais;

              // Weighted average consumption by num_animais
              let consumoGCabDia = 0;
              let totalAnimaisConsumo = 0;
              for (const c of consumoList) {
                if (c.consumo_g_cab_dia > 0 && c.num_animais > 0) {
                  consumoGCabDia += c.consumo_g_cab_dia * c.num_animais;
                  totalAnimaisConsumo += c.num_animais;
                }
              }
              consumoGCabDia = totalAnimaisConsumo > 0 ? consumoGCabDia / totalAnimaisConsumo : 0;

              // Status from latest lancamento (pre-calculated by DB trigger)
              const latestConsumo = consumoList.length > 0 ? consumoList[consumoList.length - 1] : null;
              const statusConsumo = latestConsumo?.status_consumo;
              const indiceConsumo = latestConsumo?.indice_consumo;

              return (
                <Card key={p.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{p.nome}</p>
                      <div className="flex items-center gap-1.5">
                        {statusConsumo && (
                          <Badge className={`text-[10px] px-1.5 py-0 h-5 ${
                            statusConsumo === "Baixo" ? "bg-destructive text-destructive-foreground" :
                            statusConsumo === "Ideal" ? "bg-primary text-primary-foreground" :
                            "bg-secondary text-secondary-foreground"
                          }`}>
                            {statusConsumo}
                            {indiceConsumo != null ? ` (${Number(indiceConsumo).toFixed(2)})` : ""}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{numAnimais} cab</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="text-muted-foreground">Sacos</p><p className="font-bold">{totalSacos}</p></div>
                      <div><p className="text-muted-foreground">Consumo</p><p className="font-bold text-secondary">{consumoGCabDia > 0 ? fmtNum(consumoGCabDia, 1) : "—"}</p></div>
                      <div><p className="text-muted-foreground">Peso</p><p className="font-bold">{p.peso_medio_kg ? `${p.peso_medio_kg}kg` : "—"}</p></div>
                      <div><p className="text-muted-foreground">GMD</p><p className="font-bold text-primary">{p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0 ? fmtNum(Number(p.gmd_kg_dia), 3) : "—"}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

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
        geradoPor={user?.user_metadata?.nome || user?.email?.split('@')[0] || (isGerente ? "Gerente" : "Administrador")}
        initialMes={mes}
        initialAno={ano}
        lockedRetiroId={retiroId}
      />
    </div>
  );
}
