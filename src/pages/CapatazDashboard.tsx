import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, QrCode, RefreshCw, Lock, Loader2, CheckCircle2, ScanLine, ArrowLeft, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import PastoCard from "@/components/capataz/PastoCard";
import QrScanner from "@/components/capataz/QrScanner";
import SalgaForm, { type SalgaFormDraft } from "@/components/capataz/SalgaForm";
import {
  cachePastos, cacheRetiro, cacheCiclos, getCachedPastos, getCachedRetiro,
  getCachedCiclos,
  saveLancamento, getAllLancamentos, getLancamentosPendentes, markSincronizado, deleteLancamento,
  getPastoByQr, setConfig, getConfig,
  type PastoCache, type RetiroCache, type CicloCache, type LancamentoOffline,
} from "@/lib/offlineDb";

type Screen = 'home' | 'prep' | 'salga' | 'scanner' | 'form' | 'manual-select' | 'syncing';
type RestorableScreen = 'home' | 'salga' | 'scanner' | 'form' | 'manual-select';

interface PersistedCapatazState {
  screen: RestorableScreen;
  salgaCount: number;
  manualJustificativa: string;
  manualPastoId: string;
  formPastoId: string;
  formPastoNome: string;
  formTipo: 'salga' | 'falha_qr';
  formJustificativa?: string;
  formAuditoriaExigida: boolean;
  formDraft: SalgaFormDraft | null;
}

