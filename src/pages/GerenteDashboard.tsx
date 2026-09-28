import { Fragment, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentPainelPeriodo, usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import { useAuth } from "@/hooks/useAuth";
import { useNomeUsuario } from "@/hooks/useNomeUsuario";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import RelatorioSalgaPage from "@/pages/RelatorioSalgaPage";
import MonthScroller from "@/components/MonthScroller";
import { usePainelMae } from "@/hooks/usePainelMae";
import { usePainelProduto } from "@/hooks/usePainelProduto";
import { useGerenteData, type RetiroComDados, type Observacao, type AlertaAtraso, type GerenteFilters } from "@/hooks/useGerenteData";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { usePastosRetiro } from "@/hooks/usePastosRetiro";
import PastosListaRetiro from "@/components/pastos/PastosListaRetiro";
import GerenteProdutoRetiroCard from "@/components/gerente/GerenteProdutoRetiroCard";
import { useAbatesData } from "@/hooks/useAbatesData";
import { useMortalidadesData } from "@/hooks/useMortalidadesData";
import { useEstoqueData } from "@/hooks/useEstoqueData";
import EstoqueDashboard from "@/components/estoque/EstoqueDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LogOut, Beef, Droplets, Target, Package, DollarSign,
  TrendingUp, Award, ChevronRight, Bell, CheckCircle2, CalendarClock,
  Clock, MapPin, TreePine, RefreshCw, BarChart3, Eye, AlertTriangle, FileDown, Skull, Map, FileText, Download, Loader2, ScanLine, PackagePlus, Menu, Gauge, Scale,
  Camera,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";
import { EnableNotificationsBanner } from "@/components/EnableNotificationsBanner";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { UserNotificationToggle } from "@/components/UserNotificationToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAndStoreSalgaPdf, downloadBlob } from "@/lib/autoSalgaPdf";
import SyncCapatazPanel from "@/components/sync/SyncCapatazPanel";
import LancamentosManuaisPendentes from "@/components/gerente/LancamentosManuaisPendentes";
import GerenteNotificacoesBell from "@/components/gerente/GerenteNotificacoesBell";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
        <span className="text-xl font-extrabold text-primary-foreground">C</span>
      </div>
    </div>
  );
}

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

function scoreColor(score: number) {
  if (score >= 7) return "text-primary font-bold";
  if (score >= 4) return "text-secondary font-bold";
  return "text-destructive font-bold";
}

