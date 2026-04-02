import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGerenteData, type RetiroComDados, type Observacao, type AlertaAtraso } from "@/hooks/useGerenteData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LogOut, Beef, Droplets, Target, Package, DollarSign,
  TrendingUp, Award, ChevronRight, Bell, CheckCircle2,
  Clock, MapPin, TreePine, RefreshCw, BarChart3, Eye, AlertTriangle,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";

const MES_NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

function scoreColor(score: number) {
  if (score >= 7) return "text-primary font-bold";
  if (score >= 4) return "text-secondary font-bold";
  return "text-destructive font-bold";
}

export default function GerenteDashboard() {
  const { signOut } = useAuth();
  const {
    loading, gerenteNome, fazendaNome, ciclo, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh,
    alertasAtraso, intervaloDefinido,
  } = useGerenteData();

  const [selectedRetiro, setSelectedRetiro] = useState<RetiroComDados | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cicloLabel = ciclo ? `${MES_NOMES[ciclo.mes - 1]}/${ciclo.ano}` : "—";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
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
              <h1 className="text-base font-bold leading-tight">Gerente</h1>
              <p className="text-xs opacity-80 truncate max-w-[180px]">{gerenteNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
          <span className="opacity-60">·</span>
          <span>Ciclo {cicloLabel}</span>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="painel" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-card h-10 flex-shrink-0">
          <TabsTrigger value="painel" className="text-xs data-[state=active]:text-primary">Painel</TabsTrigger>
          <TabsTrigger value="retiros" className="text-xs data-[state=active]:text-primary">Retiros</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs data-[state=active]:text-primary">Ranking</TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs data-[state=active]:text-primary relative">
            Alertas
            {(obsPendentes.length + alertasAtraso.length) > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
                {obsPendentes.length + alertasAtraso.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== PAINEL ===== */}
        <TabsContent value="painel" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Painel da Fazenda</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={Beef} label="Total Animais" value={fmtNum(painelData.totalAnimais)} />
            <MetricCard icon={Droplets} label="Consumo Médio" value={`${fmtNum(painelData.consumoMedio, 1)}`} sub="g/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={Target} label="Pastos na Meta" value={`${painelData.pastosNaMeta}/${painelData.totalPastos}`} iconColor="text-secondary" />
            <MetricCard icon={Package} label="Sacos Utilizados" value={fmtNum(painelData.sacosUtilizados)} />
            <MetricCard icon={DollarSign} label="Custo Diário" value={fmtBRL(painelData.custoDiario)} sub="R$/cab/dia" iconColor="text-secondary" />
            <MetricCard icon={DollarSign} label="Custo Mensal" value={fmtBRL(painelData.custoMensal)} />
            <MetricCard icon={BarChart3} label="Eficiência Geral" value={`${fmtNum(painelData.eficiencia, 0)}%`} iconColor="text-secondary" />
            <MetricCard icon={TrendingUp} label="GMD Médio" value={fmtNum(painelData.gmdMedio, 3)} sub="kg/dia" />
          </div>
        </TabsContent>

        {/* ===== RETIROS ===== */}
        <TabsContent value="retiros" className="flex-1 overflow-auto p-4 space-y-3 mt-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Retiros</h2>
          {retirosComDados.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum retiro ativo encontrado.</p>
          ) : (
            retirosComDados.map(r => (
              <Card key={r.id} className={`cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] ${r.alertaAtraso ? 'border-destructive/50' : ''}`} onClick={() => setSelectedRetiro(r)}>
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
                </CardContent>
              </Card>
            ))
          )}
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
                    {capatazScores.map((s, i) => (
                      <TableRow key={s.retiro}>
                        <TableCell className="text-center font-semibold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">{s.retiro}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.capataz}</TableCell>
                        <TableCell className={`text-right ${scoreColor(s.score)}`}>{fmtNum(s.score, 1)}</TableCell>
                      </TableRow>
                    ))}
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
      </Tabs>

      {/* Retiro Detail Sheet */}
      <Sheet open={!!selectedRetiro} onOpenChange={(open) => !open && setSelectedRetiro(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-auto">
          {selectedRetiro && (
            <RetiroDetail retiro={selectedRetiro} lancamentos={lancamentos} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---- Retiro Detail ----
function RetiroDetail({ retiro, lancamentos }: { retiro: RetiroComDados; lancamentos: any[] }) {
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
      </SheetHeader>

      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <TreePine className="w-4 h-4" /> Pastos ({retiro.pastos.length})
      </h3>

      <div className="space-y-2">
        {retiro.pastos.map(p => {
          const pLanc = lancamentos.filter((l: any) => l.pasto_id === p.id);
          const totalSacos = pLanc.reduce((s: number, l: any) => s + (l.num_sacos || 0), 0);
          const sortedLanc = [...pLanc].sort((a: any, b: any) => new Date(b.lancado_em ?? 0).getTime() - new Date(a.lancado_em ?? 0).getTime());
          const lastLanc = sortedLanc[0];
          const latestConsumo = sortedLanc.find((l: any) => l.status_consumo);

          const consumoBadgeConfig: Record<string, { emoji: string; className: string }> = {
            ABAIXO: { emoji: '🔴', className: 'bg-destructive text-destructive-foreground' },
            IDEAL: { emoji: '🟢', className: 'bg-primary text-primary-foreground' },
            ACIMA: { emoji: '🟡', className: 'bg-yellow-500 text-yellow-950' },
            ERRO: { emoji: '⚠️', className: 'bg-muted text-muted-foreground' },
          };
          const cb = latestConsumo?.status_consumo ? consumoBadgeConfig[latestConsumo.status_consumo] : null;

          return (
            <Card key={p.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{p.nome}</p>
                  <div className="flex items-center gap-1.5">
                    {cb && (
                      <Badge className={`text-[10px] px-1.5 py-0 h-5 ${cb.className}`}>
                        {cb.emoji} {latestConsumo.status_consumo} {latestConsumo.indice_consumo != null ? `(${Number(latestConsumo.indice_consumo).toFixed(2)})` : ''}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{p.num_animais} cab</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Sacos</p>
                    <p className="font-bold">{totalSacos}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Consumo</p>
                    <p className="font-bold text-secondary">
                      {lastLanc?.consumo_g_cab_dia != null ? fmtNum(Number(lastLanc.consumo_g_cab_dia), 1) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GMD</p>
                    <p className="font-bold text-primary">
                      {p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0 ? fmtNum(Number(p.gmd_kg_dia), 3) : "—"}
                    </p>
                  </div>
                </div>
                {lastLanc && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Último: {lastLanc.lancado_em ? new Date(lastLanc.lancado_em).toLocaleDateString("pt-BR") : "—"}
                    {lastLanc.capataz_nome ? ` · ${lastLanc.capataz_nome}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
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