function isSameLocalDay(dateIso: string, reference = new Date()) {
  const date = new Date(dateIso);

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function buildSacosMap(lancamentos: LancamentoOffline[], cicloId?: string) {
  return lancamentos.reduce<Record<string, number>>((acc, lancamento) => {
    if (cicloId && lancamento.ciclo_id !== cicloId) return acc;

    acc[lancamento.pasto_id] = (acc[lancamento.pasto_id] || 0) + lancamento.sacos;
    return acc;
  }, {});
}

export default function CapatazDashboard() {
  const { signOut, roleData, user } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [pastos, setPastos] = useState<PastoCache[]>([]);
  const [retiro, setRetiro] = useState<RetiroCache | null>(null);
  const [ciclos, setCiclos] = useState<CicloCache[]>([]);
  const [selectedCicloId, setSelectedCicloId] = useState<string>("");
  const [lancamentosHoje, setLancamentosHoje] = useState<LancamentoOffline[]>([]);
  const [sacosMap, setSacosMap] = useState<Record<string, number>>({});
  const [prepStatus, setPrepStatus] = useState<'loading' | 'done'>('loading');
  const [salgaCount, setSalgaCount] = useState(0); // for audit photo logic
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [pendingCount, setPendingCount] = useState(0);

  // For manual select on QR fail
  const [manualJustificativa, setManualJustificativa] = useState("");
  const [manualPastoId, setManualPastoId] = useState("");

  // For form
  const [formPastoId, setFormPastoId] = useState("");
  const [formPastoNome, setFormPastoNome] = useState("");
  const [formTipo, setFormTipo] = useState<'salga' | 'falha_qr'>('salga');
  const [formJustificativa, setFormJustificativa] = useState<string | undefined>();
  const [formAuditoriaExigida, setFormAuditoriaExigida] = useState(false);
  const [formDraft, setFormDraft] = useState<SalgaFormDraft | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [uiStateReady, setUiStateReady] = useState(false);
  const uiStateRestoredRef = useRef(false);

  const userName = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Capataz';

  const applyLancamentosState = useCallback((allLancamentos: LancamentoOffline[], pendingCountValue: number, cicloId?: string) => {
    setLancamentosHoje(allLancamentos.filter((lancamento) => isSameLocalDay(lancamento.data)));
    setSacosMap(buildSacosMap(allLancamentos, cicloId));
    setPendingCount(pendingCountValue);
  }, []);

  const refreshLancamentosState = useCallback(async (cicloId?: string) => {
    const [allLancamentos, pendentes] = await Promise.all([
      getAllLancamentos(),
      getLancamentosPendentes(),
    ]);

    applyLancamentosState(allLancamentos, pendentes.length, cicloId ?? selectedCicloId);
  }, [applyLancamentosState, selectedCicloId]);

  const restoreUiState = useCallback((savedState: string | undefined, cachedPastos: PastoCache[]) => {
    if (!savedState) return;

    try {
      const parsed = JSON.parse(savedState) as Partial<PersistedCapatazState>;
      const nextScreen: RestorableScreen = parsed.screen === 'salga' || parsed.screen === 'scanner' || parsed.screen === 'form' || parsed.screen === 'manual-select'
        ? parsed.screen
        : 'home';

      setSalgaCount(parsed.salgaCount ?? 0);
      setManualJustificativa(parsed.manualJustificativa ?? "");
      setManualPastoId(
        parsed.manualPastoId && cachedPastos.some((p) => p.id === parsed.manualPastoId)
          ? parsed.manualPastoId
          : ""
      );

      if (nextScreen === 'form' && parsed.formPastoId) {
        const savedPasto = cachedPastos.find((p) => p.id === parsed.formPastoId);
        if (savedPasto) {
          setFormPastoId(savedPasto.id);
          setFormPastoNome(parsed.formPastoNome || savedPasto.nome);
          setFormTipo(parsed.formTipo === 'falha_qr' ? 'falha_qr' : 'salga');
          setFormJustificativa(parsed.formJustificativa);
          setFormAuditoriaExigida(Boolean(parsed.formAuditoriaExigida));
          setFormDraft(parsed.formDraft ?? null);
          setScreen('form');
          return;
        }
      }

      setFormPastoId("");
      setFormPastoNome("");
      setFormTipo('salga');
      setFormJustificativa(undefined);
      setFormAuditoriaExigida(false);
      setFormDraft(null);
      setScreen(nextScreen);
    } catch {
      setScreen('home');
    }
  }, []);

  const persistUiState = useCallback(async () => {
    const persistedScreen: RestorableScreen = screen === 'salga' || screen === 'scanner' || screen === 'form' || screen === 'manual-select'
      ? screen
      : 'home';

    const uiState: PersistedCapatazState = {
      screen: persistedScreen,
      salgaCount,
      manualJustificativa,
      manualPastoId,
      formPastoId,
      formPastoNome,
      formTipo,
      formJustificativa,
      formAuditoriaExigida,
      formDraft,
    };

    await setConfig('capatazUiState', JSON.stringify(uiState));
  }, [formAuditoriaExigida, formDraft, formJustificativa, formPastoId, formPastoNome, formTipo, manualJustificativa, manualPastoId, salgaCount, screen]);

  // Load data from cache on mount
  const loadLocalData = useCallback(async () => {
    const [cachedPastos, cachedRetiro, cachedCiclos, allLancamentos, pendentes, savedCiclo, savedUiState] = await Promise.all([
      getCachedPastos(),
      getCachedRetiro(),
      getCachedCiclos(),
      getAllLancamentos(),
      getLancamentosPendentes(),
      getConfig('selectedCicloId'),
      getConfig('capatazUiState'),
    ]);
    setPastos(cachedPastos);
    setRetiro(cachedRetiro || null);
    setCiclos(cachedCiclos);

    let nextCicloId = "";
    if (savedCiclo && cachedCiclos.some(c => c.id === savedCiclo)) {
      nextCicloId = savedCiclo;
    } else if (cachedCiclos.length > 0) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentCiclo = cachedCiclos.find(c => c.mes === currentMonth && c.ano === currentYear && !c.fechado);
      const active = currentCiclo || cachedCiclos.find(c => !c.fechado) || cachedCiclos[0];
      nextCicloId = active.id;
    }

    setSelectedCicloId(nextCicloId);
    applyLancamentosState(allLancamentos, pendentes.length, nextCicloId);

    if (!uiStateRestoredRef.current) {
      restoreUiState(savedUiState, cachedPastos);
      uiStateRestoredRef.current = true;
    }

    setUiStateReady(true);
  }, [applyLancamentosState, restoreUiState]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    if (!uiStateReady) return;

    const timer = window.setTimeout(() => {
      void persistUiState();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [persistUiState, uiStateReady]);

  useEffect(() => {
    if (!uiStateReady) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void persistUiState();
        return;
      }

      void loadLocalData();
    };

    const handlePageHide = () => {
      void persistUiState();
    };

    const handlePageShow = () => {
      void loadLocalData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [loadLocalData, persistUiState, uiStateReady]);

  useEffect(() => {
    if (!uiStateReady) return;
    void refreshLancamentosState(selectedCicloId);
  }, [refreshLancamentosState, selectedCicloId, uiStateReady]);

  const loadFromSupabase = useCallback(async () => {
    try {
      // Get retiro + fazenda
      const { data: retiroData } = await supabase
        .from("retiros")
        .select("id, nome, fazenda_id")
        .eq("id", roleData.retiroId!)
        .maybeSingle();

      if (retiroData) {
        const { data: fazenda } = await supabase
          .from("fazendas")
          .select("nome")
          .eq("id", retiroData.fazenda_id)
          .maybeSingle();

        const retiroCache: RetiroCache = {
          id: retiroData.id,
          nome: retiroData.nome,
          fazenda_nome: fazenda?.nome || '',
        };
        await cacheRetiro(retiroCache);
        setRetiro(retiroCache);

        // Get pastos
        const { data: pastosData } = await supabase
          .from("pastos")
          .select("id, nome, num_animais, peso_medio_kg, dias_no_pasto, qr_uuid, produto_id, sexo, categoria")
          .eq("retiro_id", retiroData.id)
          .eq("ativo", true);

        if (pastosData) {
          await cachePastos(pastosData);
          setPastos(pastosData);

          if (pastosData.length > 0) {
            const { data: lancamentosData } = await supabase
              .from("lancamentos")
              .select("id, pasto_id, num_sacos, foto_url, lancado_em, ciclo_id")
              .in("pasto_id", pastosData.map((p) => p.id))
              .order("lancado_em", { ascending: false });

            if (lancamentosData && lancamentosData.length > 0) {
              const pastosById = new Map(pastosData.map((p) => [p.id, p.nome]));
              const existingIds = new Set((await getAllLancamentos()).map((l) => l.id));

              await Promise.all(
                lancamentosData
                  .filter((lancamento) => !existingIds.has(lancamento.id))
                  .map((lancamento) => saveLancamento({
                    id: lancamento.id,
                    tipo: 'salga',
                    pasto_id: lancamento.pasto_id,
                    pasto_nome: pastosById.get(lancamento.pasto_id) || 'Pasto',
                    sacos: lancamento.num_sacos,
                    foto_auditoria_url: lancamento.foto_url,
                    foto_auditoria_exigida: Boolean(lancamento.foto_url),
                    observacoes: [],
                    data: lancamento.lancado_em || new Date().toISOString(),
                    status: 'sincronizado',
                    ciclo_id: lancamento.ciclo_id,
                  }))
              );
            }
          }
        }

        // Get ciclos
        let { data: ciclosData } = await supabase
          .from("ciclos")
          .select("id, mes, ano, fechado, num_dias")
          .eq("fazenda_id", retiroData.fazenda_id)
          .order("ano", { ascending: false })
          .order("mes", { ascending: false });

        // If no ciclos exist, auto-create the current month's ciclo
        if (!ciclosData || ciclosData.length === 0) {
          const { data: newCicloId } = await supabase.rpc("ensure_ciclo_atual", {
            p_fazenda_id: retiroData.fazenda_id,
          });
          if (newCicloId) {
            // Re-fetch after creation
            const { data: refreshed } = await supabase
              .from("ciclos")
              .select("id, mes, ano, fechado, num_dias")
              .eq("fazenda_id", retiroData.fazenda_id)
              .order("ano", { ascending: false })
              .order("mes", { ascending: false });
            ciclosData = refreshed;
          }
        }

        if (ciclosData && ciclosData.length > 0) {
          await cacheCiclos(ciclosData as CicloCache[]);
          setCiclos(ciclosData as CicloCache[]);
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          const currentCiclo = ciclosData.find(c => c.mes === currentMonth && c.ano === currentYear && !c.fechado);
          const active = currentCiclo || ciclosData.find(c => !c.fechado) || ciclosData[0];
          if (active) {
            setSelectedCicloId(active.id);
            await setConfig('selectedCicloId', active.id);
            await refreshLancamentosState(active.id);
          }
        } else {
          await refreshLancamentosState(selectedCicloId);
        }
      }
    } catch {
      // Offline — use cached data
    }
  }, [refreshLancamentosState, roleData.retiroId]);

  // Try to load from Supabase on mount (if online)
  useEffect(() => {
    if (!roleData.retiroId) return;
    loadFromSupabase();
  }, [loadFromSupabase, roleData.retiroId]);

  // Prepare offline mode
  const handleIniciarSalga = async () => {
    setScreen('prep');
    setPrepStatus('loading');
    try {
      await loadFromSupabase();
    } catch {
      // offline, use cache
    }
    const cached = await getCachedPastos();
    if (cached.length === 0) {
      toast.error("Sem dados de pastos. Conecte-se à internet primeiro.");
      setScreen('home');
      return;
    }
    setSalgaCount(0);
    setPrepStatus('done');
  };

  // Check if pasto already has salga today
  const pastoJaSalgadoHoje = (pastoId: string): boolean => {
    return lancamentosHoje.some(l => l.pasto_id === pastoId);
  };

  // QR scanned
  const handleQrScan = async (qrValue: string) => {
    const pasto = await getPastoByQr(qrValue);
    if (pasto) {
      if (pastoJaSalgadoHoje(pasto.id)) {
        toast.error(`Pasto "${pasto.nome}" já foi salgado hoje`);
        setScreen('salga');
        return;
      }
      openForm(pasto.id, pasto.nome, 'salga');
    } else {
      toast.error("QR Code não reconhecido");
      setScreen('scanner');
    }
  };

  const openForm = (pastoId: string, pastoNome: string, tipo: 'salga' | 'falha_qr', justificativa?: string) => {
    setFormPastoId(pastoId);
    setFormPastoNome(pastoNome);
    setFormTipo(tipo);
    setFormJustificativa(justificativa);
    setFormDraft(null);

    // Audit photo logic: ~30% chance of requiring photo
    // TODO: remove `true ||` after confirming blocking works
    setFormAuditoriaExigida(true || Math.random() < 0.3);
    setSalgaCount((current) => current + 1);
    setScreen('form');
  };

  const handleManualSelect = () => {
    setManualJustificativa("");
    setManualPastoId("");
    setScreen('manual-select');
  };

  const confirmManualSelect = () => {
    if (!manualJustificativa.trim() || !manualPastoId) {
      toast.error("Preencha a justificativa e selecione um pasto");
      return;
    }
    const pasto = pastos.find(p => p.id === manualPastoId);
    if (pasto) {
      if (pastoJaSalgadoHoje(pasto.id)) {
        toast.error(`Pasto "${pasto.nome}" já foi salgado hoje`);
        return;
      }
      openForm(pasto.id, pasto.nome, 'falha_qr', manualJustificativa);
    }
  };

  const handleSaveSalga = async (data: Omit<LancamentoOffline, 'id' | 'data' | 'status'>) => {
    const lancamento: LancamentoOffline = {
      ...data,
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      status: 'pendente',
    };
    await saveLancamento(lancamento);
    toast.success("✅ Salvo offline");
    setFormDraft(null);

    // Refresh local data
    await refreshLancamentosState();
    setScreen('salga');
  };
  const handleDeleteLancamento = async (id: string) => {
    await deleteLancamento(id);
    toast.success("Lançamento excluído");
    await refreshLancamentosState();
  };


  const handleSync = async () => {
    setSyncError(null);
    const pendentes = await getLancamentosPendentes();
    if (pendentes.length === 0) {
      toast.info("Nenhum dado pendente para sincronizar");
      return;
    }
    setScreen('syncing');
    setSyncProgress({ current: 0, total: pendentes.length });

    for (let i = 0; i < pendentes.length; i++) {
      const l = pendentes[i];
      setSyncProgress({ current: i + 1, total: pendentes.length });
      try {
        const insertData = {
          id: l.id,
          ciclo_id: l.ciclo_id!,
          pasto_id: l.pasto_id,
          num_sacos: l.sacos,
          num_animais: 0,
          origem: "salga_offline" as string,
          capataz_nome: userName,
          lancado_em: l.data,
          foto_url: l.foto_auditoria_url || null,
        };
        const { error } = await supabase.from("lancamentos").upsert(insertData);
        if (error) throw error;
        await markSincronizado(l.id);
      } catch (err: any) {
        const errorMsg = err?.message || err?.details || JSON.stringify(err);
        setSyncError(`Registro ${i + 1}: ${errorMsg}`);
        toast.error(`Erro ao sincronizar registro ${i + 1}`);
        break;
      }
    }

    const remaining = await getLancamentosPendentes();
    setPendingCount(remaining.length);
    if (remaining.length === 0) {
      toast.success("✅ Todos os dados sincronizados");
    }
    setScreen('home');
    await refreshLancamentosState();
  };

  const getMonthName = (m: number) => {
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1];
  };

  const getPastoStatus = (pastoId: string): 'feito' | 'pendente' | 'atrasado' => {
    const hoje = lancamentosHoje.filter(l => l.pasto_id === pastoId);
    if (hoje.length > 0) return 'feito';
    // Simple heuristic: if no salga today, pending
    return 'pendente';
  };

  // ============ SCREENS ============

  if (screen === 'prep') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-4">
        {prepStatus === 'loading' ? (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-foreground font-semibold text-lg">Preparando app para uso offline...</p>
            <p className="text-muted-foreground text-sm text-center">Baixando dados de pastos e configurações</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-16 h-16 text-primary" />
            <p className="text-foreground font-semibold text-lg">✅ App pronto para uso offline</p>
            <p className="text-muted-foreground text-sm">{pastos.length} pastos carregados</p>
            <Button onClick={() => setScreen('salga')} className="w-full max-w-xs mt-4" size="lg">
              Começar
            </Button>
          </>
        )}
      </div>
    );
  }

  if (screen === 'scanner') {
    return (
      <QrScanner
        onScan={handleQrScan}
        onManualSelect={handleManualSelect}
        onBack={() => setScreen('salga')}
      />
    );
  }

  if (screen === 'manual-select') {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-auto">
        <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setScreen('scanner')} className="text-primary-foreground hover:bg-primary/80">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Seleção Manual</h1>
        </header>
        <main className="flex-1 px-4 py-6 space-y-4 overflow-auto">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">⚠ Falha na leitura do QR Code</p>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Justificativa *</label>
                <Textarea
                  value={manualJustificativa}
                  onChange={(e) => setManualJustificativa(e.target.value)}
                  placeholder="Descreva o motivo da falha..."
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Selecionar pasto *</label>
                <Select value={manualPastoId} onValueChange={setManualPastoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o pasto" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={confirmManualSelect} className="w-full" disabled={!manualJustificativa.trim() || !manualPastoId}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (screen === 'form') {
    return (
      <SalgaForm
        pastoId={formPastoId}
        pastoNome={formPastoNome}
        retiroNome={retiro?.nome}
        fazendaNome={retiro?.fazenda_nome}
        cicloId={selectedCicloId}
        tipo={formTipo}
        justificativaFalhaQr={formJustificativa}
        auditoriaExigida={formAuditoriaExigida}
        initialDraft={formDraft}
        onDraftChange={setFormDraft}
        onSave={handleSaveSalga}
        onBack={() => {
          setFormDraft(null);
          setScreen('salga');
        }}
      />
    );
  }

  if (screen === 'salga') {
    const salgasHoje = lancamentosHoje;
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-auto">
        <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setScreen('home')} className="text-primary-foreground hover:bg-primary/80">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">Modo Salga</h1>
          </div>
          <span className="text-xs bg-primary-foreground/20 rounded-full px-3 py-1">🟢 Salga liberada</span>
        </header>
        <main className="flex-1 px-4 py-6 space-y-4 overflow-auto">
          <Button onClick={() => setScreen('scanner')} className="w-full gap-2 h-14 text-base" size="lg">
            <ScanLine className="w-6 h-6" />
            ESCANEAR QR CODE
          </Button>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Salgas de hoje ({salgasHoje.length})</h3>
            {salgasHoje.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhuma salga registrada hoje</p>
            ) : (
              <div className="space-y-2">
                {salgasHoje.map((l) => (
                  <Card key={l.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{l.pasto_nome}</p>
                        <p className="text-xs text-muted-foreground">{l.sacos} sacos • {l.tipo === 'falha_qr' ? '⚠ Manual' : '✅ QR'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${l.status === 'pendente' ? 'bg-secondary/20 text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                        {l.status === 'pendente' ? '⏳ Pendente' : '✅ Sincronizado'}
                      </span>
                      {l.status === 'pendente' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir este lançamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Salga de "{l.pasto_nome}" ({l.sacos} sacos) será removida. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLancamento(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'syncing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-foreground font-semibold text-lg">Sincronizando dados...</p>
        <p className="text-muted-foreground text-sm">
          {syncProgress.current} de {syncProgress.total}
        </p>
        <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
          />
        </div>
      </div>
    );
  }

  // ============ HOME SCREEN ============
  const selectedCiclo = ciclos.find(c => c.id === selectedCicloId);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-auto">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoConsubov} alt="Consubov" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-base font-bold leading-tight">Consubov</h1>
              <p className="text-xs opacity-80">Capataz • {userName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
        {retiro && (
          <p className="text-xs opacity-70 mt-1">{retiro.nome} • {retiro.fazenda_nome}</p>
        )}
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 pb-6 overflow-auto">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleIniciarSalga} className="h-14 gap-2 text-sm font-semibold" size="lg">
            <QrCode className="w-5 h-5" />
            Iniciar Salga
          </Button>
          <Button onClick={handleSync} variant="outline" className="h-14 gap-2 text-sm font-semibold relative" size="lg">
            <RefreshCw className="w-5 h-5" />
            Sincronizar
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>

        {syncError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3">
              <p className="text-sm font-semibold text-destructive">Erro de sincronização:</p>
              <p className="text-xs text-destructive mt-1 break-all">{syncError}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => setSyncError(null)}>Fechar</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Período</label>
                <Select value={selectedCicloId} onValueChange={async (v) => { setSelectedCicloId(v); await setConfig('selectedCicloId', v); await refreshLancamentosState(v); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {ciclos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getMonthName(c.mes)} {c.ano} {!c.fechado ? '(ativo)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="gap-1 mt-4 shrink-0">
                <Lock className="w-3 h-3" />
                Fechar Mês
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Retiro info */}
        {retiro && (
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold text-foreground">{retiro.nome}</p>
              <p className="text-xs text-muted-foreground">{retiro.fazenda_nome}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">—</p>
              <p className="text-[10px] text-muted-foreground">GMD kg/dia</p>
            </div>
          </div>
        )}

        {/* Lista de pastos */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Pastos ({pastos.length})</h3>
          {pastos.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground text-sm">Nenhum pasto encontrado. Conecte-se à internet para carregar os dados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pastos.map((p) => (
                <PastoCard
                  key={p.id}
                  nome={p.nome}
                  numAnimais={p.num_animais}
                  pesoMedio={p.peso_medio_kg}
                  diasNoPasto={p.dias_no_pasto}
                  sacosHoje={sacosMap[p.id] || 0}
                  status={getPastoStatus(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
