import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNomeUsuario } from "@/hooks/useNomeUsuario";
import { usePainelData } from "@/hooks/usePainelData";
import { usePainelMae } from "@/hooks/usePainelMae";
import { useAbatesData } from "@/hooks/useAbatesData";
import { useMortalidadesData } from "@/hooks/useMortalidadesData";
import { resolvePainelPeriodo, usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import MonthScroller from "@/components/MonthScroller";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Beef, Droplets, Target, Package, DollarSign, TrendingUp,
  BarChart3, FileDown, RefreshCw, Loader2, ChevronRight, ArrowLeft, Skull, AlertTriangle, Gauge, Scale,
} from "lucide-react";
import { toast } from "sonner";

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

export default function AdminFazendaPainelPage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const nomeAdmin = useNomeUsuario(["administradores"], "Administrador");
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const filters = useMemo(() => ({
    fazendaId: fazendaId!,
    mes,
    ano,
  }), [fazendaId, mes, ano]);

  const { loading, fazendaNome, metrics, retirosResumo, refresh } = usePainelData(filters, { useFormulasSistema: true });
  const { painelMae, refresh: refreshPainelMae } = usePainelMae(fazendaId, null, mes, ano);
  const { abatidosMes, abatidosAno, refresh: refreshAbates } = useAbatesData(fazendaId, mes, ano);
  const { mortalidadesAno, refresh: refreshMortalidades } = useMortalidadesData(fazendaId, ano);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshPainelMae(), refreshAbates(), refreshMortalidades()]);
    setRefreshing(false);
  };

  const handleOpenRetiroPainel = (retiroId?: string) => {
    if (!user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }

    if (!retiroId) {
      toast.error("Retiro inválido.");
      return;
    }

    navigate(`/dashboard/retiro/${retiroId}?mes=${mes}&ano=${ano}`);
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
          <BreadcrumbItem><BreadcrumbPage>Painel</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/admin/fazendas/${fazendaId}`)}>
          <ArrowLeft className="w-4 h-4" /> Voltar
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

      <h1 className="text-xl font-bold text-foreground">{fazendaNome} — Painel</h1>

      <Card className="p-2">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(month, year) => setPeriodo(month, year)} />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Beef} label="Total Animais" value={fmtNum(metrics.totalAnimais)} />
        <MetricCard icon={Droplets} label="Consumo Real" value={fmtNum(painelMae.consumo_real_g_cab_dia, 1)} sub="g/cab/dia" iconColor="text-primary" />
        <MetricCard icon={Gauge} label="Consumo Global" value={fmtNum(painelMae.consumo_global_g_cab_dia, 1)} sub="g/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={Target} label="Pastos na Meta" value={`${painelMae.pastos_na_meta_num}/${painelMae.pastos_na_meta_den}`}
          sub={painelMae.pastos_na_meta_den > 0 ? `${fmtNum((painelMae.pastos_na_meta_num / painelMae.pastos_na_meta_den) * 100, 0)}%` : ""} iconColor="text-secondary" />
        <MetricCard icon={Scale} label="Peso Médio" value={fmtNum(painelMae.peso_medio_kg, 1)} sub="kg" iconColor="text-primary" />
        <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(metrics.sacosUtilizados)} />
        <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(metrics.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
        <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(metrics.custoMensal)} />
        <MetricCard icon={BarChart3} label="Eficiência" value={`${fmtNum(painelMae.eficiencia, 0)}%`} sub="índice médio" iconColor="text-secondary" />
        <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(metrics.gmdMedio, 3)} sub="kg/dia" />
        <MetricCard icon={Skull} label="Abatidos no mês" value={fmtNum(abatidosMes)} iconColor="text-destructive" />
        <MetricCard icon={Skull} label="Abatidos no ano" value={fmtNum(abatidosAno)} iconColor="text-destructive" />
        <MetricCard icon={AlertTriangle} label={`Mortalidade (${ano})`} value={fmtNum(mortalidadesAno)} iconColor="text-destructive" />
      </div>


      {(metrics.statusDist.baixo + metrics.statusDist.ideal + metrics.statusDist.alto) > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {metrics.statusDist.baixoPct > 0 && <div className="transition-all" style={{ width: `${metrics.statusDist.baixoPct}%`, backgroundColor: "#E53935" }} />}
              {(metrics.statusDist as any).atencaoPct > 0 && <div className="transition-all" style={{ width: `${(metrics.statusDist as any).atencaoPct}%`, backgroundColor: "#FBC02D" }} />}
              {metrics.statusDist.idealPct > 0 && <div className="transition-all" style={{ width: `${metrics.statusDist.idealPct}%`, backgroundColor: "#43A047" }} />}
              {metrics.statusDist.altoPct > 0 && <div className="transition-all" style={{ width: `${metrics.statusDist.altoPct}%`, backgroundColor: "#1E88E5" }} />}
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-medium" style={{ color: "#E53935" }}>Baixo {fmtNum(metrics.statusDist.baixoPct, 0)}%</span>
              {(metrics.statusDist as any).atencaoPct > 0 && (
                <span className="font-medium" style={{ color: "#FBC02D" }}>Atenção {fmtNum((metrics.statusDist as any).atencaoPct, 0)}%</span>
              )}
              <span className="font-medium" style={{ color: "#43A047" }}>Ideal {fmtNum(metrics.statusDist.idealPct, 0)}%</span>
              <span className="font-medium" style={{ color: "#1E88E5" }}>Alto {fmtNum(metrics.statusDist.altoPct, 0)}%</span>
            </div>

          </CardContent>
        </Card>
      )}

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Retiros</h2>
      {retirosResumo.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum retiro ativo encontrado.</p>
      ) : (
        <div className="space-y-3">
          {retirosResumo.map(r => (
            <Card
              key={r.id}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              onClick={() => handleOpenRetiroPainel(r.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{r.nome}</p>
                    <p className="text-xs text-muted-foreground">{r.capataz}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground">Animais</p><p className="text-sm font-bold">{r.totalAnimais}</p></div>
                  <div><p className="text-xs text-muted-foreground">Sacos</p><p className="text-sm font-bold">{r.sacosUtilizados}</p></div>
                  <div><p className="text-xs text-muted-foreground">Consumo</p><p className="text-sm font-bold text-secondary">{fmtNum(r.consumoMedio, 1)}</p></div>
                  <div><p className="text-xs text-muted-foreground">GMD</p><p className="text-sm font-bold text-primary">{r.gmd == null ? "—" : fmtNum(r.gmd, 3)}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ExportarRelatorioModal
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        fazendaId={fazendaId!}
        fazendaNome={fazendaNome}
        geradoPor={nomeAdmin}
        initialMes={mes}
        initialAno={ano}
      />
    </div>
  );
}
