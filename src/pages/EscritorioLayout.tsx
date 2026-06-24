import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LogOut, QrCode, FileDown, Loader2, Search, Skull, MapPin, Check, Eye,
  Package, BarChart3, RefreshCw, Plus,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner } from "@/components/UpdateBanner";
import { EnableNotificationsBanner } from "@/components/EnableNotificationsBanner";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { UserNotificationToggle } from "@/components/UserNotificationToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import QrCodePrintPDF, { type QrCodePdfItem } from "@/components/QrCodePrintPDF";
import { buildFixedPages } from "@/lib/qrCodeLayout";
import { createQrCodeDataUri } from "@/lib/qrCodePdf";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";
import RelatorioSalgaPage from "@/pages/RelatorioSalgaPage";
import AdicionarEstoqueModal from "@/components/estoque/AdicionarEstoqueModal";
import EstoqueDashboard from "@/components/estoque/EstoqueDashboard";
import { useEstoqueData } from "@/hooks/useEstoqueData";

/* ─── types ─── */
interface Pasto {
  id: string;
  qr_uuid: string;
  nome: string;
  retiro_id: string;
  retiro_nome?: string;
}

interface Retiro {
  id: string;
  nome: string;
}

interface Mortalidade {
  id: string;
  quantidade: number;
  data: string;
  observacao: string | null;
  foto_url: string;
  pasto_id: string;
  pasto_nome?: string;
}

interface EstoqueItem {
  retiro_id: string;
  retiro_nome: string;
  quantidade_atual: number;
}

/* ─── helpers ─── */
const QR_PER_PAGE = 4;
const QR_PER_ROW = 2;
const PAGE_SIZE = 20;
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
        <span className="text-xl font-extrabold text-primary-foreground">C</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN LAYOUT
   ════════════════════════════════════════════════════════════════════ */
