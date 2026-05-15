import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useKeepAlive } from "@/hooks/useKeepAlive";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, QrCode, RefreshCw, Lock, Loader2, CheckCircle2, ScanLine, ArrowLeft, Trash2, AlertTriangle, Eye, Pencil, Map as MapIcon, ArrowRightLeft, FileText, ClipboardList } from "lucide-react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { calcularConsumo, getConsumoPorCategoria, getMargemPorCategoria } from "@/lib/consumoCalc";
import { verificarFotoObrigatoria, registrarSalgaAuditoria, getSorteioAtual, syncSorteioToSupabase } from "@/lib/auditoriaSort";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { sendPushToAll } from "@/lib/pushService";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useRemoteSyncCommands } from "@/hooks/useRemoteSyncCommands";
import PastoCard from "@/components/capataz/PastoCard";
import type { SalgaFormDraft } from "@/components/capataz/SalgaForm";
import EstoqueCapatazSection from "@/components/estoque/EstoqueCapatazSection";
import type { TipoEvento } from "@/components/eventos/SelecionarEventoModal";
import type { SanitarioFormData } from "@/components/eventos/SanitarioFormModal";
import { useOfflinePesagemSync } from "@/hooks/useOfflinePesagem";
import {
  cachePastos, cacheRetiro, cacheCiclos, getCachedPastos, getCachedRetiro,
  getCachedCiclos,
  saveLancamento, getAllLancamentos, getLancamentosPendentes, markSincronizado, deleteLancamento,
  getPastoByQr, setConfig, getConfig,
  saveObservacaoOffline, getObservacoesPendentes, getObservacoesSincronizadas,
  markObservacaoSincronizada, deleteObservacaoOffline,
  saveFecharMes, getFecharMesPendente, clearFecharMes,
  cacheProdutoAtivo, getCachedProdutoAtivo, cacheFazenda, getCachedFazenda,
  type PastoCache, type RetiroCache, type CicloCache, type LancamentoOffline, type ObservacaoOffline,
  type FecharMesPendente, type ProdutoCache, type FazendaCache,
} from "@/lib/offlineDb";
import { generateAndStoreSalgaPdf, downloadBlob } from "@/lib/autoSalgaPdf";
import { maybeUpdateActiveServiceWorker } from "@/lib/swRegistration";

type Screen = 'home' | 'prep' | 'salga' | 'scanner' | 'form' | 'manual-select' | 'syncing' | 'transferencia-retiro' | 'relatorio-salga';
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

const QrScanner = lazy(() => import("@/components/capataz/QrScanner"));
const SalgaForm = lazy(() => import("@/components/capataz/SalgaForm"));
const ObservacaoModal = lazy(() => import("@/components/capataz/ObservacaoModal"));
const MortalidadeModal = lazy(() => import("@/components/capataz/MortalidadeModal"));
const AbateModal = lazy(() => import("@/components/capataz/AbateModal"));
const TransferenciaModal = lazy(() => import("@/components/capataz/TransferenciaModal"));
const PastoActionSheet = lazy(() => import("@/components/capataz/PastoActionSheet"));
const EntradaAnimaisModal = lazy(() => import("@/components/capataz/EntradaAnimaisModal"));
const EditarPesoCapatazModal = lazy(() => import("@/components/capataz/EditarPesoCapatazModal"));
const TransferenciaRetiroPage = lazy(() => import("@/pages/TransferenciaRetiroPage"));
const RelatorioSalgaPage = lazy(() => import("@/pages/RelatorioSalgaPage"));
const SelecionarEventoModal = lazy(() => import("@/components/eventos/SelecionarEventoModal"));
const SanitarioFormModal = lazy(() => import("@/components/eventos/SanitarioFormModal"));
const PesagemFlowModal = lazy(() => import("@/components/eventos/PesagemFlowModal"));
const ObservacaoLoteModal = lazy(() => import("@/components/eventos/ObservacaoLoteModal"));
const DetalhesLoteModal = lazy(() => import("@/components/eventos/DetalhesLoteModal"));
const HistoricoLoteModal = lazy(() => import("@/components/eventos/HistoricoLoteModal"));
const LancamentoManualModal = lazy(() => import("@/components/capataz/LancamentoManualModal"));

function DeferredFallback({ label = "Carregando..." }: { label?: string }) {
  return <p className="text-sm text-muted-foreground text-center py-4">{label}</p>;
}