const GERENTE_FILTROS_KEY = "consubov:gerente-filtros";
interface GerenteFiltrosSalvos { fazenda: string; retiro: string; produto: string; mes: number; ano: number; }
function readGerenteFiltros(): GerenteFiltrosSalvos | null {
  try {
    const raw = sessionStorage.getItem(GERENTE_FILTROS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as GerenteFiltrosSalvos;
    return typeof v?.mes === "number" && typeof v?.ano === "number" ? v : null;
  } catch { return null; }
}
function writeGerenteFiltros(v: GerenteFiltrosSalvos) {
  try { sessionStorage.setItem(GERENTE_FILTROS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

export default function GerenteDashboard() {
  const { signOut, user, roleData } = useAuth();
  const nomeGerentePdf = useNomeUsuario(["gerentes"], "");
  const navigate = useNavigate();
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const [scoreAberto, setScoreAberto] = useState<string | null>(null);
  const [fazendasVinculadas, setFazendasVinculadas] = useState<Array<{ id: string; nome: string }>>([]);
  // Filtros guardados na sessão: ao voltar para a tela (ou se o iPhone
  // descartar o app da memória) eles são restaurados em vez de zerados.
  const [savedFiltros] = useState(() => readGerenteFiltros());
  const skipResetRef = useRef({ retiro: !!savedFiltros, produto: !!savedFiltros });
  const [fazendaSelecionadaId, setFazendaSelecionadaId] = useState(savedFiltros?.fazenda || roleData.fazendaId || "");
  const [painelRetiroId, setPainelRetiroId] = useState(savedFiltros?.retiro ?? "todos");
  const [painelProdutoId, setPainelProdutoId] = useState(savedFiltros?.produto ?? "todos");

  useEffect(() => {
    if (!roleData.roleId) return;
    let cancelled = false;
    const carregarFazendas = async () => {
      const { data } = await supabase
        .from("gerentes_fazendas")
        .select("fazenda_id, fazendas(id, nome)")
        .eq("gerente_id", roleData.roleId);
      if (cancelled) return;
      const opcoes = (data ?? []).flatMap((item: any) => {
        const fazenda = Array.isArray(item.fazendas) ? item.fazendas[0] : item.fazendas;
        return fazenda?.id ? [{ id: fazenda.id, nome: fazenda.nome }] : [];
      });
      if (opcoes.length === 0 && roleData.fazendaId) {
        const { data: fazenda } = await supabase.from("fazendas").select("id, nome").eq("id", roleData.fazendaId).maybeSingle();
        if (!cancelled && fazenda) setFazendasVinculadas([fazenda]);
        return;
      }
      setFazendasVinculadas(opcoes);
      if (opcoes.length > 0 && !opcoes.some(f => f.id === fazendaSelecionadaId)) {
        setFazendaSelecionadaId(opcoes[0].id);
      }
    };
    void carregarFazendas();
    return () => { cancelled = true; };
  }, [roleData.roleId, roleData.fazendaId, fazendaSelecionadaId]);

  const activeFazendaId = fazendaSelecionadaId || roleData.fazendaId || "";

  // Ao trocar de fazenda, o retiro selecionado volta para "Todos os retiros"
  // (nunca pode ficar um retiro da fazenda anterior).
  useEffect(() => {
    if (skipResetRef.current.retiro) { skipResetRef.current.retiro = false; return; }
    setPainelRetiroId("todos");
  }, [activeFazendaId]);

  const activeRetiroId = painelRetiroId === "todos" ? null : painelRetiroId;

  // Trocar fazenda ou retiro reseta o filtro de produto.
  useEffect(() => {
    if (skipResetRef.current.produto) { skipResetRef.current.produto = false; return; }
    setPainelProdutoId("todos");
  }, [activeFazendaId, painelRetiroId]);

  useEffect(() => {
    if (savedFiltros) { setPeriodo(savedFiltros.mes, savedFiltros.ano); return; }
    const periodoAtual = getCurrentPainelPeriodo();
    setPeriodo(periodoAtual.mes, periodoAtual.ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPeriodo]);

  useEffect(() => {
    writeGerenteFiltros({ fazenda: fazendaSelecionadaId, retiro: painelRetiroId, produto: painelProdutoId, mes, ano });
  }, [fazendaSelecionadaId, painelRetiroId, painelProdutoId, mes, ano]);

  const filters = useMemo<GerenteFilters>(() => ({
    ano,
    mes,
    cicloStatus: 'todos',
    fazendaId: activeFazendaId,
    painelRetiroId: activeRetiroId,
  }), [ano, mes, activeFazendaId, activeRetiroId]);

  const {
    loading, gerenteNome, fazendaNome, ciclo, ciclosDisponiveis, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh,
    alertasAtraso, intervaloDefinido,
  } = useGerenteData(filters);

  const { painelMae } = usePainelMae(activeFazendaId || null, activeRetiroId, mes, ano);
  const { abatidosMes, abatidosAno, refresh: refreshAbates } = useAbatesData(activeFazendaId || undefined, mes, ano, activeRetiroId ?? undefined);
  const { mortalidadesAno, refresh: refreshMortalidades } = useMortalidadesData(activeFazendaId || undefined, ano, activeRetiroId ?? undefined);

  // Filtro de produto do painel (recalcula tudo só para os pastos do produto).
  const produtoFiltro = usePainelProduto({
    fazendaId: activeFazendaId || null,
    retiroId: activeRetiroId,
    mes,
    ano,
    produtoId: painelProdutoId,
  });
  const painelMaeView = produtoFiltro.filtroAtivo ? produtoFiltro.painelMae : painelMae;
  const painelDataView = produtoFiltro.filtroAtivo
    ? { ...painelData, ...produtoFiltro.agg }
    : painelData;
  const abatidosMesView = produtoFiltro.filtroAtivo ? produtoFiltro.abatidosMes : abatidosMes;
  const abatidosAnoView = produtoFiltro.filtroAtivo ? produtoFiltro.abatidosAno : abatidosAno;
  const {
    estoques, transferencias, loading: estoqueLoading,
    adicionarEstoque, aprovarTransferencia, recusarTransferencia,
  } = useEstoqueData(activeFazendaId, mes, ano);

  const retirosList = useMemo(() => retirosComDados.map(r => ({ id: r.id!, nome: r.nome })).filter(r => r.id), [retirosComDados]);

  const [selectedRetiro, setSelectedRetiro] = useState<RetiroComDados | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [salgaReportOpen, setSalgaReportOpen] = useState(false);
  const [pdfLoadingByRetiro, setPdfLoadingByRetiro] = useState<Record<string, boolean>>({});
  const [pdfRefreshTick, setPdfRefreshTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setPainelRetiroId("todos");
  }, [activeFazendaId]);

  // Realtime: when any capataz syncs (lancamento INSERT into our fazenda),
  // bump a tick so retiro rows re-render the "Baixar PDF" affordance.
  useEffect(() => {
    if (!activeFazendaId) return;
    const channel = supabase
      .channel(`gerente-lancamentos-${activeFazendaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lancamentos",
          filter: `fazenda_id=eq.${activeFazendaId}`,
        },
        () => {
          setPdfRefreshTick((t) => t + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFazendaId]);

  const handleBaixarSalgaPdf = async (retiro: RetiroComDados) => {
    if (!retiro.id || !activeFazendaId) return;
    setPdfLoadingByRetiro((m) => ({ ...m, [retiro.id!]: true }));
    try {
      // Use the last 24h as default range when generating on demand
      const result = await generateAndStoreSalgaPdf({
        fazendaId: activeFazendaId,
        fazendaNome,
        retiroId: retiro.id,
        retiroNome: retiro.nome,
        sinceIso: null,
        responsavelNome: retiro.capataz || gerenteNome,
      });
      if (result.empty) {
        toast.info("Sem salgas recentes para gerar PDF.");
      } else {
        downloadBlob(result.blob, result.fileName);
        toast.success("PDF baixado");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setPdfLoadingByRetiro((m) => ({ ...m, [retiro.id!]: false }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshAbates(), refreshMortalidades()]);
    setRefreshing(false);
  };

  const handleOpenRetiro = (retiroId?: string) => {
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

  if (loading) return <LoadingScreen />;

  if (salgaReportOpen && roleData.fazendaId) {
    return (
      <RelatorioSalgaPage
        onBack={() => setSalgaReportOpen(false)}
        fazendaId={roleData.fazendaId}
        fazendaNome={fazendaNome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UpdateBanner />
      <EnableNotificationsBanner />
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex-shrink-0 space-y-2">
        {/* Linha 1: identidade + ações principais */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-primary/80 -ml-2"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80vw] max-w-sm p-0 flex flex-col">
                <SheetHeader className="bg-primary text-primary-foreground p-4 text-left space-y-1">
                  <SheetTitle className="text-primary-foreground text-base font-bold">Gerente</SheetTitle>
                  <SheetDescription className="text-primary-foreground/80 text-xs">
                    {gerenteNome}
                  </SheetDescription>
                </SheetHeader>
                <Separator />
                <nav className="flex-1 overflow-y-auto p-2">
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/materias-primas"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <Package className="w-5 h-5 text-primary" />
                        Matérias-Primas
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/entrada-materias-primas"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <PackagePlus className="w-5 h-5 text-primary" />
                        Entrada Matéria-Prima
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/produtos"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <Package className="w-5 h-5 text-primary" />
                        Produtos
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/auditoria-fotos"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <Camera className="w-5 h-5 text-primary" />
                        Auditoria de Fotos
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/gmd"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <TrendingUp className="w-5 h-5 text-primary" />
                        GMD
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/gerente/previsao-abate"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <CalendarClock className="w-5 h-5 text-primary" />
                        Previsão de Abate
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => navigate("/conferencia"), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <ScanLine className="w-5 h-5 text-primary" />
                        Conferência
                      </button>
                    </li>
                    <li><Separator className="my-1" /></li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => setSalgaReportOpen(true), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <FileText className="w-5 h-5 text-primary" />
                        Relatório de Salga
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => setRelatorioOpen(true), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <FileDown className="w-5 h-5 text-primary" />
                        Relatório de Consumo
                      </button>
                    </li>
                  </ul>
                </nav>
              </SheetContent>
            </Sheet>
            <img src={logoConsubov} alt="Consubov" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">Gerente</h1>
              <p className="max-w-[160px] truncate text-xs opacity-80 sm:max-w-[220px]">{gerenteNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-primary-foreground hover:bg-primary/80" disabled={refreshing} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80" title="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Linha 2: fazenda + sino e versão (sem sobrepor) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs opacity-90 min-w-0">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{fazendaNome}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
             {activeFazendaId && <GerenteNotificacoesBell fazendaId={activeFazendaId} />}
            <UserNotificationToggle />
            <AppVersionBadge />
          </div>
        </div>
      </header>

      {/* Month Scroller */}
      <div className="bg-card border-b px-2 py-2 flex-shrink-0">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(m, y) => setPeriodo(m, y)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="painel" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-6 rounded-none border-b bg-card h-10 flex-shrink-0">
          <TabsTrigger value="painel" className="text-xs data-[state=active]:text-primary">Painel</TabsTrigger>
          <TabsTrigger value="retiros" className="text-xs data-[state=active]:text-primary">Retiros</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs data-[state=active]:text-primary relative">
            Estoque
            {transferencias.filter(t => t.status === 'pendente').length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
                {transferencias.filter(t => t.status === 'pendente').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs data-[state=active]:text-primary">Ranking</TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs data-[state=active]:text-primary relative">
            Alertas
            {(obsPendentes.length + alertasAtraso.length) > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
                {obsPendentes.length + alertasAtraso.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sync" className="text-xs data-[state=active]:text-primary">Sync</TabsTrigger>
        </TabsList>

        {/* ===== PAINEL ===== */}
        <TabsContent value="painel" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              {fazendasVinculadas.length > 1 && (
                <Select value={activeFazendaId} onValueChange={setFazendaSelecionadaId}>
                  <SelectTrigger className="h-9 w-full max-w-[190px]" aria-label="Selecionar fazenda">
                    <SelectValue placeholder="Fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {fazendasVinculadas.map(fazenda => (
                      <SelectItem key={fazenda.id} value={fazenda.id}>{fazenda.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {retirosComDados.length > 1 && (
              <Select value={painelRetiroId} onValueChange={setPainelRetiroId}>
                <SelectTrigger className="h-9 w-full max-w-[190px] flex-1" aria-label="Selecionar retiro">
                  <SelectValue placeholder="Retiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os retiros</SelectItem>
                  {retirosComDados.map(retiro => (
                    <SelectItem key={retiro.id} value={retiro.id}>{retiro.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {produtoFiltro.produtos.length > 0 && (
              <Select value={painelProdutoId} onValueChange={setPainelProdutoId}>
                <SelectTrigger className="h-9 w-full max-w-[190px] flex-1" aria-label="Selecionar produto">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtoFiltro.produtos.map(produto => (
                    <SelectItem key={produto.id} value={produto.id}>{produto.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Painel da Fazenda</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={Beef} label="Total Animais" value={fmtNum(painelDataView.totalAnimais)} />
            <MetricCard icon={Droplets} label="Consumo Real" value={`${fmtNum(painelMaeView.consumo_real_g_cab_dia, 1)}`} sub="g/cab/dia" iconColor="text-primary" />
            <MetricCard icon={Gauge} label="Consumo Global" value={`${fmtNum(painelMaeView.consumo_global_g_cab_dia, 1)}`} sub="g/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={Target} label="Pastos na Meta" value={`${painelMaeView.pastos_na_meta_num}/${painelMaeView.pastos_na_meta_den}`} sub={painelMaeView.pastos_na_meta_den > 0 ? `${fmtNum((painelMaeView.pastos_na_meta_num / painelMaeView.pastos_na_meta_den) * 100, 0)}%` : ''} iconColor="text-secondary" />
            <MetricCard icon={Scale} label="Peso Médio" value={fmtNum(painelMaeView.peso_medio_kg, 1)} sub="kg" iconColor="text-primary" />
            <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(painelDataView.sacosUtilizados)} />
            <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(painelDataView.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(painelDataView.custoMensal)} />
            <MetricCard icon={BarChart3} label="Eficiência Geral" value={`${fmtNum(painelMaeView.eficiencia, 0)}%`} sub="índice médio" iconColor="text-secondary" />
            <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(painelDataView.gmdMedio, 3)} sub="kg/dia" />
            <MetricCard icon={Skull} label="Abatidos no mês" value={fmtNum(abatidosMesView)} iconColor="text-destructive" />
            <MetricCard icon={Skull} label="Abatidos no ano" value={fmtNum(abatidosAnoView)} iconColor="text-destructive" />
            <MetricCard icon={AlertTriangle} label={`Mortalidade (${ano})`} value={fmtNum(mortalidadesAno)} iconColor="text-destructive" />
          </div>

          {/* Status Distribution */}
          {(painelDataView.statusDistribution.baixo + painelDataView.statusDistribution.ideal + painelDataView.statusDistribution.alto) > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {/* Bar */}
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  {painelDataView.statusDistribution.baixoPct > 0 && (
                    <div className="transition-all" style={{ width: `${painelDataView.statusDistribution.baixoPct}%`, backgroundColor: "#E53935" }} />
                  )}
                  {(painelDataView.statusDistribution as any).atencaoPct > 0 && (
                    <div className="transition-all" style={{ width: `${(painelDataView.statusDistribution as any).atencaoPct}%`, backgroundColor: "#FBC02D" }} />
                  )}
                  {painelDataView.statusDistribution.idealPct > 0 && (
                    <div className="transition-all" style={{ width: `${painelDataView.statusDistribution.idealPct}%`, backgroundColor: "#43A047" }} />
                  )}
                  {painelDataView.statusDistribution.altoPct > 0 && (
                    <div className="transition-all" style={{ width: `${painelDataView.statusDistribution.altoPct}%`, backgroundColor: "#1E88E5" }} />
                  )}
                </div>
                {/* Labels */}
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: "#E53935" }}>Baixo {fmtNum(painelDataView.statusDistribution.baixoPct, 0)}%</span>
                  {(painelDataView.statusDistribution as any).atencaoPct > 0 && (
                    <span className="font-medium" style={{ color: "#FBC02D" }}>Atenção {fmtNum((painelDataView.statusDistribution as any).atencaoPct, 0)}%</span>
                  )}
                  <span className="font-medium" style={{ color: "#43A047" }}>Ideal {fmtNum(painelDataView.statusDistribution.idealPct, 0)}%</span>
                  <span className="font-medium" style={{ color: "#1E88E5" }}>Alto {fmtNum(painelDataView.statusDistribution.altoPct, 0)}%</span>
                </div>

              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== RETIROS ===== */}
        <TabsContent value="retiros" className="flex-1 overflow-auto p-4 space-y-3 mt-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Retiros</h2>
          {retirosComDados.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum retiro ativo encontrado.</p>
          ) : (
            retirosComDados.map(r => (
              <Card key={r.id} className={`cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] ${r.alertaAtraso ? 'border-destructive/50' : ''}`} onClick={() => handleOpenRetiro(r.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">{r.capataz}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.alertaAtraso && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Animais</p>
                      <p className="text-sm font-bold text-foreground">{r.totalAnimais}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sacos</p>
                      <p className="text-sm font-bold text-foreground">{r.sacosUtilizados}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Consumo</p>
                      <p className="text-sm font-bold text-secondary">{fmtNum(r.consumoMedio, 1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GMD</p>
                      <p className="text-sm font-bold text-primary">{fmtNum(r.gmd, 3)}</p>
                    </div>
                  </div>
                  {/* Interval info */}
                  <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>Intervalo: {r.intervaloDefinido}d definido · {r.intervaloRealMedio != null ? `${r.intervaloRealMedio}d real` : '—'}</span>
                    {r.diasSemSalga != null && (
                      <span className={r.alertaAtraso ? 'text-destructive font-semibold' : ''}>
                        {r.diasSemSalga}d sem salga
                      </span>
                    )}
                  </div>
                  {/* Inline PDF download — auto-refreshes via realtime tick */}
                  <div className="mt-2 flex justify-end" data-tick={pdfRefreshTick}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={!r.id || !!pdfLoadingByRetiro[r.id!]}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleBaixarSalgaPdf(r);
                      }}
                    >
                      {r.id && pdfLoadingByRetiro[r.id] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Baixar PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ===== ESTOQUE ===== */}
        <TabsContent value="estoque" className="flex-1 overflow-auto p-4 mt-0">
          <EstoqueDashboard
            estoques={estoques}
            transferencias={transferencias}
            retiros={retirosList}
            onAdicionarEstoque={adicionarEstoque}
            onAprovar={aprovarTransferencia}
            onRecusar={recusarTransferencia}
            loading={estoqueLoading}
          />
        </TabsContent>

        {/* ===== RANKING ===== */}
        <TabsContent value="ranking" className="flex-1 overflow-auto p-4 space-y-6 mt-0">
          {/* Score de Eficiência */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" /> Score de Eficiência
            </h2>
            {capatazScores.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Sem dados suficientes.</p>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead>Retiro</TableHead>
                      <TableHead>Capataz</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capatazScores.map((s, i) => {
                      const aberto = scoreAberto === s.retiroId;
                      return (
                        <Fragment key={s.retiroId}>
                          <TableRow className="cursor-pointer" onClick={() => setScoreAberto(aberto ? null : s.retiroId)}>
                            <TableCell className="text-center font-semibold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="text-sm">{s.retiro}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{s.capataz}</TableCell>
                            <TableCell className={`text-right ${scoreColor(s.score)}`}>{fmtNum(s.score, 1)}/10</TableCell>
                          </TableRow>
                          {aberto && (
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={4} className="text-xs space-y-1 py-2">
                                <p><span className="font-semibold">Meta {fmtNum(s.scoreMeta, 1)}/{s.pesoMeta}</span> — {s.detalheMeta}</p>
                                <p><span className="font-semibold">Salga {fmtNum(s.scoreSalga, 1)}/{s.pesoSalga}</span> — {s.detalheSalga}</p>
                                <p><span className="font-semibold">Cocho {s.scoreCocho != null ? fmtNum(s.scoreCocho, 1) : "—"}/{s.pesoCocho}</span> — {s.detalheCocho}</p>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>

          {/* GMD Ranking */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Ranking GMD por Retiro
            </h2>
            {gmdRanking.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Sem dados suficientes.</p>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead>Retiro</TableHead>
                      <TableHead>Capataz</TableHead>
                      <TableHead className="text-right">GMD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gmdRanking.map((r, i) => (
                      <TableRow key={r.retiro}>
                        <TableCell className="text-center font-semibold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">{r.retiro}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.capataz}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{fmtNum(r.gmd, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== ALERTAS ===== */}
        <TabsContent value="alertas" className="flex-1 overflow-auto p-4 space-y-6 mt-0">
          {/* Alertas de salga atrasada */}
          {alertasAtraso.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Salga Atrasada
                <Badge variant="destructive" className="text-[10px] h-5">{alertasAtraso.length}</Badge>
              </h2>
              <div className="space-y-2">
                {alertasAtraso.map(a => {
                  const gravCfg = {
                    leve: { border: 'border-yellow-500/50', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
                    moderado: { border: 'border-orange-500/50', bg: 'bg-orange-50 dark:bg-orange-950/20' },
                    critico: { border: 'border-destructive', bg: 'bg-destructive/5' },
                  };
                  const cfg = gravCfg[a.gravidade];
                  return (
                    <Card key={a.retiroNome} className={`${cfg.border} ${cfg.bg}`}>
                      <CardContent className="p-3 space-y-1">
                        <p className="text-sm font-bold text-destructive">⚠️ ALERTA DE SALGA ATRASADA</p>
                        <p className="text-xs"><span className="text-muted-foreground">Retiro:</span> {a.retiroNome}</p>
                        <p className="text-xs"><span className="text-muted-foreground">Última salga:</span> {a.ultimaSalga ? new Date(a.ultimaSalga).toLocaleDateString('pt-BR') : 'Nunca'}</p>
                        <p className="text-xs"><span className="text-muted-foreground">Intervalo definido:</span> {a.intervaloDefinido} dias</p>
                        <p className="text-xs font-semibold text-destructive">Dias sem salga: {a.diasSemSalga}</p>
                        <p className="text-xs text-muted-foreground">👉 Verificar responsável pela salga</p>
                        <Badge variant="destructive" className="text-[10px] mt-1">
                          {a.gravidade === 'critico' ? '🔴 Crítico' : a.gravidade === 'moderado' ? '🟠 Moderado' : '🟡 Leve'}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lançamentos Manuais Pendentes */}
          {roleData.fazendaId && <LancamentosManuaisPendentes fazendaId={roleData.fazendaId} />}

          {/* Pendentes */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Observações Pendentes
              {obsPendentes.length > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5">{obsPendentes.length}</Badge>
              )}
            </h2>
            {obsPendentes.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma observação pendente.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {obsPendentes.map(obs => (
                  <ObservacaoCard
                    key={obs.id}
                    obs={obs}
                    retiros={retirosComDados}
                    onResolve={() => resolverObservacao(obs.id, gerenteNome)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Histórico */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Histórico de Observações
            </h2>
            {obsResolvidas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma observação resolvida.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {obsResolvidas.map(obs => (
                  <ObservacaoCard key={obs.id} obs={obs} retiros={retirosComDados} resolved />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== SYNC ===== */}
        <TabsContent value="sync" className="flex-1 overflow-auto p-4 mt-0">
          {roleData.fazendaId ? (
            <SyncCapatazPanel fazendaIdsScope={[roleData.fazendaId]} />
          ) : (
            <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Retiro Detail Sheet */}
      <Sheet open={!!selectedRetiro} onOpenChange={(open) => !open && setSelectedRetiro(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-auto">
          {selectedRetiro && <RetiroDetail retiro={selectedRetiro} fazendaId={activeFazendaId} />}
        </SheetContent>
      </Sheet>

      {activeFazendaId && (
        <ExportarRelatorioModal
          open={relatorioOpen}
          onOpenChange={setRelatorioOpen}
          fazendaId={activeFazendaId}
          fazendaNome={fazendaNome}
          geradoPor={nomeGerentePdf || gerenteNome}
          initialMes={mes}
          initialAno={ano}
          lockedRetiroId={activeRetiroId}
          produtoId={painelProdutoId}
        />
      )}
    </div>
  );
}

// ---- Retiro Detail ----
function RetiroDetail({ retiro, fazendaId }: { retiro: RetiroComDados; fazendaId: string | null }) {
  const navRetiro = useNavigate();
  const { mes, ano } = usePainelPeriodo();
  const { pastos: pastosLista, loading: pastosListaLoading } = usePastosRetiro(retiro.id ?? null, mes, ano);
  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle className="text-foreground">{retiro.nome}</SheetTitle>
        <p className="text-sm text-muted-foreground">Capataz: {retiro.capataz}</p>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div><p className="text-[10px] text-muted-foreground">Animais</p><p className="text-lg font-bold">{retiro.totalAnimais}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Sacos</p><p className="text-lg font-bold">{retiro.sacosUtilizados}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Consumo</p><p className="text-lg font-bold text-secondary">{fmtNum(retiro.consumoMedio, 1)}</p></div>
          <div><p className="text-[10px] text-muted-foreground">GMD</p><p className="text-lg font-bold text-primary">{fmtNum(retiro.gmd, 3)}</p></div>
        </div>
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>Intervalo definido: <strong className="text-foreground">{retiro.intervaloDefinido}d</strong></span>
          <span>Intervalo real médio: <strong className="text-foreground">{retiro.intervaloRealMedio != null ? `${retiro.intervaloRealMedio}d` : '—'}</strong></span>
        </div>
        <Button onClick={() => navRetiro(`/mapa/retiro/${retiro.id}`)} variant="outline" size="sm" className="mt-3 w-full gap-1.5">
          <Map className="w-4 h-4" /> Ver Mapa
        </Button>
      </SheetHeader>

      <PastosListaRetiro pastos={pastosLista} loading={pastosListaLoading} />

      {retiro.id && fazendaId && (
        <GerenteProdutoRetiroCard retiroId={retiro.id} retiroNome={retiro.nome} fazendaId={fazendaId} />
      )}
    </>
  );
}

// ---- Observacao Row ----
function ObservacaoCard({ obs, retiros, onResolve, resolved }: {
  obs: Observacao; retiros: RetiroComDados[];
  onResolve?: () => void; resolved?: boolean;
}) {
  const [fotoOpen, setFotoOpen] = useState(false);
  const retiro = retiros.find(r => r.id === obs.retiro_id);
  const pasto = retiro?.pastos.find(p => p.id === obs.pasto_id);
  const dataStr = obs.criado_em
    ? new Date(obs.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <>
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-card ${resolved ? "opacity-60" : ""}`}>
        {/* Thumbnail */}
        {obs.foto_url ? (
          <img
            src={obs.foto_url}
            alt=""
            className="w-10 h-10 rounded object-cover flex-shrink-0 cursor-pointer"
            onClick={() => setFotoOpen(true)}
          />
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {obs.tipo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{obs.tipo}</Badge>}
          <span className="text-xs text-muted-foreground truncate">
            {obs.capataz_nome && <span className="font-medium text-foreground">{obs.capataz_nome}</span>}
            {retiro && <span> · {retiro.nome}</span>}
            {pasto && <span> · {pasto.nome}</span>}
          </span>
          <span className="text-[10px] text-muted-foreground">{dataStr}</span>
          {resolved && obs.resolvido_por && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3 text-primary" /> {obs.resolvido_por}
            </span>
          )}
        </div>

        {/* Action */}
        {!resolved && onResolve && (
          <Button size="sm" variant="outline" onClick={onResolve} className="flex-shrink-0 text-[10px] h-7 px-2 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Resolvido
          </Button>
        )}
      </div>

      {/* Full photo modal */}
      <Dialog open={fotoOpen} onOpenChange={setFotoOpen}>
        <DialogContent className="max-w-sm p-2">
          {obs.foto_url && <img src={obs.foto_url} alt="Observação" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}