import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { diasCalendarioSP, dataLocalSP } from "@/lib/diasCalendario";
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
import { sendPush } from "@/lib/pushService";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";
import { EnableNotificationsBanner } from "@/components/EnableNotificationsBanner";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { UserNotificationToggle } from "@/components/UserNotificationToggle";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useRemoteSyncCommands } from "@/hooks/useRemoteSyncCommands";
import PastoCard from "@/components/capataz/PastoCard";
import type { SalgaFormDraft, SalgaSugestao } from "@/components/capataz/SalgaForm";
import EstoqueCapatazSection from "@/components/estoque/EstoqueCapatazSection";
import type { TipoEvento } from "@/components/eventos/SelecionarEventoModal";
import type { SanitarioFormData } from "@/components/eventos/SanitarioFormModal";
import { useOfflinePesagemSync } from "@/hooks/useOfflinePesagem";
import {
  cachePastos, cacheRetiro, cacheCiclos, getCachedPastos, getCachedRetiro, sortPastos,
  getCachedCiclos,
  saveLancamento, getAllLancamentos, getLancamentosPendentes, markSincronizado, deleteLancamento,
  getPastoByQr, setConfig, getConfig,
  saveObservacaoOffline, getObservacoesPendentes, getObservacoesSincronizadas,
  markObservacaoSincronizada, deleteObservacaoOffline,
  saveFecharMes, getFecharMesPendente, clearFecharMes,
  cacheProdutoAtivo, getCachedProdutoAtivo, cacheFazenda, getCachedFazenda,
  logSyncError, clearSyncError, clearRetiroScopedCache,
  type PastoCache, type RetiroCache, type CicloCache, type LancamentoOffline, type ObservacaoOffline,
  type FecharMesPendente, type ProdutoCache, type FazendaCache,
} from "@/lib/offlineDb";
import { generateAndStoreSalgaPdf, downloadBlob } from "@/lib/autoSalgaPdf";
import { maybeUpdateActiveServiceWorker } from "@/lib/swRegistration";
import { compressImageDataUrl } from "@/lib/imageCompression";

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
  formSugestao: SalgaSugestao | null;
}

const QrScanner = lazy(() => import("@/components/capataz/QrScanner"));
const SalgaForm = lazy(() => import("@/components/capataz/SalgaForm"));
const ObservacaoModal = lazy(() => import("@/components/capataz/ObservacaoModal"));
const MortalidadeModal = lazy(() => import("@/components/capataz/MortalidadeModal"));
const AbateModal = lazy(() => import("@/components/capataz/AbateModal"));
const TransferenciaModal = lazy(() => import("@/components/capataz/TransferenciaModal"));
const PastoActionSheet = lazy(() => import("@/components/capataz/PastoActionSheet"));
const EditarQuantidadeCapatazModal = lazy(() => import("@/components/capataz/EditarQuantidadeCapatazModal"));
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

const SYNC_RETRY_DELAYS_MS = [1200, 3000, 6000];

const waitForSyncRetry = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function getSyncErrorMessage(err: any): string {
  if (!err) return "Erro desconhecido";
  return err?.message || err?.details || err?.hint || String(err);
}

function isTransientSyncError(err: any): boolean {
  const msg = getSyncErrorMessage(err);
  return /load failed|failed to fetch|networkerror|network request failed|timeout|temporarily|connection|offline|abort/i.test(msg);
}

async function withSyncRetry<T>(operation: () => Promise<T>, label: string, maxAttempts = 4): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (!isTransientSyncError(err) || attempt >= maxAttempts) break;
      console.warn(`[sync] ${label}: falha de rede, tentativa ${attempt + 1}/${maxAttempts}`);
      await waitForSyncRetry(SYNC_RETRY_DELAYS_MS[Math.min(attempt - 1, SYNC_RETRY_DELAYS_MS.length - 1)]);
    }
  }
  throw lastErr;
}

function isSameLocalDay(dateIso: string, reference = new Date()) {
  // Dia de CALENDÁRIO em America/Sao_Paulo (mesma lógica de diasCalendarioSP).
  const a = dataLocalSP(dateIso);
  const b = dataLocalSP(reference);
  return !!a && a === b;
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

/**
 * Regra ÚNICA de escolha do ciclo ativo — usada pelo carregamento local e pelo servidor.
 * 1) ciclo do mês/ano atual que NÃO esteja fechado;
 * 2) senão, o ciclo aberto mais recente;
 * 3) senão, o ciclo mais recente (mesmo fechado).
 * A lista é ordenada (ano/mês desc) dentro da função para não depender da ordem da fonte.
 */
function escolherCicloAtivo(ciclos: CicloCache[]): CicloCache | undefined {
  if (!ciclos || ciclos.length === 0) return undefined;
  const ordenados = [...ciclos].sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes));
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  return (
    ordenados.find(c => c.mes === mesAtual && c.ano === anoAtual && !c.fechado) ||
    ordenados.find(c => !c.fechado) ||
    ordenados[0]
  );
}