export default function EscritorioLayout() {
  const { signOut, roleData } = useAuth();
  const fazendaId = roleData.fazendaId ?? "";

  const { data: escritorioData } = useQuery({
    queryKey: ["escritorio-info", roleData.roleId],
    queryFn: async () => {
      if (!roleData.roleId) return null;
      const { data } = await supabase.from("escritorios").select("nome").eq("id", roleData.roleId).maybeSingle();
      return data;
    },
    enabled: !!roleData.roleId,
    retry: 2,
    retryDelay: 1000,
  });

  const { data: fazendaNome = "" } = useQuery({
    queryKey: ["escritorio-fazenda-nome", fazendaId],
    queryFn: async () => {
      if (!fazendaId) return "";
      const { data } = await supabase.from("fazendas").select("nome").eq("id", fazendaId).maybeSingle();
      return data?.nome ?? "";
    },
    enabled: !!fazendaId,
    retry: 2,
    retryDelay: 1000,
  });

  /* mortality unread count */
  const queryClient = useQueryClient();
  const { data: mortalidadeCount = 0 } = useQuery({
    queryKey: ["escritorio-mortalidade-count", fazendaId],
    queryFn: async () => {
      if (!fazendaId) return 0;
      const { data } = await supabase
        .from("notificacoes")
        .select("id, dados")
        .eq("tipo", "mortalidade")
        .eq("lida", false);
      return (data || []).filter((n: any) => (n.dados as any)?.fazenda_id === fazendaId).length;
    },
    enabled: !!fazendaId,
    retry: 2,
    retryDelay: 1000,
  });

  /* realtime: mortalidades + notificacoes */
  useEffect(() => {
    if (!fazendaId) return;
    const ch = supabase
      .channel(`esc-realtime-${fazendaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mortalidades" }, () => {
        queryClient.invalidateQueries({ queryKey: ["escritorio-mortalidades"] });
        queryClient.invalidateQueries({ queryKey: ["escritorio-mortalidade-count"] });
        queryClient.invalidateQueries({ queryKey: ["escritorio-notif-mortalidade"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["escritorio-mortalidade-count"] });
        queryClient.invalidateQueries({ queryKey: ["escritorio-notif-mortalidade"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["escritorio-retiros"] });
        queryClient.invalidateQueries({ queryKey: ["escritorio-pastos-search"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_retiro" }, () => {
        queryClient.invalidateQueries({ queryKey: ["escritorio-estoque"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes_estoque" }, () => {
        queryClient.invalidateQueries({ queryKey: ["escritorio-estoque"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fazendaId, queryClient]);

  const [activeTab, setActiveTab] = useState("relatorios");

  if (!fazendaId) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UpdateBanner />
      <EnableNotificationsBanner />
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
            <Button variant="ghost" size="icon" onClick={() => {
              queryClient.invalidateQueries();
              window.location.reload();
            }} className="text-primary-foreground hover:bg-primary/80" title="Atualizar dados">
              <RefreshCw className="w-4 h-4" />
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

      {/* Tabs – 4 modules */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-card h-10 flex-shrink-0">
          <TabsTrigger value="relatorios" className="text-[10px] sm:text-xs data-[state=active]:text-primary gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="qrcodes" className="text-[10px] sm:text-xs data-[state=active]:text-primary gap-1">
            <QrCode className="w-3.5 h-3.5" /> QR Codes
          </TabsTrigger>
          <TabsTrigger value="estoque" className="text-[10px] sm:text-xs data-[state=active]:text-primary gap-1">
            <Package className="w-3.5 h-3.5" /> Estoque
          </TabsTrigger>
          <TabsTrigger value="mortalidade" className="text-[10px] sm:text-xs data-[state=active]:text-primary gap-1 relative">
            <Skull className="w-3.5 h-3.5" /> Alertas
            {mortalidadeCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
                {mortalidadeCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="flex-1 overflow-auto p-4 mt-0">
          <EscritorioRelatorios fazendaId={fazendaId} fazendaNome={fazendaNome} escritorioNome={escritorioData?.nome ?? "Escritório"} />
        </TabsContent>
        <TabsContent value="qrcodes" className="flex-1 overflow-auto p-4 mt-0">
          <EscritorioQrCodes fazendaId={fazendaId} />
        </TabsContent>
        <TabsContent value="estoque" className="flex-1 overflow-auto p-4 mt-0">
          <EscritorioEstoque fazendaId={fazendaId} />
        </TabsContent>
        <TabsContent value="mortalidade" className="flex-1 overflow-auto p-4 mt-0">
          <EscritorioMortalidade fazendaId={fazendaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RELATÓRIOS SECTION
   ════════════════════════════════════════════════════════════════════ */
function EscritorioRelatorios({ fazendaId, fazendaNome, escritorioNome }: { fazendaId: string; fazendaNome: string; escritorioNome: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [salgaOpen, setSalgaOpen] = useState(false);

  if (salgaOpen) {
    return (
      <RelatorioSalgaPage
        onBack={() => setSalgaOpen(false)}
        fazendaId={fazendaId}
        fazendaNome={fazendaNome}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> Relatórios da Fazenda
      </h2>

      <Button className="w-full gap-2" onClick={() => setModalOpen(true)}>
        <FileDown className="w-4 h-4" /> Gerar Relatório de Consumo
      </Button>

      <Button className="w-full gap-2" variant="outline" onClick={() => setSalgaOpen(true)}>
        <FileDown className="w-4 h-4" /> Relatório de Salga
      </Button>

      <ExportarRelatorioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        fazendaId={fazendaId}
        fazendaNome={fazendaNome}
        geradoPor={escritorioNome}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   QR CODES SECTION
   ════════════════════════════════════════════════════════════════════ */
function EscritorioQrCodes({ fazendaId }: { fazendaId: string }) {
  const [selectedRetiro, setSelectedRetiro] = useState("");
  const [generatedPastos, setGeneratedPastos] = useState<Pasto[]>([]);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Pasto[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const qrPages = buildFixedPages(generatedPastos, QR_PER_PAGE);

  const { data: retiros = [] } = useQuery({
    queryKey: ["escritorio-retiros", fazendaId],
    queryFn: async () => {
      const { data } = await supabase.from("retiros").select("id, nome").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome");
      return (data || []) as Retiro[];
    },
    enabled: !!fazendaId,
    retry: 2,
    retryDelay: 1000,
  });

  const retiroIds = useMemo(() => retiros.map((r) => r.id), [retiros]);
  const retiroMap = useMemo(() => new Map(retiros.map((r) => [r.id, r.nome])), [retiros]);

  const enrichPastos = useCallback(
    (pastos: { id: string; qr_uuid: string; nome: string; retiro_id: string }[]): Pasto[] =>
      pastos.map((p) => ({ ...p, retiro_nome: retiroMap.get(p.retiro_id) ?? "—" })),
    [retiroMap],
  );

  const searchPastos = useCallback(
    async (term: string, page: number, append: boolean) => {
      if (retiroIds.length === 0) { setSearchResults([]); return; }
      setSearching(true);
      let query = supabase
        .from("pastos").select("id, qr_uuid, nome, retiro_id")
        .in("retiro_id", retiroIds).eq("ativo", true).order("nome")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (term.trim()) query = query.ilike("nome", `%${term.trim()}%`);
      const { data } = await query;
      const enriched = enrichPastos(data || []);
      if (append) setSearchResults((prev) => [...prev, ...enriched]);
      else setSearchResults(enriched);
      setHasMore((data || []).length === PAGE_SIZE);
      setSearching(false);
    },
    [retiroIds, enrichPastos],
  );

  useEffect(() => {
    if (retiroIds.length > 0) { setSearchPage(0); searchPastos(searchTerm, 0, false); }
  }, [searchTerm, searchPastos, retiroIds]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !searching) {
        const next = searchPage + 1;
        setSearchPage(next);
        searchPastos(searchTerm, next, true);
      }
    });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, searching, searchPage, searchTerm, searchPastos]);

  async function generateByRetiro(retiroId: string) {
    setGenerating(true);
    try {
      const { data } = await supabase.from("pastos").select("id, qr_uuid, nome, retiro_id").eq("retiro_id", retiroId).eq("ativo", true).order("nome");
      setGeneratedPastos(enrichPastos(data || []));
    } finally { setGenerating(false); }
  }

  async function generateAll() {
    if (retiroIds.length === 0) return;
    setGenerating(true);
    try {
      const { data } = await supabase.from("pastos").select("id, qr_uuid, nome, retiro_id").in("retiro_id", retiroIds).eq("ativo", true).order("nome");
      setGeneratedPastos(enrichPastos(data || []));
    } finally { setGenerating(false); }
  }

  async function handleExportPdf() {
    if (generatedPastos.length === 0) return;
    setExportingPdf(true);
    try {
      const items: QrCodePdfItem[] = [];
      for (const p of generatedPastos) {
        const qrDataUri = await createQrCodeDataUri(p.qr_uuid);
        items.push({ id: p.id, qrDataUri, nome: p.nome, retiro_nome: p.retiro_nome });
      }
      const blob = await pdf(<QrCodePrintPDF items={items} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-codes-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar o PDF.");
    } finally { setExportingPdf(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">QR Codes da Fazenda</h2>
        {generatedPastos.length > 0 && (
          <Button size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
            PDF ({generatedPastos.length})
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Select value={selectedRetiro} onValueChange={setSelectedRetiro}>
          <SelectTrigger><SelectValue placeholder="Filtrar por retiro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os retiros</SelectItem>
            {retiros.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="w-full" onClick={() => (selectedRetiro && selectedRetiro !== "__all__") ? generateByRetiro(selectedRetiro) : generateAll()} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
          Gerar QR Codes
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar pasto por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y rounded-md border">
        {searchResults.map((p) => (
          <button key={p.id} onClick={() => setGeneratedPastos([p])} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-accent/50">
            <div>
              <p className="font-medium text-sm text-foreground">{p.nome}</p>
              <p className="text-xs text-muted-foreground">{p.retiro_nome}</p>
            </div>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        {searchResults.length === 0 && !searching && (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum pasto encontrado</p>
        )}
        <div ref={loadMoreRef} className="h-1" />
        {searching && <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      </div>

      {generatedPastos.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{generatedPastos.length} QR Code{generatedPastos.length > 1 ? "s" : ""}</p>
          {qrPages.map((page, pi) => (
            <section key={pi} className="mx-auto flex aspect-[210/297] w-full max-w-[820px] flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
              {[0, 1].map((ri) => {
                const items = page.slice(ri * QR_PER_ROW, ri * QR_PER_ROW + QR_PER_ROW);
                return (
                  <div key={ri} className="flex min-h-0 flex-1 gap-4">
                    {items.map((pasto, ci) => (
                      <div key={ci} className="min-h-0 min-w-0 flex-1">
                        {pasto ? (
                          <div className="flex h-full flex-col items-center justify-center rounded-xl border bg-card px-4 py-5 text-center shadow-sm">
                            <QRCodeSVG value={pasto.qr_uuid} size={140} level="H" includeMargin className="mb-4" />
                            <p className="break-words text-base font-bold leading-tight text-foreground">{pasto.nome}</p>
                            <p className="mt-1 break-words text-sm leading-tight text-muted-foreground">{pasto.retiro_nome}</p>
                          </div>
                        ) : (
                          <div className="h-full rounded-xl border border-dashed border-border bg-muted/30" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ESTOQUE SECTION (COM LANÇAMENTO + DIAS RESTANTES)
   ════════════════════════════════════════════════════════════════════ */
function EscritorioEstoque({ fazendaId }: { fazendaId: string }) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { estoques, transferencias, loading, adicionarEstoque } = useEstoqueData(fazendaId, mes, ano);

  const retiros = useMemo(() => estoques.map(e => ({ id: e.retiro_id, nome: e.retiro_nome })), [estoques]);

  // Escritório não aprova/recusa transferências — funções vazias
  const noop = async () => {};

  return (
    <EstoqueDashboard
      estoques={estoques}
      transferencias={transferencias}
      retiros={retiros}
      onAdicionarEstoque={adicionarEstoque}
      onAprovar={noop}
      onRecusar={noop}
      loading={loading}
      hideTransferActions
    />
  );
}

/* ════════════════════════════════════════════════════════════════════
   MORTALIDADE SECTION
   ════════════════════════════════════════════════════════════════════ */
function EscritorioMortalidade({ fazendaId }: { fazendaId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Mortalidade | null>(null);

  const { data: mortalidades = [], isLoading } = useQuery({
    queryKey: ["escritorio-mortalidades", fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];
      const { data } = await supabase
        .from("mortalidades")
        .select("id, quantidade, data, observacao, foto_url, pasto_id")
        .eq("fazenda_id", fazendaId)
        .neq("foto_url", "")
        .order("data", { ascending: false })
        .limit(100);

      if (!data || data.length === 0) return [];
      const pastoIds = [...new Set(data.map((m) => m.pasto_id))];
      const { data: pastos } = await supabase.from("pastos").select("id, nome").in("id", pastoIds);
      const pastoMap = new Map((pastos || []).map((p) => [p.id, p.nome]));
      return data.map((m) => ({ ...m, pasto_nome: pastoMap.get(m.pasto_id) ?? "—" })) as Mortalidade[];
    },
    enabled: !!fazendaId,
    retry: 2,
    retryDelay: 1000,
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["escritorio-notif-mortalidade", fazendaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("id, lida, criado_em, dados")
        .eq("tipo", "mortalidade")
        .eq("lida", false)
        .order("criado_em", { ascending: false });
      return (data || []).filter((n: any) => {
        const d = n.dados as Record<string, any> | null;
        return d?.fazenda_id === fazendaId;
      });
    },
    enabled: !!fazendaId,
    retry: 2,
    retryDelay: 1000,
  });

  const marcarLida = async (notifId: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", notifId);
    queryClient.invalidateQueries({ queryKey: ["escritorio-notif-mortalidade"] });
    queryClient.invalidateQueries({ queryKey: ["escritorio-mortalidade-count"] });
  };

  const marcarTodasLidas = async () => {
    const ids = notificacoes.map((n: any) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["escritorio-notif-mortalidade"] });
    queryClient.invalidateQueries({ queryKey: ["escritorio-mortalidade-count"] });
    toast.success("Todas marcadas como lidas");
  };

  // Show empty message if no data
  if (!isLoading && mortalidades.length === 0 && notificacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Skull className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum alerta de mortalidade para a fazenda</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      {notificacoes.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Skull className="w-4 h-4 text-destructive" /> {notificacoes.length} alerta{notificacoes.length > 1 ? "s" : ""} não lido{notificacoes.length > 1 ? "s" : ""}
          </h2>
          <Button variant="ghost" size="sm" className="text-xs" onClick={marcarTodasLidas}>
            <Check className="w-3 h-3 mr-1" /> Marcar todas lidas
          </Button>
        </div>
      )}

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Registros de Mortalidade</h2>
      {mortalidades.map((m) => {
        const relatedNotif = notificacoes.find((n: any) => {
          const d = n.dados as Record<string, any> | null;
          return d?.pasto_id === m.pasto_id;
        });
        return (
          <Card key={m.id} className={`cursor-pointer hover:shadow-md transition-shadow ${relatedNotif ? "border-destructive/50 bg-destructive/5" : ""}`} onClick={() => setSelected(m)}>
            <CardContent className="p-3 flex items-center gap-3">
              <img src={m.foto_url} alt="Mortalidade" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{m.pasto_nome}</p>
                  {relatedNotif && <Badge variant="destructive" className="text-[9px] h-4">Novo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{m.quantidade} animal{m.quantidade > 1 ? "is" : ""} • {format(new Date(m.data), "dd/MM/yyyy")}</p>
                {m.observacao && <p className="text-xs text-muted-foreground truncate mt-0.5">{m.observacao}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {relatedNotif && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); marcarLida(relatedNotif.id); }} title="Marcar como lida">
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Eye className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Skull className="w-5 h-5 text-destructive" /> Mortalidade</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <img src={selected.foto_url} alt="Foto mortalidade" className="w-full rounded-lg object-cover max-h-64" />
              <div className="space-y-2 text-sm">
                <div><strong>Data:</strong> {format(new Date(selected.data), "dd/MM/yyyy HH:mm")}</div>
                <div><strong>Pasto:</strong> {selected.pasto_nome}</div>
                <div><strong>Quantidade:</strong> {selected.quantidade} animal{selected.quantidade > 1 ? "is" : ""}</div>
                {selected.observacao && <div><strong>Observação:</strong> {selected.observacao}</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