function isSameLocalDay(dateIso: string, reference = new Date()) {
  const date = new Date(dateIso);

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function buildSacosMap(lancamentos: LancamentoOffline[] | undefined | null, cicloId?: string) {
  const list = Array.isArray(lancamentos) ? lancamentos : [];
  return list.reduce<Record<string, number>>((acc, lancamento) => {
    if (!lancamento || !lancamento.pasto_id) return acc;
    if (cicloId && lancamento.ciclo_id !== cicloId) return acc;
    if (lancamento.cocho_cheio) return acc; // Don't count cocho cheio as saco consumption

    acc[lancamento.pasto_id] = (acc[lancamento.pasto_id] || 0) + (lancamento.sacos || 0);
    return acc;
  }, {});
}

/** Calculate dynamic dias and peso_atual from data_entrada and GMD */
function calcDinamicoPasto(
  pasto: PastoCache,
  retiro: RetiroCache | null,
): { dias: number | null; pesoAtual: number | null } {
  if (!pasto.data_entrada) {
    return { dias: pasto.dias_no_pasto, pesoAtual: pasto.peso_medio_kg };
  }
  const dias = Math.max(0, Math.floor((Date.now() - new Date(pasto.data_entrada).getTime()) / 86400000));

  const pesoEntrada = pasto.peso_entrada ?? pasto.peso_medio_kg;
  if (pesoEntrada == null) {
    return { dias, pesoAtual: null };
  }

  // GMD priority: pasto-level > retiro-level by category
  let gmd = pasto.gmd_kg_dia;
  if (gmd == null && retiro) {
    const cat = (pasto.categoria || '').toLowerCase();
    if (cat.includes('recria 1') || cat.includes('recria1')) gmd = retiro.gmd_recria1;
    else if (cat.includes('recria 2') || cat.includes('recria2')) gmd = retiro.gmd_recria2;
    else gmd = retiro.gmd_engorda;
  }

  const pesoAtual = gmd != null && gmd > 0 ? pesoEntrada + gmd * dias : pesoEntrada;
  return { dias, pesoAtual: Math.round(pesoAtual * 10) / 10 };
}

export default function CapatazDashboard() {
  const { signOut, roleData, user } = useAuth();
  const navigate = useNavigate();
  const [backgroundBootReady, setBackgroundBootReady] = useState(false);

  // Keep the page/SW alive while the capataz is logged in to prevent
  // the browser from discarding offline state after idle time.
  useKeepAlive(Boolean(user?.id) && backgroundBootReady);
  const [bootReady, setBootReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [pastos, setPastos] = useState<PastoCache[]>([]);
  const [retiro, setRetiro] = useState<RetiroCache | null>(null);
  const [ciclos, setCiclos] = useState<CicloCache[]>([]);
  const [selectedCicloId, setSelectedCicloId] = useState<string>("");
  const [lancamentosHoje, setLancamentosHoje] = useState<LancamentoOffline[]>([]);
  const [sacosMap, setSacosMap] = useState<Record<string, number>>({});
  const [consumoMap, setConsumoMap] = useState<Record<string, { status_consumo?: string; indice_consumo?: number }>>({});
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
  const [observacaoOpen, setObservacaoOpen] = useState(false);
  const [mortalidadeOpen, setMortalidadeOpen] = useState(false);
  const [fazendaId, setFazendaId] = useState("");
  const [obsPendentes, setObsPendentes] = useState<ObservacaoOffline[]>([]);
  const [obsHistorico, setObsHistorico] = useState<ObservacaoOffline[]>([]);
  const [editingObs, setEditingObs] = useState<ObservacaoOffline | null>(null);
  const [fecharMesPendente, setFecharMesPendente] = useState<FecharMesPendente | null>(null);
  const [produtoAtivo, setProdutoAtivo] = useState<ProdutoCache | undefined>();
  const [fazendaCache, setFazendaCache] = useState<FazendaCache | undefined>();
  const [formSugestao, setFormSugestao] = useState<{ sacosSugeridos: number; numAnimais: number; intervaloDias: number; pesoAtual: number; produtoNome: string } | null>(null);

  // Abate & Transfer
  const [abateOpen, setAbateOpen] = useState(false);
  const [abatePasto, setAbatePasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPasto, setTransferPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionSheetPasto, setActionSheetPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [entradaPasto, setEntradaPasto] = useState<{ id: string; nome: string } | null>(null);
  const [editarPesoOpen, setEditarPesoOpen] = useState(false);
  const [editarPesoPasto, setEditarPesoPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);

  // Eventos do Lote
  const [eventoSelectorOpen, setEventoSelectorOpen] = useState(false);
  const [eventoPasto, setEventoPasto] = useState<{ id: string; nome: string; num_animais: number; peso_medio_kg: number | null } | null>(null);
  const [sanitarioOpen, setSanitarioOpen] = useState(false);
  const [pesagemOpen, setPesagemOpen] = useState(false);
  const [observacaoLoteOpen, setObservacaoLoteOpen] = useState(false);
  const [detalhesLoteOpen, setDetalhesLoteOpen] = useState(false);
  const [historicoLoteOpen, setHistoricoLoteOpen] = useState(false);
  const [pendingSanitarioData, setPendingSanitarioData] = useState<SanitarioFormData | null>(null);
  const [combinedMode, setCombinedMode] = useState(false);
  const [lancManualOpen, setLancManualOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [userName, setUserName] = useState(user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Capataz');

  // Fetch real name from capatazes table
  useEffect(() => {
    if (!backgroundBootReady || !user?.id) return;
    supabase
      .from("capatazes")
      .select("nome")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome) setUserName(data.nome);
        else if (user.email) setUserName(user.email.split('@')[0]);
      });
  }, [backgroundBootReady, user?.id, user?.email]);

  const { pendingCount: pesagemPendingCount, syncing: pesagemSyncing, refreshCount: refreshPesagemCount } = useOfflinePesagemSync(() => {
    loadLocalData();
  }, backgroundBootReady);

  const refreshObservacoes = useCallback(async () => {
    const [pend, hist] = await Promise.all([getObservacoesPendentes(), getObservacoesSincronizadas()]);
    setObsPendentes(pend);
    setObsHistorico(hist);
  }, []);

  const applyLancamentosState = useCallback((allLancamentos: LancamentoOffline[] | undefined | null, pendingCountValue: number, cicloId?: string) => {
    const list = Array.isArray(allLancamentos) ? allLancamentos.filter(Boolean) : [];
    setLancamentosHoje(list.filter((lancamento) => typeof lancamento?.data === 'string' && isSameLocalDay(lancamento.data)));
    setSacosMap(buildSacosMap(list, cicloId));
    setPendingCount(pendingCountValue ?? 0);
    // Build consumo map from latest lancamento per pasto
    const cMap: Record<string, { status_consumo?: string; indice_consumo?: number }> = {};
    const sorted = [...list].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    for (const l of sorted) {
      if (l?.pasto_id && !cMap[l.pasto_id] && l.status_consumo) {
        cMap[l.pasto_id] = { status_consumo: l.status_consumo, indice_consumo: l.indice_consumo };
      }
    }
    setConsumoMap(cMap);
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
    const [cachedPastos, cachedRetiro, cachedCiclos, allLancamentos, pendentes, savedCiclo, savedUiState, savedFazendaId, cachedProd, cachedFaz] = await Promise.all([
      getCachedPastos(),
      getCachedRetiro(),
      getCachedCiclos(),
      getAllLancamentos(),
      getLancamentosPendentes(),
      getConfig('selectedCicloId'),
      getConfig('capatazUiState'),
      getConfig('fazendaId'),
      getCachedProdutoAtivo(),
      getCachedFazenda(),
    ]);
    setPastos(cachedPastos);
    setRetiro(cachedRetiro || null);
    setCiclos(cachedCiclos);
    if (savedFazendaId) setFazendaId(savedFazendaId);
    if (cachedProd) setProdutoAtivo(cachedProd);
    if (cachedFaz) setFazendaCache(cachedFaz);

    let nextCicloId = "";
    if (cachedCiclos.length > 0) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentCiclo = cachedCiclos.find(c => c.mes === currentMonth && c.ano === currentYear);
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
    await refreshObservacoes();
    const fecharPend = await getFecharMesPendente();
    setFecharMesPendente(fecharPend);
  }, [applyLancamentosState, refreshObservacoes, restoreUiState]);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;
    let rafId: number | null = null;

    const startBoot = () => {
      timerId = window.setTimeout(() => {
        if (!cancelled) setBootReady(true);
      }, 0);
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      rafId = window.requestAnimationFrame(startBoot);
    } else {
      startBoot();
    }

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!bootReady) return;

    let cancelled = false;
    let timerId: number | null = null;

    const startBackgroundBoot = () => {
      timerId = window.setTimeout(() => {
        if (!cancelled) setBackgroundBootReady(true);
      }, 900);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(startBackgroundBoot, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
        if (timerId !== null) window.clearTimeout(timerId);
      };
    }

    startBackgroundBoot();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [bootReady]);

  useEffect(() => {
    if (!backgroundBootReady) return;
    void loadLocalData().catch((error) => {
      console.error('[CapatazDashboard] local bootstrap failed:', error);
      setStartupError('Não foi possível iniciar os dados offline do capataz.');
    });
  }, [backgroundBootReady, loadLocalData]);

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
        .select("id, nome, fazenda_id, gmd_recria1, gmd_recria2, gmd_engorda, produto_id")
        .eq("id", roleData.retiroId!)
        .maybeSingle();

      if (retiroData) {
        const { data: fazenda } = await supabase
          .from("fazendas")
          .select("nome, intervalo_padrao_dias, auditoria_fotos_por_bloco")
          .eq("id", retiroData.fazenda_id)
          .maybeSingle();

        const retiroCache: RetiroCache = {
          id: retiroData.id,
          nome: retiroData.nome,
          fazenda_nome: fazenda?.nome || '',
          gmd_recria1: retiroData.gmd_recria1,
          gmd_recria2: retiroData.gmd_recria2,
          gmd_engorda: retiroData.gmd_engorda,
        };
        await cacheRetiro(retiroCache);
        setRetiro(retiroCache);
        setFazendaId(retiroData.fazenda_id);
        await setConfig('fazendaId', retiroData.fazenda_id);

        // Cache fazenda data (intervalo + auditoria)
        if (fazenda) {
          const fCache: FazendaCache = {
            id: retiroData.fazenda_id,
            nome: fazenda.nome || '',
            intervalo_padrao_dias: fazenda.intervalo_padrao_dias ?? 4,
            auditoria_fotos_por_bloco: (fazenda as any).auditoria_fotos_por_bloco ?? 3,
          };
          await cacheFazenda(fCache);
          setFazendaCache(fCache);
        }

        // Cache produto ativo do retiro
        const retiroProdutoId = (retiroData as any).produto_id;
        if (retiroProdutoId) {
          const { data: prodData } = await supabase
            .from("produtos")
            .select("id, nome, peso_saco_kg, consumo_por_100kg, consumo_recria1, consumo_recria2, consumo_engorda")
            .eq("id", retiroProdutoId)
            .maybeSingle();
          if (prodData) {
            const pCache: ProdutoCache = {
              id: prodData.id,
              nome: prodData.nome,
              peso_saco_kg: Number(prodData.peso_saco_kg),
              consumo_por_100kg: prodData.consumo_por_100kg != null ? Number(prodData.consumo_por_100kg) : null,
              consumo_recria1: prodData.consumo_recria1 != null ? Number(prodData.consumo_recria1) : null,
              consumo_recria2: prodData.consumo_recria2 != null ? Number(prodData.consumo_recria2) : null,
              consumo_engorda: prodData.consumo_engorda != null ? Number(prodData.consumo_engorda) : null,
            };
            await cacheProdutoAtivo(pCache);
            setProdutoAtivo(pCache);
          }
        }

        // Get pastos
        const { data: pastosData } = await supabase
          .from("pastos")
          .select("id, nome, num_animais, peso_medio_kg, dias_no_pasto, qr_uuid, produto_id, sexo, categoria, data_entrada, peso_entrada, gmd_kg_dia, data_fim_carencia, data_movimentacao")
          .eq("retiro_id", retiroData.id)
          .eq("ativo", true);

        if (pastosData) {
          await cachePastos(pastosData);
          setPastos(pastosData);

          if (pastosData.length > 0) {
            const { data: lancamentosData } = await supabase
              .from("lancamentos")
              .select("id, pasto_id, num_sacos, created_at, mes_referencia, ano_referencia, origem")
              .in("pasto_id", pastosData.map((p) => p.id))
              .order("created_at", { ascending: false });

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
                    foto_auditoria_url: null,
                    foto_auditoria_exigida: false,
                    observacoes: [],
                    data: lancamento.created_at || new Date().toISOString(),
                    status: 'sincronizado',
                    ciclo_id: undefined,
                    status_consumo: undefined,
                    indice_consumo: undefined,
                  }))
              );
            }
          }
        }

        // Get ciclos
        let { data: ciclosData } = await supabase
          .from("ciclos")
          .select("id, mes, ano, fechado, num_dias, data_inicio, data_fim, duracao_dias")
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
              .select("id, mes, ano, fechado, num_dias, data_inicio, data_fim, duracao_dias")
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
    if (!backgroundBootReady || !roleData.retiroId) return;
    void loadFromSupabase().catch((error) => {
      console.warn('[CapatazDashboard] supabase bootstrap failed:', error);
    });
  }, [backgroundBootReady, loadFromSupabase, roleData.retiroId]);

  // Prepare offline mode
  const handleIniciarSalga = async () => {
    setScreen('prep');
    setPrepStatus('loading');
    try {
      await loadFromSupabase();
    } catch {
      // offline, use cache
    }
    // Preload lazy chunks needed for offline scanning + salga flow.
    // Triggers SW/browser cache so they're available even without network.
    try {
      await Promise.all([
        import("@/components/capataz/QrScanner"),
        import("@/components/capataz/SalgaForm"),
        import("@/components/capataz/PastoActionSheet"),
        import("@zxing/browser"),
      ]);
    } catch (err) {
      console.warn('[CapatazDashboard] preload offline chunks failed:', err);
    }
    const cached = await getCachedPastos();
    if (cached.length === 0) {
      toast.error("Sem dados de pastos. Conecte-se à internet primeiro.");
      setScreen('home');
      return;
    }
    // Check for open ciclo
    const cachedCiclosNow = await getCachedCiclos();
    const cicloAberto = cachedCiclosNow.find(c => !c.fechado);
    if (!cicloAberto) {
      toast.error("⚠ Nenhum ciclo aberto. Inicie o mês antes de registrar salgas.");
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

  const openForm = async (pastoId: string, pastoNome: string, tipo: 'salga' | 'falha_qr', justificativa?: string) => {
    setFormPastoId(pastoId);
    setFormPastoNome(pastoNome);
    setFormTipo(tipo);
    setFormJustificativa(justificativa);
    setFormDraft(null);

    // Compute suggestion
    const pasto = pastos.find(p => p.id === pastoId);
    if (pasto && produtoAtivo && fazendaCache) {
      const { pesoAtual } = calcDinamicoPasto(pasto, retiro);
      const peso = pesoAtual ?? Number(pasto.peso_medio_kg) ?? 0;
      const categoria = pasto.categoria || 'Engorda';
      const consumo_por_100kg = getConsumoPorCategoria(categoria, produtoAtivo);
      const intervaloDias = fazendaCache.intervalo_padrao_dias || 4;

      if (consumo_por_100kg > 0 && pasto.num_animais > 0 && peso > 0) {
        const consumo_diario_kg = (pasto.num_animais * peso * consumo_por_100kg) / 100;
        const consumo_periodo_kg = consumo_diario_kg * intervaloDias;
        const sacos = Math.max(1, Math.ceil(consumo_periodo_kg / produtoAtivo.peso_saco_kg));
        setFormSugestao({
          sacosSugeridos: sacos,
          numAnimais: pasto.num_animais,
          intervaloDias,
          pesoAtual: peso,
          produtoNome: produtoAtivo.nome,
        });
      } else {
        setFormSugestao(null);
      }
    } else {
      setFormSugestao(null);
    }

    // Audit photo lottery logic
    const fotosPorBloco = fazendaCache?.auditoria_fotos_por_bloco ?? 3;
    const retiroId = retiro?.id || '';
    const fId = fazendaId || '';
    try {
      const obrigatoria = await verificarFotoObrigatoria(retiroId, fId, fotosPorBloco);
      setFormAuditoriaExigida(obrigatoria);
    } catch {
      setFormAuditoriaExigida(true); // fallback: require photo on error
    }

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
    // Block if no open ciclo
    const cicloAtivo = ciclos.find(c => c.id === selectedCicloId && !c.fechado);
    if (!cicloAtivo) {
      toast.error("⚠ Inicie o mês antes de registrar a salga");
      return;
    }

    const lancamento: LancamentoOffline = {
      ...data,
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      status: 'pendente',
      ciclo_id: cicloAtivo.id,
    };
    await saveLancamento(lancamento);

    // Register audit counter ONLY for normal salga (not cocho cheio)
    if (!data.cocho_cheio) {
      const fotosPorBloco = fazendaCache?.auditoria_fotos_por_bloco ?? 3;
      const retiroId = retiro?.id || '';
      const fId = fazendaId || '';
      try {
        await registrarSalgaAuditoria(retiroId, fId, fotosPorBloco);
        // Sync sorteio to Supabase (fire and forget)
        const sorteio = await getSorteioAtual(retiroId, fId, fotosPorBloco);
        syncSorteioToSupabase(supabase, sorteio);
      } catch { /* offline — no problem */ }
    }

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
    await maybeUpdateActiveServiceWorker();
    const pendentes = await getLancamentosPendentes();
    const obsPend = await getObservacoesPendentes();
    const fecharPend = await getFecharMesPendente();
    const totalPending = pendentes.length + obsPend.length + (fecharPend ? 1 : 0);
    if (totalPending === 0) {
      toast.info("Nenhum dado pendente para sincronizar");
      return;
    }
    setScreen('syncing');
    setSyncProgress({ current: 0, total: totalPending });
    let idx = 0;

    for (let i = 0; i < pendentes.length; i++) {
      const l = pendentes[i];
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        // --- Consumption calculation (skip for cocho cheio) ---
        let consumo_esperado_kg: number | null = null;
        let consumo_real_kg: number | null = null;
        let indice_consumo: number | null = null;
        let status_consumo: string | null = null;
        let dias_intervalo: number | null = null;
        let produto_id_final: string | null = null;

        const pasto = pastos.find(p => p.id === l.pasto_id);
        if (pasto && !l.cocho_cheio) {
          // Get retiro produto_id as fallback
          let retiroProdutoId: string | null = null;
          if (roleData.retiroId) {
            const { data: retiroRow } = await supabase.from("retiros").select("produto_id").eq("id", roleData.retiroId).maybeSingle();
            retiroProdutoId = retiroRow?.produto_id ?? null;
          }
          produto_id_final = pasto.produto_id || retiroProdutoId;

          // Use dynamic peso_atual for consumption calculation
          const { pesoAtual: pesoAtualCalc } = calcDinamicoPasto(pasto, retiro);
          const pesoParaConsumo = pesoAtualCalc ?? Number(pasto.peso_medio_kg) ?? 0;

          if (produto_id_final && pasto.num_animais > 0 && pesoParaConsumo > 0) {
            const { data: produto } = await supabase.from("produtos")
              .select("peso_saco_kg, consumo_recria1, consumo_recria2, consumo_engorda, margem_recria1, margem_recria2, margem_engorda")
              .eq("id", produto_id_final).maybeSingle();

            if (produto) {
              const categoria = pasto.categoria || 'Engorda';
              const consumo_por_100kg = getConsumoPorCategoria(categoria, produto);
              const margem = getMargemPorCategoria(categoria, produto);

              // QR Code: auto-calculate dias_intervalo from dates
              const { data: prevLanc } = await supabase.from("lancamentos")
                .select("created_at")
                .eq("pasto_id", l.pasto_id)
                .lt("created_at", l.data)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              let dataAnterior: Date | null = null;
              if (prevLanc?.created_at) {
                dataAnterior = new Date(prevLanc.created_at);
              } else if (l.ciclo_id) {
                const ciclo = ciclos.find(c => c.id === l.ciclo_id);
                if (ciclo) {
                  dataAnterior = new Date(ciclo.ano, ciclo.mes - 1, 1);
                }
              }

              if (dataAnterior) {
                const dataAtual = new Date(l.data);
                dias_intervalo = Math.round((dataAtual.getTime() - dataAnterior.getTime()) / 86400000);

                if (dias_intervalo <= 0) {
                  status_consumo = 'ERRO';
                  indice_consumo = 0;
                } else {
                  const resultado = calcularConsumo({
                    num_sacos: l.sacos,
                    peso_saco_kg: Number(produto.peso_saco_kg),
                    num_animais: pasto.num_animais,
                    dias: dias_intervalo,
                    peso_medio_kg: pesoParaConsumo,
                    consumo_por_100kg_categoria: consumo_por_100kg,
                    margem,
                  });

                  if (resultado) {
                    consumo_esperado_kg = resultado.consumo_esperado_kg;
                    consumo_real_kg = resultado.consumo_real_kg;
                    indice_consumo = resultado.indice_consumo;
                    status_consumo = resultado.status_consumo;
                  }

                  if (dias_intervalo > 7) {
                    console.warn(`⚠ Intervalo de ${dias_intervalo} dias para pasto ${l.pasto_nome} — verificar`);
                  }
                }
              }
            }
          }
        }

        // Update ultima_salga_em on the retiro after sync
        if (roleData.retiroId) {
          await supabase.from("retiros").update({
            ultima_salga_em: l.data,
            alerta_atraso_enviado: false,
          } as any).eq("id", roleData.retiroId);
        }

        // Derive mes/ano from the ciclo, NOT from JS Date
        const cicloDoLanc = l.ciclo_id ? ciclos.find(c => c.id === l.ciclo_id) : null;
        const mesRef = cicloDoLanc ? cicloDoLanc.mes : new Date(l.data).getMonth() + 1;
        const anoRef = cicloDoLanc ? cicloDoLanc.ano : new Date(l.data).getFullYear();

        const insertData: Record<string, any> = {
          id: l.id,
          fazenda_id: fazendaId,
          retiro_id: roleData.retiroId,
          pasto_id: l.pasto_id,
          mes_referencia: mesRef,
          ano_referencia: anoRef,
          ciclo_id: l.ciclo_id || null,
          num_sacos: l.sacos,
          num_animais: pasto?.num_animais ?? 0,
          origem: "qr",
          peso_medio_kg: pasto ? (calcDinamicoPasto(pasto, retiro).pesoAtual ?? pasto.peso_medio_kg ?? null) : null,
          dias_no_pasto: dias_intervalo ?? (pasto?.dias_no_pasto ?? 1),
          categoria: pasto?.categoria ?? null,
          sexo: pasto?.sexo ?? null,
          cocho_cheio: l.cocho_cheio ?? false,
          foto_cocho_url: l.foto_cocho_url ?? null,
        };
        const { error } = await supabase.from("lancamentos").upsert(insertData as any);
        if (error) throw error;
        await markSincronizado(l.id);

        // Subtrair estoque automaticamente após salga sincronizada
        if (roleData.retiroId && l.sacos > 0) {
          const mesEstoque = mesRef;
          const anoEstoque = anoRef;
          const { data: estoque } = await supabase
            .from("estoque_retiro")
            .select("id, quantidade_atual")
            .eq("retiro_id", roleData.retiroId)
            .eq("mes", mesEstoque)
            .eq("ano", anoEstoque)
            .maybeSingle();
          if (estoque) {
            const novaQtd = Math.max(0, estoque.quantidade_atual - l.sacos);
            await supabase.from("estoque_retiro").update({ quantidade_atual: novaQtd, updated_at: new Date().toISOString() }).eq("id", estoque.id);
            await supabase.from("movimentacoes_estoque").insert({
              retiro_id: roleData.retiroId,
              mes: mesEstoque,
              ano: anoEstoque,
              tipo: 'saida',
              quantidade: l.sacos,
              origem: 'salga',
              referencia_id: l.id,
            });
          }
        }
      } catch (err: any) {
        const errorMsg = err?.message || err?.details || JSON.stringify(err);
        setSyncError(`Registro ${idx}: ${errorMsg}`);
        toast.error(`Erro ao sincronizar registro ${idx}`);
        break;
      }
    }

    // Sync observações
    for (let i = 0; i < obsPend.length; i++) {
      const obs = obsPend[i];
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        const { error } = await supabase.from("observacoes").insert({
          id: obs.id,
          pasto_id: obs.pasto_id || null,
          retiro_id: obs.retiro_id,
          fazenda_id: obs.fazenda_id,
          capataz_nome: obs.capataz_nome,
          tipo: obs.tipo,
          descricao: obs.descricao,
          foto_url: obs.foto_url,
          resolvido: false,
        });
        if (error) throw error;
        await markObservacaoSincronizada(obs.id);
        const resumo = (obs.descricao && obs.descricao.trim().length > 0)
          ? obs.descricao.trim().slice(0, 80)
          : `${obs.tipo ?? "Observação"} — ${obs.capataz_nome ?? ""}`;
        void sendPushToAll("📋 Nova observação", resumo, "/gerente");
      } catch (err: any) {
        const errorMsg = err?.message || err?.details || JSON.stringify(err);
        setSyncError(`Observação ${i + 1}: ${errorMsg}`);
        toast.error(`Erro ao sincronizar observação ${i + 1}`);
        break;
      }
    }

    // Sync fechar mês
    if (fecharPend && !syncError) {
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        // Calcular num_dias real e duracao_dias a partir de data_inicio
        const cicloParaFechar = ciclos.find(c => c.id === fecharPend.ciclo_id);
        let numDiasReal = 30;
        let duracaoDias: number | null = null;
        const dataFim = new Date().toISOString();

        if (cicloParaFechar?.data_inicio) {
          const inicio = new Date(cicloParaFechar.data_inicio);
          const fim = new Date(dataFim);
          duracaoDias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
          numDiasReal = duracaoDias;
        } else if (cicloParaFechar && fazendaId) {
          const { data: lancDoCiclo } = await supabase.from("lancamentos")
            .select("dias_no_pasto")
            .eq("fazenda_id", fazendaId)
            .eq("mes_referencia", cicloParaFechar.mes)
            .eq("ano_referencia", cicloParaFechar.ano);
          if (lancDoCiclo && lancDoCiclo.length > 0) {
            numDiasReal = Math.max(...lancDoCiclo.map(l => l.dias_no_pasto));
          }
        }

        // Fechar ciclo atual com num_dias real + data_fim + duracao_dias
        const { error: errFechar } = await supabase.from("ciclos").update({
          fechado: true,
          fechado_em: dataFim,
          num_dias: numDiasReal,
          data_fim: dataFim,
          duracao_dias: duracaoDias,
        } as any).eq("id", fecharPend.ciclo_id);
        if (errFechar) throw errFechar;

        // Buscar ciclo fechado para calcular próximo mês
        const cicloFechado = ciclos.find(c => c.id === fecharPend.ciclo_id);
        if (cicloFechado && fazendaId) {
          let nextMes = cicloFechado.mes + 1;
          let nextAno = cicloFechado.ano;
          if (nextMes > 12) { nextMes = 1; nextAno++; }

          // Verificar se já existe
          const { data: existente } = await supabase.from("ciclos")
            .select("id")
            .eq("fazenda_id", fazendaId)
            .eq("mes", nextMes)
            .eq("ano", nextAno)
            .maybeSingle();

          if (!existente) {
            await supabase.from("ciclos").insert({
              fazenda_id: fazendaId,
              mes: nextMes,
              ano: nextAno,
              num_dias: 30,
              fechado: false,
            });
          }
        }

        await clearFecharMes();
        setFecharMesPendente(null);
        toast.success("✅ Mês fechado e novo ciclo criado");
      } catch (err: any) {
        const errorMsg = err?.message || err?.details || JSON.stringify(err);
        setSyncError(`Fechar mês: ${errorMsg}`);
        toast.error("Erro ao fechar mês");
      }
    }

    const remaining = await getLancamentosPendentes();
    setPendingCount(remaining.length);
    if (remaining.length === 0 && !syncError) {
      toast.success("✅ Todos os dados sincronizados");
    }
    setScreen('home');
    await refreshLancamentosState();
    await refreshObservacoes();
    // Reload ciclos from Supabase
    try { await loadFromSupabase(); } catch {}
  };

  // Sync engine: auto-triggers on online/visibility/mount + retry with backoff.
  // It wraps handleSync (which throws on internal failures via setSyncError → we re-throw).
  const runSyncForEngine = useCallback(async () => {
    setSyncError(null);
    await handleSync();
    // If handleSync surfaced an error via state, propagate it so the engine schedules a retry.
    if (syncError) {
      throw new Error(syncError);
    }
  }, [handleSync, syncError]);

  const sync = useSyncEngine({
    runSync: runSyncForEngine,
    enabled: backgroundBootReady && Boolean(user?.id),
    onSyncSuccess: async (previousLastSyncedAt) => {
      // Auto-generate the latest salga PDF and offer immediate download
      if (!retiro?.id || !fazendaId) return;
      try {
        const result = await generateAndStoreSalgaPdf({
          fazendaId,
          fazendaNome: retiro.fazenda_nome || "",
          retiroId: retiro.id,
          retiroNome: retiro.nome,
          sinceIso: previousLastSyncedAt,
          responsavelNome: userName,
        });
        if (result.empty) return;
        toast.success("Sync concluído — PDF disponível", {
          duration: 10_000,
          action: {
            label: "Baixar PDF",
            onClick: () => downloadBlob(result.blob, result.fileName),
          },
        });
      } catch (e) {
        console.warn("[capataz] auto PDF generation failed:", e);
      }
    },
  });

  // Listen for remote "Force Sync" commands from Admin/Gerente dashboard
  useRemoteSyncCommands(user?.id, () => sync.triggerSync(false), backgroundBootReady);

  const getMonthName = (m: number) => {
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1];
  };

  if (startupError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-foreground">Falha ao abrir o painel</h1>
          <p className="text-sm text-muted-foreground">{startupError}</p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  if (!bootReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-foreground">Preparando painel do capataz…</p>
          <p className="text-sm text-muted-foreground">Carregando a interface antes dos dados offline.</p>
        </div>
      </div>
    );
  }

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
          setFormSugestao(null);
          setScreen('salga');
        }}
        numAnimais={pastos.find(p => p.id === formPastoId)?.num_animais ?? 0}
        sugestao={formSugestao}
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
                        {l.cocho_cheio ? (
                          <p className="text-xs text-blue-600 font-medium">🫙 Cocho Cheio • {l.tipo === 'falha_qr' ? '⚠ Manual' : '✅ QR'}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{l.sacos} sacos • {l.tipo === 'falha_qr' ? '⚠ Manual' : '✅ QR'}</p>
                        )}
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

  if (screen === 'transferencia-retiro') {
    return <TransferenciaRetiroPage onBack={() => setScreen('home')} />;
  }

  if (screen === 'relatorio-salga') {
    return (
      <RelatorioSalgaPage
        onBack={() => setScreen('home')}
        fazendaId={fazendaId}
        fazendaNome={retiro?.fazenda_nome || ""}
        retiroId={roleData.retiroId || ""}
        retiroNome={retiro?.nome || ""}
      />
    );
  }

  // ============ HOME SCREEN ============
  const selectedCiclo = ciclos.find(c => c.id === selectedCicloId);

  // Always use the current real date as the operational month
  const now = new Date();
  const mesOperacional = now.getMonth() + 1;
  const anoOperacional = now.getFullYear();
  const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mesOperacional - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-auto">
      <UpdateBanner />
      <div className="px-4 pt-2">
        <SyncStatusBanner
          status={sync.status}
          pendingCount={sync.pendingCount}
          lastSyncedAt={sync.lastSyncedAt}
          retryAttempt={sync.retryAttempt}
          errorMessage={sync.errorMessage}
          onRetry={() => sync.triggerSync(true)}
          onLoginAgain={signOut}
        />
      </div>
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
              <SheetContent
                side="left"
                className="w-[80vw] max-w-sm p-0 flex flex-col"
              >
                <SheetHeader className="bg-primary text-primary-foreground p-4 text-left space-y-1">
                  <SheetTitle className="text-primary-foreground text-base font-bold">
                    {userName}
                  </SheetTitle>
                  {retiro && (
                    <SheetDescription className="text-primary-foreground/80 text-xs">
                      {retiro.nome} • {retiro.fazenda_nome}
                    </SheetDescription>
                  )}
                </SheetHeader>
                <Separator />
                <nav className="flex-1 overflow-y-auto p-2">
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setLancManualOpen(true); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <ClipboardList className="w-5 h-5 text-primary" />
                        Lançamento Manual
                      </button>
                    </li>
                    {roleData.retiroId && (
                      <li>
                        <button
                          onClick={() => { setMenuOpen(false); navigate(`/mapa/retiro/${roleData.retiroId}`); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                        >
                          <MapIcon className="w-5 h-5 text-primary" />
                          Ver Mapa
                        </button>
                      </li>
                    )}
                    <li><Separator className="my-1" /></li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setScreen('transferencia-retiro'); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <ArrowRightLeft className="w-5 h-5 text-primary" />
                        Transferência entre Retiros
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setScreen('relatorio-salga'); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <FileText className="w-5 h-5 text-primary" />
                        Relatório de Salga
                      </button>
                    </li>
                  </ul>
                </nav>
              </SheetContent>
            </Sheet>
            <img src={logoConsubov} alt="Consubov" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-base font-bold leading-tight">Consubov</h1>
              <p className="text-xs opacity-80">Capataz • {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <RefreshButton />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
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
            {(pendingCount + obsPendentes.length + (fecharMesPendente ? 1 : 0) + pesagemPendingCount) > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold">
                {pendingCount + obsPendentes.length + (fecharMesPendente ? 1 : 0) + pesagemPendingCount}
              </span>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setObservacaoOpen(true)} variant="outline" className="h-14 gap-2 text-sm font-semibold" size="lg">
            <Eye className="w-5 h-5" />
            + Observação
          </Button>
          <Button onClick={() => setMortalidadeOpen(true)} variant="outline" className="h-14 gap-2 text-sm font-semibold border-destructive/50 text-destructive hover:bg-destructive/10" size="lg">
            <AlertTriangle className="w-5 h-5" />
            🐄 Mortalidade
          </Button>
        </div>
        {roleData.retiroId && (
          <Button
            onClick={() => navigate(`/mapa/retiro/${roleData.retiroId}`)}
            variant="outline"
            className="h-14 w-full gap-2 text-sm font-semibold"
            size="lg"
          >
            <MapIcon className="w-5 h-5" />
            Ver Mapa
          </Button>
        )}
        {roleData.retiroId && fazendaId && (
          <EstoqueCapatazSection retiroId={roleData.retiroId} fazendaId={fazendaId} />
        )}

        {syncError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3">
              <p className="text-sm font-semibold text-destructive">Erro de sincronização:</p>
              <p className="text-xs text-destructive mt-1 break-all">{syncError}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => setSyncError(null)}>Fechar</Button>
            </CardContent>
          </Card>
        )}

        {/* Mês operacional (fixo, sem seleção manual) */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Mês atual de operação</p>
                <p className="text-lg font-bold text-primary">{mesNome} {anoOperacional}</p>
              </div>
              <div className="flex gap-2">
                {/* Iniciar Mês */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 shrink-0"
                  disabled={!selectedCiclo || !!selectedCiclo.data_inicio || selectedCiclo.fechado || !!fecharMesPendente}
                  onClick={async () => {
                    if (!selectedCicloId) return;
                    try {
                      const agora = new Date().toISOString();
                      const { error } = await supabase.from("ciclos").update({
                        data_inicio: agora,
                      } as any).eq("id", selectedCicloId);
                      if (error) throw error;
                      // Update local cache
                      setCiclos(prev => prev.map(c => c.id === selectedCicloId ? { ...c, data_inicio: agora } : c));
                      const cachedCiclosNow = await getCachedCiclos();
                      const updated = cachedCiclosNow.map(c => c.id === selectedCicloId ? { ...c, data_inicio: agora } : c);
                      await cacheCiclos(updated);
                      toast.success("✅ Mês iniciado com sucesso");
                    } catch {
                      toast.error("Erro ao iniciar mês");
                    }
                  }}
                >
                  ▶ Iniciar
                </Button>

                {/* Fechar Mês */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 shrink-0"
                      disabled={!selectedCiclo || !selectedCiclo.data_inicio || selectedCiclo.fechado || !!fecharMesPendente}
                    >
                      <Lock className="w-3 h-3" />
                      {fecharMesPendente ? '⏳ Pendente' : 'Fechar'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fechar mês?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja fechar o ciclo de {selectedCiclo ? `${getMonthName(selectedCiclo.mes)} ${selectedCiclo.ano}` : ''}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => {
                        const salgasPend = await getLancamentosPendentes();
                        if (salgasPend.length > 0) {
                          toast.error("Sincronize as salgas pendentes antes de fechar o mês");
                          return;
                        }
                        if (!selectedCicloId) return;
                        const action: FecharMesPendente = {
                          tipo: 'fechar_mes',
                          ciclo_id: selectedCicloId,
                          data: new Date().toISOString(),
                          status: 'pendente',
                        };
                        await saveFecharMes(action);
                        setFecharMesPendente(action);
                        toast.success("Mês fechado. Sincronize para confirmar.");
                      }}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Ciclo date info */}
            {selectedCiclo?.data_inicio && (
              <div className="text-xs text-muted-foreground border-t border-primary/10 pt-2 space-y-0.5">
                <p>Iniciado em: {new Date(selectedCiclo.data_inicio).toLocaleDateString("pt-BR")}</p>
                {selectedCiclo.data_fim && (
                  <>
                    <p>Fechado em: {new Date(selectedCiclo.data_fim).toLocaleDateString("pt-BR")}</p>
                    <p>Duração: {selectedCiclo.duracao_dias ?? '—'} dias</p>
                  </>
                )}
              </div>
            )}
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
              {pastos.map((p) => {
                const cm = consumoMap[p.id];
                const { dias, pesoAtual } = calcDinamicoPasto(p, retiro);
                return (
                  <div key={p.id} onClick={() => { setActionSheetPasto({ id: p.id, nome: p.nome, num_animais: p.num_animais }); setActionSheetOpen(true); }} className="cursor-pointer">
                    <PastoCard
                      nome={p.nome}
                      numAnimais={p.num_animais}
                      pesoMedio={pesoAtual}
                      diasNoPasto={dias}
                      sacosHoje={sacosMap[p.id] || 0}
                      status={getPastoStatus(p.id)}
                      statusConsumo={cm?.status_consumo}
                      indiceConsumo={cm?.indice_consumo}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Observações pendentes */}
        {obsPendentes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Observações pendentes ({obsPendentes.length})</h3>
            <div className="space-y-2">
              {obsPendentes.map((obs) => (
                <Card key={obs.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {obs.foto_url && (
                      <img src={obs.foto_url} alt="Obs" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground capitalize">{obs.tipo?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground truncate">{obs.pasto_nome || 'Sem pasto'} • {new Date(obs.criado_em).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditingObs(obs); setObservacaoOpen(true); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir observação?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { await deleteObservacaoOffline(obs.id); await refreshObservacoes(); toast.success("Observação excluída"); }}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de observações enviadas */}
        {obsHistorico.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Histórico de observações enviadas ({obsHistorico.length})</h3>
            <div className="space-y-2">
              {obsHistorico.map((obs) => (
                <Card key={obs.id} className="opacity-70">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground capitalize">{obs.tipo?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{obs.pasto_nome || 'Sem pasto'} • {new Date(obs.criado_em).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">✅ Enviada</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <Suspense fallback={null}>
        <ObservacaoModal
          open={observacaoOpen}
          onClose={() => { setObservacaoOpen(false); setEditingObs(null); }}
          pastos={pastos}
          retiroId={roleData.retiroId || ""}
          fazendaId={fazendaId}
          capatazNome={userName}
          editingObs={editingObs}
          onSave={async (obsData) => {
            const obs: ObservacaoOffline = {
              ...obsData,
              id: editingObs?.id || crypto.randomUUID(),
              criado_em: editingObs?.criado_em || new Date().toISOString(),
              status: 'pendente',
            };
            await saveObservacaoOffline(obs);
            await refreshObservacoes();
            setEditingObs(null);
          }}
        />

        <MortalidadeModal
          open={mortalidadeOpen}
          onClose={() => setMortalidadeOpen(false)}
          pastos={pastos}
          retiroId={roleData.retiroId || ""}
          fazendaId={fazendaId}
          capatazNome={userName}
          onPastoUpdated={() => { loadFromSupabase(); }}
        />

        <PastoActionSheet
          open={actionSheetOpen}
          onClose={() => { setActionSheetOpen(false); setActionSheetPasto(null); }}
          pastoNome={actionSheetPasto?.nome || ""}
          numAnimais={actionSheetPasto?.num_animais ?? 0}
          dataFimCarencia={actionSheetPasto ? pastos.find(p => p.id === actionSheetPasto.id)?.data_fim_carencia : undefined}
          onVerDetalhes={() => {
            if (actionSheetPasto) {
              const p = pastos.find(pp => pp.id === actionSheetPasto.id);
              setEventoPasto({ id: actionSheetPasto.id, nome: actionSheetPasto.nome, num_animais: actionSheetPasto.num_animais, peso_medio_kg: p?.peso_medio_kg ?? null });
              setDetalhesLoteOpen(true);
            }
          }}
          onTransferir={() => { setTransferPasto(actionSheetPasto); setTransferOpen(true); }}
          onAbater={() => { setAbatePasto(actionSheetPasto); setAbateOpen(true); }}
          onEntrada={() => {
            if (actionSheetPasto) {
              setEntradaPasto({ id: actionSheetPasto.id, nome: actionSheetPasto.nome });
              setEntradaOpen(true);
            }
          }}
          onEditarPeso={() => {
            if (actionSheetPasto) {
              setEditarPesoPasto(actionSheetPasto);
              setEditarPesoOpen(true);
            }
          }}
          onRegistrarEvento={() => {
            if (actionSheetPasto) {
              const p = pastos.find(pp => pp.id === actionSheetPasto.id);
              setEventoPasto({ id: actionSheetPasto.id, nome: actionSheetPasto.nome, num_animais: actionSheetPasto.num_animais, peso_medio_kg: p?.peso_medio_kg ?? null });
              setEventoSelectorOpen(true);
            }
          }}
        />

        <AbateModal
          open={abateOpen}
          onClose={() => { setAbateOpen(false); setAbatePasto(null); }}
          pasto={abatePasto}
          fazendaId={fazendaId}
          retiroId={roleData.retiroId || ""}
          mesOperacional={mesOperacional}
          anoOperacional={anoOperacional}
          onAbateConfirmed={(pastoId, qtd) => {
            setPastos(prev => prev.map(p => p.id === pastoId ? { ...p, num_animais: p.num_animais - qtd } : p));
          }}
        />

        <TransferenciaModal
          open={transferOpen}
          onClose={() => { setTransferOpen(false); setTransferPasto(null); }}
          pasto={transferPasto}
          pastos={pastos}
          fazendaId={fazendaId}
          retiroId={roleData.retiroId || ""}
          mesOperacional={mesOperacional}
          anoOperacional={anoOperacional}
          onTransferConfirmed={(origemId, destinoId, qtd) => {
            setPastos(prev => prev.map(p => {
              if (p.id === origemId) return { ...p, num_animais: p.num_animais - qtd };
              if (p.id === destinoId) return { ...p, num_animais: p.num_animais + qtd };
              return p;
            }));
            loadFromSupabase();
          }}
        />

        {entradaPasto && (
          <EntradaAnimaisModal
            open={entradaOpen}
            onClose={() => { setEntradaOpen(false); setEntradaPasto(null); }}
            pastoId={entradaPasto.id}
            pastoNome={entradaPasto.nome}
            retiroId={roleData.retiroId || ""}
            onPastoUpdated={() => { loadFromSupabase(); }}
          />
        )}
      </Suspense>
      {/* Evento modals */}
      {eventoPasto && (
        <Suspense fallback={null}>
          <SelecionarEventoModal
            open={eventoSelectorOpen}
            onClose={() => setEventoSelectorOpen(false)}
            pastoNome={eventoPasto.nome}
            onSelect={(tipo: TipoEvento) => {
              setEventoSelectorOpen(false);
              if (tipo === "pesagem") {
                setCombinedMode(false);
                setPendingSanitarioData(null);
                setPesagemOpen(true);
              } else if (tipo === "sanitario") {
                setCombinedMode(false);
                setSanitarioOpen(true);
              } else if (tipo === "pesagem_sanitario") {
                setCombinedMode(true);
                setSanitarioOpen(true);
              } else if (tipo === "observacao") {
                setObservacaoLoteOpen(true);
              }
            }}
          />

          <SanitarioFormModal
            open={sanitarioOpen}
            onClose={() => { setSanitarioOpen(false); setCombinedMode(false); }}
            pastoId={eventoPasto.id}
            pastoNome={eventoPasto.nome}
            numAnimais={eventoPasto.num_animais}
            userId={user?.id || ""}
            userName={userName}
            collectOnly={combinedMode}
            onCollected={(data) => {
              setPendingSanitarioData(data);
              setSanitarioOpen(false);
              setPesagemOpen(true);
            }}
            onSaved={() => loadFromSupabase()}
          />

          <PesagemFlowModal
            open={pesagemOpen}
            onClose={() => { setPesagemOpen(false); setPendingSanitarioData(null); }}
            pastoId={eventoPasto.id}
            pastoNome={eventoPasto.nome}
            numAnimais={eventoPasto.num_animais}
            pesoMedioAtual={eventoPasto.peso_medio_kg}
            userId={user?.id || ""}
            userName={userName}
            fazendaId={fazendaId}
            fazendaNome={retiro?.fazenda_nome || ""}
            retiroNome={retiro?.nome || ""}
            retiroId={roleData.retiroId || ""}
            sanitarioData={pendingSanitarioData}
            onSaved={() => { loadFromSupabase(); refreshPesagemCount(); }}
          />

          <ObservacaoLoteModal
            open={observacaoLoteOpen}
            onClose={() => setObservacaoLoteOpen(false)}
            pastoId={eventoPasto.id}
            pastoNome={eventoPasto.nome}
            userId={user?.id || ""}
            onSaved={() => loadFromSupabase()}
          />

          <DetalhesLoteModal
            open={detalhesLoteOpen}
            onClose={() => setDetalhesLoteOpen(false)}
            pasto={{
              id: eventoPasto.id,
              nome: eventoPasto.nome,
              num_animais: eventoPasto.num_animais,
              peso_medio_kg: eventoPasto.peso_medio_kg,
              categoria: pastos.find(p => p.id === eventoPasto.id)?.categoria ?? null,
              sexo: pastos.find(p => p.id === eventoPasto.id)?.sexo ?? null,
              ultima_movimentacao: (pastos.find(p => p.id === eventoPasto.id) as any)?.data_movimentacao ?? null,
            }}
            onVerHistorico={() => { setDetalhesLoteOpen(false); setHistoricoLoteOpen(true); }}
          />

          <HistoricoLoteModal
            open={historicoLoteOpen}
            onClose={() => setHistoricoLoteOpen(false)}
            pastoId={eventoPasto.id}
            pastoNome={eventoPasto.nome}
          />
        </Suspense>
      )}

      {/* Editar Peso Modal (inline simples) */}
      {editarPesoPasto && (
        <Suspense fallback={null}>
          <EditarPesoCapatazModal
            open={editarPesoOpen}
            onClose={() => { setEditarPesoOpen(false); setEditarPesoPasto(null); }}
            pastoId={editarPesoPasto.id}
            pastoNome={editarPesoPasto.nome}
            pesoAtual={pastos.find(p => p.id === editarPesoPasto.id)?.peso_medio_kg ?? null}
            onDone={() => { loadFromSupabase(); }}
          />
        </Suspense>
      )}

      {/* Lançamento Manual Modal */}
      {lancManualOpen && roleData.retiroId && fazendaId && (
        <Suspense fallback={null}>
          <LancamentoManualModal
            open={lancManualOpen}
            onOpenChange={setLancManualOpen}
            pastos={pastos.map(p => ({ id: p.id, nome: p.nome, num_animais: p.num_animais }))}
            retiroId={roleData.retiroId}
            fazendaId={fazendaId}
          />
        </Suspense>
      )}
    </div>
  );
}
