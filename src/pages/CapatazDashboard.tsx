import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, QrCode, RefreshCw, Lock, Loader2, CheckCircle2, ScanLine, ArrowLeft, Trash2, AlertTriangle, Eye, Pencil, Map as MapIcon, ArrowRightLeft } from "lucide-react";
import { calcularConsumo, getConsumoPorCategoria, getMargemPorCategoria } from "@/lib/consumoCalc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";
import PastoCard from "@/components/capataz/PastoCard";
import QrScanner from "@/components/capataz/QrScanner";
import SalgaForm, { type SalgaFormDraft } from "@/components/capataz/SalgaForm";
import ObservacaoModal from "@/components/capataz/ObservacaoModal";
import MortalidadeModal from "@/components/capataz/MortalidadeModal";
import AbateModal from "@/components/capataz/AbateModal";
import TransferenciaModal from "@/components/capataz/TransferenciaModal";
import PastoActionSheet from "@/components/capataz/PastoActionSheet";
import EstoqueCapatazSection from "@/components/estoque/EstoqueCapatazSection";
import EntradaAnimaisModal from "@/components/capataz/EntradaAnimaisModal";
import TransferenciaRetiroPage from "@/pages/TransferenciaRetiroPage";
import {
  cachePastos, cacheRetiro, cacheCiclos, getCachedPastos, getCachedRetiro,
  getCachedCiclos,
  saveLancamento, getAllLancamentos, getLancamentosPendentes, markSincronizado, deleteLancamento,
  getPastoByQr, setConfig, getConfig,
  saveObservacaoOffline, getObservacoesPendentes, getObservacoesSincronizadas,
  markObservacaoSincronizada, deleteObservacaoOffline,
  saveFecharMes, getFecharMesPendente, clearFecharMes,
  type PastoCache, type RetiroCache, type CicloCache, type LancamentoOffline, type ObservacaoOffline,
  type FecharMesPendente,
} from "@/lib/offlineDb";

type Screen = 'home' | 'prep' | 'salga' | 'scanner' | 'form' | 'manual-select' | 'syncing' | 'transferencia-retiro';
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

  // Abate & Transfer
  const [abateOpen, setAbateOpen] = useState(false);
  const [abatePasto, setAbatePasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPasto, setTransferPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionSheetPasto, setActionSheetPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [entradaPasto, setEntradaPasto] = useState<{ id: string; nome: string } | null>(null);

  const userName = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Capataz';

  const refreshObservacoes = useCallback(async () => {
    const [pend, hist] = await Promise.all([getObservacoesPendentes(), getObservacoesSincronizadas()]);
    setObsPendentes(pend);
    setObsHistorico(hist);
  }, []);

  const applyLancamentosState = useCallback((allLancamentos: LancamentoOffline[], pendingCountValue: number, cicloId?: string) => {
    setLancamentosHoje(allLancamentos.filter((lancamento) => isSameLocalDay(lancamento.data)));
    setSacosMap(buildSacosMap(allLancamentos, cicloId));
    setPendingCount(pendingCountValue);
    // Build consumo map from latest lancamento per pasto
    const cMap: Record<string, { status_consumo?: string; indice_consumo?: number }> = {};
    const sorted = [...allLancamentos].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    for (const l of sorted) {
      if (!cMap[l.pasto_id] && l.status_consumo) {
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
    const [cachedPastos, cachedRetiro, cachedCiclos, allLancamentos, pendentes, savedCiclo, savedUiState, savedFazendaId] = await Promise.all([
      getCachedPastos(),
      getCachedRetiro(),
      getCachedCiclos(),
      getAllLancamentos(),
      getLancamentosPendentes(),
      getConfig('selectedCicloId'),
      getConfig('capatazUiState'),
      getConfig('fazendaId'),
    ]);
    setPastos(cachedPastos);
    setRetiro(cachedRetiro || null);
    setCiclos(cachedCiclos);
    if (savedFazendaId) setFazendaId(savedFazendaId);

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
        .select("id, nome, fazenda_id, gmd_recria1, gmd_recria2, gmd_engorda")
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
          gmd_recria1: retiroData.gmd_recria1,
          gmd_recria2: retiroData.gmd_recria2,
          gmd_engorda: retiroData.gmd_engorda,
        };
        await cacheRetiro(retiroCache);
        setRetiro(retiroCache);
        setFazendaId(retiroData.fazenda_id);
        await setConfig('fazendaId', retiroData.fazenda_id);

        // Get pastos
        const { data: pastosData } = await supabase
          .from("pastos")
          .select("id, nome, num_animais, peso_medio_kg, dias_no_pasto, qr_uuid, produto_id, sexo, categoria, data_entrada, peso_entrada, gmd_kg_dia")
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
        // --- Consumption calculation ---
        let consumo_esperado_kg: number | null = null;
        let consumo_real_kg: number | null = null;
        let indice_consumo: number | null = null;
        let status_consumo: string | null = null;
        let dias_intervalo: number | null = null;
        let produto_id_final: string | null = null;

        const pasto = pastos.find(p => p.id === l.pasto_id);
        if (pasto) {
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
          peso_medio_kg: pesoParaConsumo || pasto?.peso_medio_kg ?? null,
          dias_no_pasto: dias_intervalo ?? (pasto?.dias_no_pasto ?? 1),
          categoria: pasto?.categoria ?? null,
          sexo: pasto?.sexo ?? null,
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

  if (screen === 'transferencia-retiro') {
    return <TransferenciaRetiroPage onBack={() => setScreen('home')} />;
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
            {(pendingCount + obsPendentes.length + (fecharMesPendente ? 1 : 0)) > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold">
                {pendingCount + obsPendentes.length + (fecharMesPendente ? 1 : 0)}
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
          <Button onClick={() => navigate(`/mapa/retiro/${roleData.retiroId}`)} variant="outline" className="w-full h-12 gap-2 text-sm font-semibold" size="lg">
            <MapIcon className="w-5 h-5" />
            Ver Mapa
          </Button>
        )}
        <Button onClick={() => setScreen('transferencia-retiro')} variant="outline" className="w-full h-12 gap-2 text-sm font-semibold" size="lg">
          <ArrowRightLeft className="w-5 h-5" />
          Transferência entre Retiros
        </Button>

        {/* Estoque de Sal */}
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
        onTransferir={() => { setTransferPasto(actionSheetPasto); setTransferOpen(true); }}
        onAbater={() => { setAbatePasto(actionSheetPasto); setAbateOpen(true); }}
        onMortalidade={() => { setMortalidadeOpen(true); }}
        onEntrada={() => {
          if (actionSheetPasto) {
            setEntradaPasto({ id: actionSheetPasto.id, nome: actionSheetPasto.nome });
            setEntradaOpen(true);
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
    </div>
  );
}
