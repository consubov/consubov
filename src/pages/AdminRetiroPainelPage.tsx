import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePainelData } from "@/hooks/usePainelData";
import { readPainelPeriodoFromSearchParams, usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import MonthScroller from "@/components/MonthScroller";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Beef, Droplets, Target, Package, DollarSign, TrendingUp,
  BarChart3, FileDown, RefreshCw, Loader2, ArrowLeft, TreePine,
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
  const { fazendaId, retiroId } = useParams<{ fazendaId: string; retiroId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const periodoDaUrl = readPainelPeriodoFromSearchParams(searchParams);
    if (periodoDaUrl) {
      setPeriodo(periodoDaUrl.mes, periodoDaUrl.ano);
    }
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

  const filters = useMemo(() => ({
    fazendaId: fazendaId!,
    retiroId: retiroId!,
    mes,
    ano,
  }), [fazendaId, retiroId, mes, ano]);

  const { loading, fazendaNome, metrics, retirosResumo, refresh } = usePainelData(filters);

  const retiroData = retirosResumo.find(r => r.id === retiroId);
  const retiroNome = retiroData?.nome ?? "Retiro";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>{fazendaNome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}/painel?mes=${mes}&ano=${ano}`}>Painel</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{retiroNome}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/admin/fazendas/${fazendaId}/painel?mes=${mes}&ano=${ano}`)}>
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </Button>
        <div className="flex gap-2">
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

              // Weighted average consumption from pre-calculated data
              let consumoGCabDia = 0;
              let totalCD = 0;
              for (const c of consumoList) {
                if (c.consumo_g_cab_dia > 0) {
                  const cd = c.num_animais * c.dias_no_pasto;
                  consumoGCabDia += c.consumo_g_cab_dia * cd;
                  totalCD += cd;
                }
              }
              consumoGCabDia = totalCD > 0 ? consumoGCabDia / totalCD : 0;

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
        fazendaId={fazendaId!}
        fazendaNome={fazendaNome}
        geradoPor={user?.user_metadata?.nome || user?.email || "Administrador"}
        initialMes={mes}
        initialAno={ano}
        lockedRetiroId={retiroId!}
      />
    </div>
  );
}