/** Calculate dynamic dias and peso_atual based on the active cycle (or fallback to cached values). */
function calcDinamicoPasto(
  pasto: PastoCache,
  retiro: RetiroCache | null,
  ciclo: CicloCache | null,
): { dias: number | null; pesoAtual: number | null } {
  let dias: number | null = null;
  if (ciclo) {
    if (ciclo.fechado) {
      dias = ciclo.duracao_dias ?? null;
    } else {
      const dataInicio = ciclo.data_inicio ?? new Date(ciclo.ano, ciclo.mes - 1, 1).toISOString();
      dias = diasCalendarioSP(dataInicio);
    }
  }
  if (dias == null) {
    dias = pasto.dias_no_pasto;
  }
  if (dias == null) {
    return { dias: null, pesoAtual: pasto.peso_medio_kg };
  }

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

/** Arredonda sacos sugeridos com margem de 0,4: abaixo arredonda para baixo, acima/igual para cima. Mínimo 1. */
function arredondarSacosSugeridos(sacos: number): number {
  const parteInteira = Math.floor(sacos);
  const decimal = sacos - parteInteira;
  const arredondado = decimal < 0.4 ? Math.floor(sacos) : Math.ceil(sacos);
  return Math.max(1, arredondado);
}

/** Recalcula a sugestão de sacos usada no formulário de salga.
 *  Replica a lógica de openForm para garantir que, ao restaurar o estado
 *  após descarte da página pelo SO, a sugestão seja reconstruída com os
 *  dados de cache disponíveis (produto/fazenda/retiro/ciclo).
 */
function computeFormSuggestion(
  pasto: PastoCache,
  produtoAtivo: ProdutoCache | undefined,
  fazendaCache: FazendaCache | undefined,
  retiro: RetiroCache | null,
  selectedCiclo: CicloCache | undefined
): SalgaSugestao | null {
  if (!pasto || !produtoAtivo || !fazendaCache) return null;

  const { pesoAtual } = calcDinamicoPasto(pasto, retiro, selectedCiclo);
  const peso = pesoAtual ?? Number(pasto.peso_medio_kg) ?? 0;
  const categoria = pasto.categoria || 'Engorda';
  const consumo_por_100kg = getConsumoPorCategoria(categoria, produtoAtivo);
  const intervaloDias = fazendaCache.intervalo_padrao_dias || 4;

  if (consumo_por_100kg > 0 && pasto.num_animais > 0 && peso > 0) {
    const consumo_diario_kg = (pasto.num_animais * peso * consumo_por_100kg) / 100;
    const consumo_periodo_kg = consumo_diario_kg * intervaloDias;
    const sacos = arredondarSacosSugeridos(consumo_periodo_kg / produtoAtivo.peso_saco_kg);
    return {
      sacosSugeridos: sacos,
      numAnimais: pasto.num_animais,
      intervaloDias,
      pesoAtual: peso,
      produtoNome: produtoAtivo.nome,
      consumoPor100kg: consumo_por_100kg,
      categoria,
      pesoSacoKg: produtoAtivo.peso_saco_kg,
    };
  }
  return null;
}

export default function CapatazDashboard() {
  const { signOut, roleData, user } = useAuth();
  const navigate = useNavigate();

  // ===== Retiros vinculados (múltiplos) + retiro ativo =====
  const [retirosVinculados, setRetirosVinculados] = useState<{ id: string; nome: string }[]>([]);
  const [retiroAtivoId, setRetiroAtivoId] = useState<string | null>(null);
  const [trocandoRetiro, setTrocandoRetiro] = useState(false);
  const activeRetiroId = retiroAtivoId ?? roleData.retiroId ?? null;
  const [backgroundBootReady, setBackgroundBootReady] = useState(false);

  // Restaura o retiro ativo persistido e carrega a lista de vínculos
  // (cache local primeiro, depois servidor quando houver conexão).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedRetiro, savedList] = await Promise.all([
        getConfig('capatazRetiroAtivoId'),
        getConfig('capatazRetirosList'),
      ]);
      if (cancelled) return;
      if (savedList) {
        try {
          const parsed = JSON.parse(savedList) as { id: string; nome: string }[];
          if (Array.isArray(parsed)) setRetirosVinculados(parsed);
        } catch { /* cache inválido */ }
      }
      if (savedRetiro) setRetiroAtivoId(savedRetiro);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!backgroundBootReady || !roleData.roleId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("capatazes_retiros")
        .select("retiro_id, principal, retiros(nome)")
        .eq("capataz_id", roleData.roleId);
      if (cancelled || error || !data) return;
      const lista = (data as any[])
        .map((r) => ({ id: r.retiro_id as string, nome: (r.retiros?.nome as string) || 'Retiro' }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      if (lista.length === 0) return;
      setRetirosVinculados(lista);
      await setConfig('capatazRetirosList', JSON.stringify(lista));
      setRetiroAtivoId((atual) => {
        if (atual && lista.some((r) => r.id === atual)) return atual;
        const principal = (data as any[]).find((r) => r.principal)?.retiro_id as string | undefined;
        const proximo = principal || roleData.retiroId || lista[0].id;
        void setConfig('capatazRetiroAtivoId', proximo);
        return proximo;
      });
    })();
    return () => { cancelled = true; };
  }, [backgroundBootReady, roleData.roleId, roleData.retiroId]);

  // Keep the page/SW alive while the capataz is logged in to prevent
  // the browser from discarding offline state after idle time.
  useKeepAlive(Boolean(user?.id) && backgroundBootReady);
  const [bootReady, setBootReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [pastos, setPastos] = useState<PastoCache[]>([]);
  // Evita que a carga do cache local sobrescreva pastos já atualizados pelo
  // servidor (race entre loadLocalData e a sincronização inicial).
  const serverPastosLoadedRef = useRef(false);
  const [retiro, setRetiro] = useState<RetiroCache | null>(null);
  const [ciclos, setCiclos] = useState<CicloCache[]>([]);
  const [selectedCicloId, setSelectedCicloIdState] = useState<string>("");
  // Espelho do ciclo selecionado: permite ler o valor atual dentro de callbacks
  // sem colocá-lo nas dependências (evitava recriação → efeito → recarga em loop).
  const selectedCicloIdRef = useRef<string>("");
  const setSelectedCicloId = useCallback((id: string) => {
    selectedCicloIdRef.current = id;
    setSelectedCicloIdState(id);
  }, []);
  // "Servidor vence" também para ciclo/seleção: depois que o servidor carregou,
  // a carga do cache local não sobrescreve mais o ciclo ativo.
  const serverCiclosLoadedRef = useRef(false);
  const [lancamentosHoje, setLancamentosHoje] = useState<LancamentoOffline[]>([]);
  const [sacosMap, setSacosMap] = useState<Record<string, number>>({});
  const [consumoMap, setConsumoMap] = useState<Record<string, { status_consumo?: string; indice_consumo?: number }>>({});
  // Lista de Pastos: mesma fonte do Mapa e dos painéis admin/gerente
  // (view_painel_mae_pasto_atual → consumo_global / status_global). Quando
  // offline, mantém o valor local do último lançamento.
  const [consumoGlobalMap, setConsumoGlobalMap] = useState<Record<string, { status_consumo?: string; indice_consumo?: number }>>({});
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
  // Trava suave contra lançamento duplicado no mesmo dia (pede confirmação)
  const [formDuplicadoConfirmado, setFormDuplicadoConfirmado] = useState(false);
  const [duplicadoPrompt, setDuplicadoPrompt] = useState<{
    pastoId: string;
    pastoNome: string;
    tipo: 'salga' | 'falha_qr';
    justificativa?: string;
    hora: string;
  } | null>(null);
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
  const [formSugestao, setFormSugestao] = useState<{ sacosSugeridos: number; numAnimais: number; intervaloDias: number; pesoAtual: number; produtoNome: string; consumoPor100kg?: number; categoria?: string; pesoSacoKg?: number } | null>(null);

  // Abate & Transfer
  const [abateOpen, setAbateOpen] = useState(false);
  const [abatePasto, setAbatePasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPasto, setTransferPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionSheetPasto, setActionSheetPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);
  
  const [editarQtdOpen, setEditarQtdOpen] = useState(false);
  const [editarQtdPasto, setEditarQtdPasto] = useState<{ id: string; nome: string; num_animais: number } | null>(null);

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

  const [userName, setUserName] = useState<string>(user?.user_metadata?.nome && !String(user.user_metadata.nome).includes('@') ? user.user_metadata.nome : 'Capataz');

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
      });
  }, [backgroundBootReady, user?.id]);

  const { pendingCount: pesagemPendingCount, syncing: pesagemSyncing, refreshCount: refreshPesagemCount } = useOfflinePesagemSync(() => {
    loadLocalData();
  }, backgroundBootReady);

  const refreshObservacoes = useCallback(async () => {
    const [pend, hist] = await Promise.all([getObservacoesPendentes(), getObservacoesSincronizadas()]);
    const currentRetiroId = activeRetiroId || "";
    const currentFazendaId = fazendaId || "";
    const filterByScope = (o: ObservacaoOffline) =>
      (!currentRetiroId || o.retiro_id === currentRetiroId) &&
      (!currentFazendaId || o.fazenda_id === currentFazendaId);
    setObsPendentes(pend.filter(filterByScope));
    setObsHistorico(hist.filter(filterByScope));
  }, [activeRetiroId, fazendaId]);

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

  useEffect(() => {
    const retiroIdAtual = activeRetiroId;
    if (!retiroIdAtual) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("view_painel_mae_pasto_atual")
        .select("pasto_id, indice_global, status_global")
        .eq("retiro_id", retiroIdAtual);
      if (cancelled || error || !data) return;
      const map: Record<string, { status_consumo?: string; indice_consumo?: number }> = {};
      for (const row of data) {
        if (!map[row.pasto_id]) {
          map[row.pasto_id] = {
            status_consumo: row.status_global ?? undefined,
            indice_consumo: row.indice_global != null ? Number(row.indice_global) : undefined,
          };
        }
      }
      setConsumoGlobalMap(map);
    })();
    return () => { cancelled = true; };
  }, [activeRetiroId]);

  const refreshLancamentosState = useCallback(async (cicloId?: string) => {
    const [allLancamentos, pendentes] = await Promise.all([
      getAllLancamentos(),
      getLancamentosPendentes(),
    ]);

    applyLancamentosState(allLancamentos, pendentes.length, cicloId ?? selectedCicloIdRef.current);
  }, [applyLancamentosState]);

  const restoreUiState = useCallback((
    savedState: string | undefined,
    cachedPastos: PastoCache[],
    cachedRetiro: RetiroCache | null,
    cachedCiclos: CicloCache[],
    cachedProd: ProdutoCache | undefined,
    cachedFaz: FazendaCache | undefined
  ) => {
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
          const currentCiclo = cachedCiclos.find(c => c.id === selectedCicloIdRef.current) || escolherCicloAtivo(cachedCiclos);
          const sugestaoRestaurada = parsed.formSugestao ?? computeFormSuggestion(savedPasto, cachedProd, cachedFaz, cachedRetiro, currentCiclo);

          setFormPastoId(savedPasto.id);
          setFormPastoNome(parsed.formPastoNome || savedPasto.nome);
          setFormTipo(parsed.formTipo === 'falha_qr' ? 'falha_qr' : 'salga');
          setFormJustificativa(parsed.formJustificativa);
          setFormAuditoriaExigida(Boolean(parsed.formAuditoriaExigida));
          setFormDraft(parsed.formDraft ?? null);
          setFormSugestao(sugestaoRestaurada);
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
      setFormSugestao(null);
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
      formSugestao,
    };

    await setConfig('capatazUiState', JSON.stringify(uiState));
  }, [formAuditoriaExigida, formDraft, formJustificativa, formPastoId, formPastoNome, formSugestao, formTipo, manualJustificativa, manualPastoId, salgaCount, screen]);

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
    if (!serverPastosLoadedRef.current) {
      setPastos(sortPastos(cachedPastos));
    }
    setRetiro(cachedRetiro || null);
    if (!serverCiclosLoadedRef.current) {
      setCiclos(cachedCiclos);
    }
    if (savedFazendaId) setFazendaId(savedFazendaId);
    if (cachedProd) setProdutoAtivo(cachedProd);
    if (cachedFaz) setFazendaCache(cachedFaz);

    let nextCicloId = selectedCicloIdRef.current;
    if (!serverCiclosLoadedRef.current) {
      nextCicloId = cachedCiclos.length > 0 ? (escolherCicloAtivo(cachedCiclos)?.id ?? "") : "";
      setSelectedCicloId(nextCicloId);
    }
    applyLancamentosState(allLancamentos, pendentes.length, nextCicloId);

    if (!uiStateRestoredRef.current) {
      restoreUiState(savedUiState, cachedPastos, cachedRetiro || null, cachedCiclos, cachedProd, cachedFaz);
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
        .eq("id", activeRetiroId!)
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
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (pastosData) {
          const pastosOrdenados = sortPastos(pastosData);
          await cachePastos(pastosOrdenados);
          serverPastosLoadedRef.current = true;
          setPastos(pastosOrdenados);

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
          const active = escolherCicloAtivo(ciclosData as CicloCache[]);
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
  }, [refreshLancamentosState, activeRetiroId]);

  // Troca de retiro: exige conexão e recarrega todo o cache local do novo retiro.
  const handleTrocarRetiro = useCallback(async (novoRetiroId: string) => {
    if (!novoRetiroId || novoRetiroId === activeRetiroId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error('Sem conexão', {
        description: 'É preciso estar online para trocar de retiro.',
      });
      return;
    }
    setTrocandoRetiro(true);
    try {
      await clearRetiroScopedCache();
      serverPastosLoadedRef.current = false;
      setPastos([]);
      setRetiro(null);
      setCiclos([]);
      setProdutoAtivo(undefined);
      setFazendaCache(undefined);
      setFazendaId("");
      setConsumoGlobalMap({});
      setRetiroAtivoId(novoRetiroId);
      await setConfig('capatazRetiroAtivoId', novoRetiroId);
      toast.success('Retiro alterado');
    } catch {
      toast.error('Não foi possível trocar de retiro. Tente novamente.');
    } finally {
      setTrocandoRetiro(false);
    }
  }, [activeRetiroId]);

  // Try to load from Supabase on mount (if online)
  useEffect(() => {
    if (!backgroundBootReady || !activeRetiroId) return;
    void loadFromSupabase().catch((error) => {
      console.warn('[CapatazDashboard] supabase bootstrap failed:', error);
    });
  }, [backgroundBootReady, loadFromSupabase, activeRetiroId]);

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

  const horaUltimaSalgaHoje = (pastoId: string): string => {
    const doPasto = lancamentosHoje
      .filter(l => l.pasto_id === pastoId)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const ultima = doPasto[0];
    if (!ultima) return "";
    return new Date(ultima.data).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // QR scanned
  const handleQrScan = async (qrValue: string) => {
    const pasto = await getPastoByQr(qrValue);
    if (pasto) {
      if (pastoJaSalgadoHoje(pasto.id)) {
        setDuplicadoPrompt({
          pastoId: pasto.id,
          pastoNome: pasto.nome,
          tipo: 'salga',
          hora: horaUltimaSalgaHoje(pasto.id),
        });
        setScreen('salga');
        return;
      }
      openForm(pasto.id, pasto.nome, 'salga');
    } else {
      toast.error("QR Code não reconhecido");
      setScreen('scanner');
    }
  };

  const openForm = async (pastoId: string, pastoNome: string, tipo: 'salga' | 'falha_qr', justificativa?: string, duplicadoConfirmado = false) => {
    setFormDuplicadoConfirmado(duplicadoConfirmado);
    setFormPastoId(pastoId);
    setFormPastoNome(pastoNome);
    setFormTipo(tipo);
    setFormJustificativa(justificativa);
    setFormDraft(null);

    // Compute suggestion
    const pasto = pastos.find(p => p.id === pastoId);
    const sugestao = pasto ? computeFormSuggestion(pasto, produtoAtivo, fazendaCache, retiro, selectedCiclo) : null;
    setFormSugestao(sugestao);

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
        setDuplicadoPrompt({
          pastoId: pasto.id,
          pastoNome: pasto.nome,
          tipo: 'falha_qr',
          justificativa: manualJustificativa,
          hora: horaUltimaSalgaHoje(pasto.id),
        });
        return;
      }
      openForm(pasto.id, pasto.nome, 'falha_qr', manualJustificativa);
    }
  };

  const confirmarDuplicado = () => {
    const prompt = duplicadoPrompt;
    setDuplicadoPrompt(null);
    if (!prompt) return;
    void openForm(prompt.pastoId, prompt.pastoNome, prompt.tipo, prompt.justificativa, true);
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
      duplicado_confirmado: formDuplicadoConfirmado || undefined,
    };
    await saveLancamento(lancamento);
    setFormDuplicadoConfirmado(false);

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
    const pendentes = (await getLancamentosPendentes()).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
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
    // Contadores de falhas isoladas — não interrompem o lote.
    // Sincronizações simultâneas de vários capatazes não devem travar
    // o aparelho de ninguém por causa de um único registro problemático.
    let failedCount = 0;
    const failedMessages: string[] = [];

    for (let i = 0; i < pendentes.length; i++) {
      const l = pendentes[i];
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        await withSyncRetry(async () => {
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
          if (activeRetiroId) {
            const { data: retiroRow } = await supabase.from("retiros").select("produto_id").eq("id", activeRetiroId).maybeSingle();
            retiroProdutoId = retiroRow?.produto_id ?? null;
          }
          produto_id_final = pasto.produto_id || retiroProdutoId;

          // Use dynamic peso_atual for consumption calculation
          const { pesoAtual: pesoAtualCalc } = calcDinamicoPasto(pasto, retiro, selectedCiclo);
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
                dias_intervalo = diasCalendarioSP(dataAnterior, dataAtual) ?? 0;

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

        // mes/ano de referência = mês/ano CALENDÁRIO da data da salga.
        // O painel filtra por mês calendário; usar o mês do ciclo desalinha os dados
        // do painel quando o ciclo está em outro mês.
        const dataSalgaLanc = new Date(l.data);
        const mesRef = dataSalgaLanc.getMonth() + 1;
        const anoRef = dataSalgaLanc.getFullYear();

        const fotoCochoSincronizacao = l.foto_cocho_url
          ? await compressImageDataUrl(l.foto_cocho_url)
          : null;

        const insertData: Record<string, any> = {
          id: l.id,
          fazenda_id: fazendaId,
          retiro_id: activeRetiroId,
          pasto_id: l.pasto_id,
          mes_referencia: mesRef,
          ano_referencia: anoRef,
          ciclo_id: l.ciclo_id || null,
          num_sacos: l.sacos,
          num_animais: pasto?.num_animais ?? 0,
          origem: "qr",
          peso_medio_kg: pasto ? (calcDinamicoPasto(pasto, retiro, selectedCiclo).pesoAtual ?? pasto.peso_medio_kg ?? null) : null,
          dias_no_pasto: dias_intervalo ?? (pasto?.dias_no_pasto ?? 1),
          categoria: pasto?.categoria ?? null,
          sexo: pasto?.sexo ?? null,
          cocho_cheio: l.cocho_cheio ?? false,
          foto_cocho_url: fotoCochoSincronizacao ?? null,
          data_salga: l.data,
          confirmar_duplicado: l.duplicado_confirmado === true,
        };
        const { error } = await supabase.rpc("sync_capataz_lancamento" as any, {
          p_lancamento: insertData,
        });
        if (error) throw error;
        if (fotoCochoSincronizacao !== l.foto_cocho_url) {
          await saveLancamento({ ...l, foto_cocho_url: fotoCochoSincronizacao, status: 'pendente' });
        }
        await markSincronizado(l.id);
        await clearSyncError(l.id);
        }, `registro ${idx}`);
      } catch (err: any) {
        const errorMsg = getSyncErrorMessage(err);
        failedCount++;
        failedMessages.push(`Registro ${idx}: ${errorMsg}`);
        await logSyncError({ id: l.id, recordType: 'lancamento', errorMessage: errorMsg });
        console.warn(`[sync] Falha registro ${idx}, continuando:`, errorMsg);
        // Não usamos break: outros registros (e outros capatazes) seguem.
      }
    }

    // Sync observações
    for (let i = 0; i < obsPend.length; i++) {
      const obs = obsPend[i];
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        await withSyncRetry(async () => {
          const fotoObservacao = obs.foto_url ? await compressImageDataUrl(obs.foto_url) : "";
          const { error } = await supabase.from("observacoes").upsert({
            id: obs.id,
            pasto_id: obs.pasto_id || null,
            retiro_id: obs.retiro_id,
            fazenda_id: obs.fazenda_id,
            capataz_nome: obs.capataz_nome,
            tipo: obs.tipo,
            descricao: obs.descricao,
            foto_url: fotoObservacao || obs.foto_url,
            resolvido: false,
          }, { onConflict: 'id' });
          if (error) throw error;
          await markObservacaoSincronizada(obs.id);
          await clearSyncError(obs.id);
          // Push é disparado pelo trigger notificar_observacao no banco (evita duplicação)
        }, `observação ${i + 1}`);
      } catch (err: any) {
        const errorMsg = getSyncErrorMessage(err);
        failedCount++;
        failedMessages.push(`Observação ${i + 1}: ${errorMsg}`);
        await logSyncError({ id: obs.id, recordType: 'observacao', errorMessage: errorMsg });
        console.warn(`[sync] Falha observação ${i + 1}, continuando:`, errorMsg);
      }
    }

    // Sync fechar mês — só tenta se nenhum lançamento falhou (precisa de base íntegra)
    if (fecharPend && failedCount === 0) {
      idx++;
      setSyncProgress({ current: idx, total: totalPending });
      try {
        const retiroId = activeRetiroId;
        // Calcular num_dias real e duracao_dias a partir de data_inicio
        const cicloParaFechar = ciclos.find(c => c.id === fecharPend.ciclo_id);
        let numDiasReal = 30;
        let duracaoDias: number | null = null;
        const dataFim = new Date().toISOString();

        if (cicloParaFechar?.data_inicio) {
          const inicio = new Date(cicloParaFechar.data_inicio);
          const fim = new Date(dataFim);
          duracaoDias = Math.max(1, diasCalendarioSP(inicio, fim) ?? 1);
          numDiasReal = duracaoDias;
        } else if (cicloParaFechar && retiroId) {
          const { data: lancDoCiclo } = await supabase.from("lancamentos")
            .select("dias_no_pasto")
            .eq("retiro_id", retiroId)
            .eq("mes_referencia", cicloParaFechar.mes)
            .eq("ano_referencia", cicloParaFechar.ano);
          if (lancDoCiclo && lancDoCiclo.length > 0) {
            numDiasReal = Math.max(...lancDoCiclo.map(l => l.dias_no_pasto));
          }
        }

        const { error: errFechar } = await supabase.from("ciclos").update({
          fechado: true,
          fechado_em: dataFim,
          num_dias: numDiasReal,
          data_fim: dataFim,
          duracao_dias: duracaoDias,
        } as any).eq("id", fecharPend.ciclo_id);
        if (errFechar) throw errFechar;

        if (cicloParaFechar && retiroId) {
          const { error: errProximo } = await supabase.rpc("ensure_ciclo_retiro", {
            p_retiro_id: retiroId,
          });
          if (errProximo) throw errProximo;
        }

        await clearFecharMes();
        setFecharMesPendente(null);
        toast.success("✅ Mês fechado e novo ciclo criado");
      } catch (err: any) {
        const errorMsg = err?.message || err?.details || JSON.stringify(err);
        failedCount++;
        failedMessages.push(`Fechar mês: ${errorMsg}`);
        console.warn("[sync] Falha ao fechar mês, continuando:", errorMsg);
      }
    }


    const remaining = await getLancamentosPendentes();
    setPendingCount(remaining.length);

    let syncFailureMessage: string | null = null;
    if (failedCount > 0) {
      const resumo = failedMessages.slice(0, 3).join(" | ");
      syncFailureMessage = `${failedCount} item(ns) com falha: ${resumo}`;
      setSyncError(syncFailureMessage);
      toast.warning(`${failedCount} item(ns) não sincronizado(s). Tente novamente.`);
    } else if (remaining.length === 0) {
      toast.success("✅ Todos os dados sincronizados");
    }

    setScreen('home');
    await refreshLancamentosState();
    await refreshObservacoes();
    try { await loadFromSupabase(); } catch {}
    if (syncFailureMessage) throw new Error(syncFailureMessage);
  };

  // Sync engine: auto-triggers on online/visibility/mount + retry with backoff.
  // It wraps handleSync (which throws on internal failures via setSyncError → we re-throw).
  const runSyncForEngine = useCallback(async () => {
    setSyncError(null);
    await handleSync();
  }, [handleSync]);

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

  // Comando "Force Sync" do Admin/Gerente — único gatilho automático permitido.
  useRemoteSyncCommands(user?.id, () => sync.triggerSync({ force: true }), backgroundBootReady);

  const selectedCiclo = ciclos.find(c => c.id === selectedCicloId);

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
      <Suspense fallback={<DeferredFallback label="Abrindo câmera..." />}>
        <QrScanner
          onScan={handleQrScan}
          onManualSelect={handleManualSelect}
          onBack={() => setScreen('salga')}
        />
      </Suspense>
    );
  }

  const duplicadoDialog = (
    <AlertDialog open={!!duplicadoPrompt} onOpenChange={(open) => { if (!open) setDuplicadoPrompt(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pasto já salgado hoje</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicadoPrompt
              ? `Esse pasto já foi salgado hoje${duplicadoPrompt.hora ? ` às ${duplicadoPrompt.hora}` : ""}. Confirma registrar mais um lançamento?`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmarDuplicado}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (screen === 'manual-select') {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-auto">
        {duplicadoDialog}
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
      <Suspense fallback={<DeferredFallback label="Abrindo formulário..." />}>
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
      </Suspense>
    );
  }


  if (screen === 'salga') {
    const salgasHoje = lancamentosHoje;
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-auto">
        {duplicadoDialog}
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
                                Salga de "{l.pasto_nome}" ({l.cocho_cheio ? "C — cocho cheio" : `${l.sacos} sacos`}) será removida. Esta ação não pode ser desfeita.
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
        retiroId={activeRetiroId || ""}
        retiroNome={retiro?.nome || ""}
      />
    );
  }

  // ============ HOME SCREEN ============

  // Always use the current real date as the operational month
  const now = new Date();

  const mesOperacional = now.getMonth() + 1;
  const anoOperacional = now.getFullYear();
  const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mesOperacional - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-auto">
      <UpdateBanner />
      <EnableNotificationsBanner />
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
                        onClick={() => { setMenuOpen(false); setTimeout(() => setLancManualOpen(true), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <ClipboardList className="w-5 h-5 text-primary" />
                        Lançamento Manual
                      </button>
                    </li>
                    {activeRetiroId && (
                      <li>
                        <button
                          onClick={() => { const id = activeRetiroId; setMenuOpen(false); setTimeout(() => navigate(`/mapa/retiro/${id}`), 220); }}
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
                        onClick={() => { setMenuOpen(false); setTimeout(() => setScreen('transferencia-retiro'), 220); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-muted text-foreground"
                      >
                        <ArrowRightLeft className="w-5 h-5 text-primary" />
                        Transferência entre Retiros
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setMenuOpen(false); setTimeout(() => setScreen('relatorio-salga'), 220); }}
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
            <UserNotificationToggle />
            <AppVersionBadge />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {retiro && (
          <p className="text-xs opacity-70 mt-1">{retiro.nome} • {retiro.fazenda_nome}</p>
        )}
        {retirosVinculados.length > 1 && (
          <div className="mt-2">
            <Select
              value={activeRetiroId ?? undefined}
              onValueChange={(v) => { void handleTrocarRetiro(v); }}
              disabled={trocandoRetiro}
            >
              <SelectTrigger className="h-9 bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground text-xs">
                <SelectValue placeholder="Selecionar retiro" />
              </SelectTrigger>
              <SelectContent>
                {retirosVinculados.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 pb-6 overflow-auto">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleIniciarSalga} className="h-14 gap-2 text-sm font-semibold" size="lg">
            <QrCode className="w-5 h-5" />
            Iniciar Salga
          </Button>
          <Button onClick={() => sync.triggerSync(true)} variant="outline" className="h-14 gap-2 text-sm font-semibold relative" size="lg">
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
        {activeRetiroId && (
          <Button
            onClick={() => navigate(`/mapa/retiro/${activeRetiroId}`)}
            variant="outline"
            className="h-14 w-full gap-2 text-sm font-semibold"
            size="lg"
          >
            <MapIcon className="w-5 h-5" />
            Ver Mapa
          </Button>
        )}
        {activeRetiroId && fazendaId && (
          <EstoqueCapatazSection retiroId={activeRetiroId} fazendaId={fazendaId} />
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
                const cm = consumoGlobalMap[p.id] ?? consumoMap[p.id];
                const { dias, pesoAtual } = calcDinamicoPasto(p, retiro, selectedCiclo);
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
          retiroId={activeRetiroId || ""}
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
          retiroId={activeRetiroId || ""}
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
          onEditarQuantidade={() => {
            if (actionSheetPasto) {
              setEditarQtdPasto(actionSheetPasto);
              setEditarQtdOpen(true);
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
          retiroId={activeRetiroId || ""}
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
          retiroId={activeRetiroId || ""}
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

        {editarQtdPasto && (
          <EditarQuantidadeCapatazModal
            open={editarQtdOpen}
            onClose={() => { setEditarQtdOpen(false); setEditarQtdPasto(null); }}
            pastoId={editarQtdPasto.id}
            pastoNome={editarQtdPasto.nome}
            numAnimaisAtual={pastos.find(p => p.id === editarQtdPasto.id)?.num_animais ?? editarQtdPasto.num_animais}
            pesoAtual={pastos.find(p => p.id === editarQtdPasto.id)?.peso_medio_kg ?? null}
            sexoAtual={pastos.find(p => p.id === editarQtdPasto.id)?.sexo ?? null}
            categoriaAtual={pastos.find(p => p.id === editarQtdPasto.id)?.categoria ?? null}
            ativoAtual={true}
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
            retiroId={activeRetiroId || ""}
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


      {/* Lançamento Manual Modal */}
      {lancManualOpen && activeRetiroId && fazendaId && (
        <Suspense fallback={null}>
          <LancamentoManualModal
            open={lancManualOpen}
            onOpenChange={setLancManualOpen}
            pastos={pastos.map(p => ({ id: p.id, nome: p.nome, num_animais: p.num_animais }))}
            retiroId={activeRetiroId}
            fazendaId={fazendaId}
          />
        </Suspense>
      )}
    </div>
  );
}
