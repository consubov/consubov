import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import { useGerenteData, type GerenteFilters } from "@/hooks/useGerenteData";
import { useAbatesData } from "@/hooks/useAbatesData";
import { useMortalidadesData } from "@/hooks/useMortalidadesData";
import { useEstoqueData } from "@/hooks/useEstoqueData";
import EstoqueDashboard from "@/components/estoque/EstoqueDashboard";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import MonthScroller from "@/components/MonthScroller";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LogOut, Beef, Droplets, Target, Package, DollarSign,
  TrendingUp, ChevronRight, RefreshCw, BarChart3, FileDown,
  Skull, AlertTriangle, MapPin, Bell,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

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

export default function EscritorioLayout() {
  const { signOut, user, roleData } = useAuth();
  const navigate = useNavigate();
  const { mes, ano, setPeriodo } = usePainelPeriodo();

  const filters = useMemo<GerenteFilters>(() => ({
    ano, mes, cicloStatus: 'todos',
  }), [ano, mes]);

  // Fetch escritorio name
  const { data: escritorioData } = useQuery({
    queryKey: ["escritorio-info", roleData.roleId],
    queryFn: async () => {
      if (!roleData.roleId) return null;
      const { data } = await supabase.from("escritorios").select("nome").eq("id", roleData.roleId).maybeSingle();
      return data;
    },
    enabled: !!roleData.roleId,
  });

  const {
    loading, fazendaNome, painelData, retirosComDados, lancamentos,
    refresh,
  } = useGerenteData(filters);

  const { abatidosMes, abatidosAno } = useAbatesData(roleData.fazendaId ?? undefined, mes, ano);
  const { mortalidadesAno } = useMortalidadesData(roleData.fazendaId ?? undefined, ano);
  const {
    estoques, transferencias, loading: estoqueLoading,
    adicionarEstoque,
  } = useEstoqueData(roleData.fazendaId, mes, ano);

  const retirosList = useMemo(() => retirosComDados.map(r => ({ id: r.id!, nome: r.nome })).filter(r => r.id), [retirosComDados]);

  // Notifications count
  const { data: notifCount = 0 } = useQuery({
    queryKey: ["escritorio-notif-count"],
    queryFn: async () => {
      const { count } = await supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", false);
      return count ?? 0;
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("painel");

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleOpenRetiro = (retiroId?: string) => {
    if (!user) { toast.error("Sessão expirou."); return; }
    if (!retiroId) { toast.error("Retiro inválido."); return; }
    navigate(`/dashboard/retiro/${retiroId}?mes=${mes}&ano=${ano}`);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UpdateBanner />
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoConsubov} alt="Consubov" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-base font-bold leading-tight">Escritório</h1>
              <p className="text-xs opacity-80 truncate max-w-[180px]">{escritorioData?.nome ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setRelatorioOpen(true)} className="text-primary-foreground hover:bg-primary/80">
              <FileDown className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-primary-foreground hover:bg-primary/80" disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs opacity-90">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{fazendaNome}</span>
        </div>
      </header>

      {/* Month Scroller */}
      <div className="bg-card border-b px-2 py-2 flex-shrink-0">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(m, y) => setPeriodo(m, y)} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 rounded-none border-b bg-card h-10 flex-shrink-0">
          <TabsTrigger value="painel" className="text-xs data-[state=active]:text-primary">Painel</TabsTrigger>
          <TabsTrigger value="retiros" className="text-xs data-[state=active]:text-primary">Retiros</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs data-[state=active]:text-primary">Estoque</TabsTrigger>
          <TabsTrigger value="relatorios" className="text-xs data-[state=active]:text-primary">Relatórios</TabsTrigger>
          <TabsTrigger value="notificacoes" className="text-xs data-[state=active]:text-primary relative">
            Alertas
            {notifCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
                {notifCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* PAINEL */}
        <TabsContent value="painel" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Painel da Fazenda</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={Beef} label="Total Animais" value={fmtNum(painelData.totalAnimais)} />
            <MetricCard icon={Droplets} label="Consumo Médio" value={`${fmtNum(painelData.consumoMedio, 1)}`} sub="g/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={Target} label="Pastos na Meta" value={`${painelData.pastosNaMeta}/${painelData.totalPastos}`} iconColor="text-secondary" />
            <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(painelData.sacosUtilizados)} />
            <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(painelData.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(painelData.custoMensal)} />
            <MetricCard icon={BarChart3} label="Eficiência" value={`${fmtNum(painelData.eficiencia, 0)}%`} iconColor="text-secondary" />
            <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(painelData.gmdMedio, 3)} sub="kg/dia" />
            <MetricCard icon={Skull} label="Abatidos (mês)" value={fmtNum(abatidosMes)} iconColor="text-destructive" />
            <MetricCard icon={Skull} label="Abatidos (ano)" value={fmtNum(abatidosAno)} iconColor="text-destructive" />
            <MetricCard icon={AlertTriangle} label={`Mortalidade (${ano})`} value={fmtNum(mortalidadesAno)} iconColor="text-destructive" />
          </div>
        </TabsContent>

        {/* RETIROS */}
        <TabsContent value="retiros" className="flex-1 overflow-auto p-4 space-y-3 mt-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Retiros</h2>
          {retirosComDados.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum retiro encontrado.</p>
          ) : (
            retirosComDados.map(r => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleOpenRetiro(r.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">{r.capataz}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ESTOQUE - can add but not approve transfers */}
        <TabsContent value="estoque" className="flex-1 overflow-auto p-4 mt-0">
          <EstoqueDashboard
            estoques={estoques}
            transferencias={[]}
            retiros={retirosList}
            onAdicionarEstoque={adicionarEstoque}
            onAprovar={async () => {}}
            onRecusar={async () => {}}
            loading={estoqueLoading}
          />
        </TabsContent>

        {/* RELATÓRIOS */}
        <TabsContent value="relatorios" className="flex-1 overflow-auto p-4 mt-0">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Relatórios</h2>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRelatorioOpen(true)}>
              <CardContent className="p-4 flex items-center gap-3">
                <FileDown className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Exportar Relatório</p>
                  <p className="text-xs text-muted-foreground">Gerar PDF com dados de consumo, lote e animais</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="flex-1 overflow-auto p-4 mt-0">
          <EscritorioNotificacoes />
        </TabsContent>
      </Tabs>

      {relatorioOpen && (
        <ExportarRelatorioModal
          open={relatorioOpen}
          onOpenChange={setRelatorioOpen}
          fazendaId={roleData.fazendaId ?? ""}
          lancamentos={lancamentos}
          retirosComDados={retirosComDados}
          fazendaNome={fazendaNome}
          mes={mes}
          ano={ano}
        />
      )}
    </div>
  );
}

function EscritorioNotificacoes() {
  const { data: notificacoes = [], refetch } = useQuery({
    queryKey: ["escritorio-notificacoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const marcarLida = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Bell className="w-4 h-4" /> Notificações
      </h2>
      {notificacoes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhuma notificação.</p>
      ) : (
        notificacoes.map((n: any) => (
          <Card key={n.id} className={`${n.lida ? "opacity-60" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{n.titulo}</p>
                  {n.mensagem && <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.criado_em).toLocaleDateString("pt-BR")} {new Date(n.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.lida && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => marcarLida(n.id)}>
                    Marcar lida
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
