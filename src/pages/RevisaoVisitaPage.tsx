import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MentionTextarea from "@/components/consultor/MentionTextarea";
import MentionablePhoto from "@/components/consultor/MentionablePhoto";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, X, ChevronUp, ChevronDown, Check, FileText, Download, Share2, CloudOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateVisitaPdf, uploadVisitaPdf } from "@/lib/visitaPdf";
import { useNumeroMapFotos } from "@/hooks/useNumeroMapFotos";
import { computeRotinaPhotoNumbering } from "@/lib/photoNumbering";
import ConfinamentoRevisaoView from "@/components/consultor/ConfinamentoRevisaoView";
import ScoreSamplesInput, { ScoreSample, averageOf } from "@/components/consultor/ScoreSamplesInput";
import ConsumoPastoChart from "@/components/consultor/ConsumoPastoChart";
import VisitaTopicosSection, { Topico } from "@/components/consultor/VisitaTopicosSection";
import AssinaturasSection, { fetchAssinantes, type Assinante } from "@/components/consultor/AssinaturasSection";
import VisitaDateTimeEditor from "@/components/consultor/VisitaDateTimeEditor";

import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { hasPendingLocalChanges, isVisitaDeleted, offlineUpdate, offlineUpsert, offlineDelete, saveSnapshot, loadSnapshot, patchSnapshot } from "@/lib/consultorOffline/snapshotStore";
import { getErrorMessage, withConsultorTimeout } from "@/lib/consultorOffline/network";
import { enqueuePhoto } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto, updateFotoOrdem } from "@/lib/consultorOffline/db";
import PdfViewerDialog from "@/components/consultor/PdfViewerDialog";
import { prepareConsultorPhotoFile } from "@/lib/consultorOffline/photoBlob";

const BUCKET = "visitas-consultor-fotos";

const PRODUTOS = [
  { value: "mineral", label: "Mineral" },
  { value: "racao", label: "Ração" },
  { value: "proteinado_0.1", label: "Proteinado 0,1%" },
  { value: "proteinado_0.3", label: "Proteinado 0,3%" },
  { value: "proteinado_0.5", label: "Proteinado 0,5%" },
  { value: "proteinado_1", label: "Proteinado 1%" },
  { value: "outro", label: "Outro" },
];

const PRODUTO_LABEL_MAP: Record<string, string> = Object.fromEntries(PRODUTOS.map(p => [p.value, p.label]));

export type IndicadorKey =
  | "lotes_avaliados" | "animais_avaliados" | "peso_medio_rebanho"
  | "estrategias_nutricionais" | "score_corporal" | "score_fezes"
  | "condicao_bebedouros" | "qualidade_pastagens" | "taxa_lotacao" | "taxa_lotacao_ha";

export interface IndicadorRow { key: IndicadorKey; label: string; value: string; }

/** 1 alqueire (paulista) = 2,42 ha; fator adotado pelo cliente: 4,84. */
export const ALQ_TO_HA_FACTOR = 4.84;

export function parseAlqueires(v: string): number | null {
  const s = (v || "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** UA de um pasto = (qtd_animais × peso_medio_kg) / 450 */
export function computeUAPasto(qtd: number | null, peso: number | null): number {
  const q = Number(qtd || 0);
  const pm = Number(peso || 0);
  return q > 0 && pm > 0 ? (q * pm) / 450 : 0;
}

/** UA/ha individual do pasto = (UA_pasto / area_alqueires) / 4,84 */
export function computeUAHaPasto(
  qtd: number | null, peso: number | null, areaAlq: number | null,
): number | null {
  if (!areaAlq || !(areaAlq > 0)) return null;
  const ua = computeUAPasto(qtd, peso);
  if (!(ua > 0)) return null;
  return ua / areaAlq / ALQ_TO_HA_FACTOR;
}

// UA = (qtd_animais × peso_medio_kg) / 450 ; Taxa = ΣUA / área (alqueires)
export function computeTaxaLotacao(
  pastos: { qtd_animais: number | null; peso_medio_kg: number | null }[],
  areaAlqueires: number | null,
): number | null {
  if (!areaAlqueires || !(areaAlqueires > 0)) return null;
  const totalUA = pastos.reduce((s, p) => s + computeUAPasto(p.qtd_animais, p.peso_medio_kg), 0);
  if (!(totalUA > 0)) return null;
  return totalUA / areaAlqueires;
}

export interface AreaResolvida {
  area: number | null;
  origem: "pastos" | "manual" | null;
  comArea: number;
  totalPastos: number;
  nota: string | null;
}

/**
 * Precedência: se ao menos 1 pasto informar área individual, usa a SOMA dessas
 * áreas (ignora o campo geral manual). Caso contrário, usa a área total manual.
 */
export function resolveAreaTotal(
  pastos: { area_alqueires?: number | null }[],
  areaManual: number | null,
): AreaResolvida {
  const totalPastos = pastos.length;
  const comArea = pastos.filter(p => Number(p.area_alqueires || 0) > 0);
  const somaPastos = comArea.reduce((s, p) => s + Number(p.area_alqueires || 0), 0);
  if (comArea.length > 0 && somaPastos > 0) {
    const parcial = comArea.length < totalPastos;
    return {
      area: somaPastos,
      origem: "pastos",
      comArea: comArea.length,
      totalPastos,
      nota: parcial
        ? `Calculado com base na área informada por pasto — área somada de ${comArea.length} de ${totalPastos} pastos avaliados.`
        : "Calculado com base na área informada por pasto.",
    };
  }
  if (areaManual && areaManual > 0) {
    return {
      area: areaManual, origem: "manual", comArea: 0, totalPastos,
      nota: "Calculado com base na área total informada.",
    };
  }
  return { area: null, origem: null, comArea: 0, totalPastos, nota: null };
}

export function computeIndicadoresAuto(pastos: {
  qtd_animais: number | null;
  peso_medio_kg: number | null;
  tipo_produto: string | null;
  area_alqueires?: number | null;
  samples: { fezes: { nota: number }[]; corporal: { nota: number }[]; bebedouro: { nota: number }[] };
}[], areaAlqueires?: number | null): Record<IndicadorKey, string> {
  const lotes = pastos.length;
  const animais = pastos.reduce((s, p) => s + (p.qtd_animais || 0), 0);
  const somaPeso = pastos.reduce((s, p) => s + (p.qtd_animais || 0) * (p.peso_medio_kg || 0), 0);
  const somaAnimComPeso = pastos.reduce((s, p) => s + ((p.peso_medio_kg || 0) > 0 ? (p.qtd_animais || 0) : 0), 0);
  const pesoMedio = somaAnimComPeso > 0 ? Math.round(somaPeso / somaAnimComPeso) : 0;
  const produtos = Array.from(new Set(pastos.map(p => p.tipo_produto).filter(Boolean) as string[]))
    .map(v => PRODUTO_LABEL_MAP[v] || v);
  const estrategias = produtos.join(" + ");
  const avgAll = (arr: number[]) => arr.length ? (arr.reduce((a,b) => a+b, 0) / arr.length) : 0;
  const fezes = avgAll(pastos.flatMap(p => p.samples.fezes.map(s => s.nota)));
  const corp = avgAll(pastos.flatMap(p => p.samples.corporal.map(s => s.nota)));
  const beb = avgAll(pastos.flatMap(p => p.samples.bebedouro.map(s => s.nota)));
  const fmtScore = (n: number) => n > 0 ? `${n.toFixed(1).replace(".",",")} / 5` : "—";
  const taxa = computeTaxaLotacao(pastos, resolveAreaTotal(pastos, areaAlqueires ?? null).area);
  const taxaHa = taxa != null ? taxa / ALQ_TO_HA_FACTOR : null;
  return {
    lotes_avaliados: lotes ? String(lotes) : "—",
    animais_avaliados: animais ? animais.toLocaleString("pt-BR") : "—",
    peso_medio_rebanho: pesoMedio ? `${pesoMedio} kg` : "—",
    estrategias_nutricionais: estrategias || "—",
    score_corporal: fmtScore(corp),
    score_fezes: fmtScore(fezes),
    condicao_bebedouros: fmtScore(beb),
    qualidade_pastagens: "—",
    taxa_lotacao: taxa != null ? `${taxa.toFixed(2).replace(".", ",")} UA/alqueire` : "—",
    taxa_lotacao_ha: taxaHa != null ? `${taxaHa.toFixed(2).replace(".", ",")} UA/ha` : "—",
  };
}

export const NOTA_UA = "Valores de UA calculados com base apenas nos pastos avaliados nesta visita.";

export const INDICADOR_LABELS: { key: IndicadorKey; label: string }[] = [
  { key: "lotes_avaliados", label: "Lotes avaliados" },
  { key: "animais_avaliados", label: "Animais avaliados" },
  { key: "peso_medio_rebanho", label: "Peso médio do rebanho avaliado" },
  { key: "estrategias_nutricionais", label: "Estratégias nutricionais" },
  { key: "score_corporal", label: "Score corporal médio" },
  { key: "score_fezes", label: "Score de fezes" },
  { key: "condicao_bebedouros", label: "Condição média dos bebedouros" },
  { key: "qualidade_pastagens", label: "Qualidade das pastagens" },
  { key: "taxa_lotacao", label: "Taxa de Lotação (UA/alqueire)" },
  { key: "taxa_lotacao_ha", label: "Taxa de Lotação (UA/ha)" },
];



interface Foto { id: string; url: string; ordem: number; }
export function isRenderablePastoFoto(foto: Foto | null | undefined): foto is Foto {
  return Boolean(foto?.id && typeof foto.url === "string" && foto.url.trim());
}
interface Pasto {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  categoria: string | null;
  peso_medio_kg: number | null;
  consumo_esperado_kg: number | null;
  consumo_real_kg: number | null;
  area_alqueires: number | null;
  observacao: string | null;
  ordem: number;
  samples: { fezes: ScoreSample[]; corporal: ScoreSample[]; bebedouro: ScoreSample[] };
  fotos: Foto[];
  signed: Record<string, string>;
}
interface Visita {
  id: string; tipo: string; status: string; hora_inicio: string; hora_fim: string | null;
  observacoes_gerais: string | null; conclusao: string | null;
  fazenda_consultor_id: string; consultor_id: string;
  pdf_url: string | null;
  objetivo_visita: string | null;
  resumo_executivo: string | null;
  indicadores_gerais: string | null;
  fazenda_nome_override?: string | null;
  localizacao_override?: string | null;
  proprietario_override?: string | null;
  responsavel_override?: string | null;
  consultor_nome_override?: string | null;
  deleted_at?: string | null;
}

type CabecalhoKey = "fazenda_nome" | "localizacao" | "proprietario" | "responsavel" | "consultor_nome";
const CABECALHO_FIELDS: { key: CabecalhoKey; label: string }[] = [
  { key: "fazenda_nome", label: "Fazenda" },
  { key: "localizacao", label: "Localização" },
  { key: "proprietario", label: "Proprietário" },
  { key: "responsavel", label: "Responsável" },
  { key: "consultor_nome", label: "Consultor" },
];

import { getCachedSignedUrl } from "@/lib/consultorOffline/signedUrlCache";
async function signPath(path: string): Promise<string> {
  return getCachedSignedUrl(path);
}

export default function RevisaoVisitaPage() {
  const { visitaId } = useParams<{ visitaId: string }>();
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [tipoLoaded, setTipoLoaded] = useState<string | null>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [consultor, setConsultor] = useState<any>(null);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [obsGerais, setObsGerais] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [resumo, setResumo] = useState("");
  const [indicadores, setIndicadores] = useState("");
  const [indicadoresTabela, setIndicadoresTabela] = useState<Record<string, string>>({});
  const [areaAlqueires, setAreaAlqueires] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<CabecalhoKey, string>>({
    fazenda_nome: "", localizacao: "", proprietario: "", responsavel: "", consultor_nome: "",
  });
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const numeroMap = useNumeroMapFotos({
    visitaId,
    tipo: "rotina",
    topicos: topicos.map(t => ({ id: t.id, ordem: t.ordem, zona: t.zona, fotos: t.fotos })),
    itens: pastos.map(p => ({ id: p.id, fotos: p.fotos })),
  });
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const { pending: pendingUploads } = useSyncStatus();
  const [hadPendingUploads, setHadPendingUploads] = useState(false);
  const [pendingThisVisit, setPendingThisVisit] = useState(false);
  const [fotosPendentesAviso, setFotosPendentesAviso] = useState<number | null>(null);
  const [sincronizandoFotos, setSincronizandoFotos] = useState(false);

  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [salvandoOffline, setSalvandoOffline] = useState(false);
  const [pdfVisualizar, setPdfVisualizar] = useState<{ url: string; nome: string } | null>(null);
  type SCK = "bars" | "lines" | "pie" | "radar";
  const [sampleChartFezes, setSampleChartFezes] = useState<SCK>("lines");
  const [sampleChartCorporal, setSampleChartCorporal] = useState<SCK>("lines");
  const [sampleChartBebedouro, setSampleChartBebedouro] = useState<SCK>("lines");

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!visitaId) return;
    (async () => {
      const { data } = await supabase.from("visitas_tecnicas").select("tipo").eq("id", visitaId).is("deleted_at", null).maybeSingle();
      if (data?.tipo) {
        setTipoLoaded(data.tipo as string);
      } else {
        const snap = await loadSnapshot(visitaId);
        setTipoLoaded((snap?.visita?.tipo as string) || "rotina");
      }
    })();
  }, [visitaId]);

  useEffect(() => { if (visitaId && tipoLoaded && tipoLoaded !== "confinamento") load(false); }, [visitaId, tipoLoaded]);
  useEffect(() => {
    if (pendingUploads > 0) setHadPendingUploads(true);
    if (pendingUploads === 0 && hadPendingUploads && visitaId && tipoLoaded && tipoLoaded !== "confinamento") {
      setHadPendingUploads(false);
      void load(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUploads, hadPendingUploads, visitaId, tipoLoaded]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const snap = visitaId ? await loadSnapshot(visitaId) : null;
    const online = typeof navigator === "undefined" || navigator.onLine;
    const preferLocal = !!snap?.visita && visitaId ? await hasPendingLocalChanges(visitaId) : false;
    const { data: v } = online && !preferLocal
      ? await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId!).is("deleted_at", null).maybeSingle()
      : { data: null };
    const visitaRow = preferLocal ? snap?.visita : (v as any) || snap?.visita;
    if (isVisitaDeleted(visitaRow as any)) { setVisita(null); setLoading(false); return; }
    if (!visitaRow) { setLoading(false); return; }
    setVisita(visitaRow as any);
    setObsGerais(visitaRow.observacoes_gerais || "");
    setConclusao(visitaRow.conclusao || "");
    setObjetivo((visitaRow as any).objetivo_visita || "");
    setResumo((visitaRow as any).resumo_executivo || "");
    setIndicadores((visitaRow as any).indicadores_gerais || "");
    setIndicadoresTabela(((visitaRow as any).indicadores_tabela as Record<string,string>) || {});
    setAreaAlqueires(
      (visitaRow as any).area_total_alqueires != null
        ? String((visitaRow as any).area_total_alqueires).replace(".", ",")
        : ""
    );
    setOverrides({
      fazenda_nome: (visitaRow as any).fazenda_nome_override || "",
      localizacao: (visitaRow as any).localizacao_override || "",
      proprietario: (visitaRow as any).proprietario_override || "",
      responsavel: (visitaRow as any).responsavel_override || "",
      consultor_nome: (visitaRow as any).consultor_nome_override || "",
    });

    const [{ data: fz }, { data: cs }, { data: ps }] = online && !preferLocal
      ? await Promise.all([
          supabase.from("fazendas_consultor").select("*").eq("id", visitaRow.fazenda_consultor_id).maybeSingle(),
          supabase.from("consultores").select("*").eq("id", visitaRow.consultor_id).maybeSingle(),
          supabase.from("visita_pastos").select("*").eq("visita_id", visitaId!).order("ordem"),
        ])
      : [{ data: null }, { data: null }, { data: null }];
    const fazendaRow = fz || snap?.fazenda;
    const consultorRow = cs || snap?.consultor;
    setFazenda(fazendaRow); setConsultor(consultorRow);

    let pastoRows = (ps as any[]) || [];
    if (pastoRows.length === 0 && snap?.pastos?.length) pastoRows = snap.pastos as any[];
    const ids = pastoRows.map(p => p.id);
    const samplesByPasto: Record<string, { fezes: ScoreSample[]; corporal: ScoreSample[]; bebedouro: ScoreSample[] }> = {};
    const fotosByPasto: Record<string, Foto[]> = {};
    if (ids.length && online && !preferLocal) {
      const [{ data: sc }, { data: ft }] = await Promise.all([
        supabase.from("avaliacoes_score").select("id, visita_pasto_id, tipo, nota").in("visita_pasto_id", ids),
        supabase.from("visita_fotos").select("*").in("visita_pasto_id", ids).order("ordem"),
      ]);
      (sc || []).forEach((s: any) => {
        const bucket = samplesByPasto[s.visita_pasto_id] ??= { fezes: [], corporal: [], bebedouro: [] };
        if (s.tipo in bucket) bucket[s.tipo as "fezes"|"corporal"|"bebedouro"].push({ id: s.id, nota: s.nota });
      });
      (ft || []).forEach((f: any) => {
        fotosByPasto[f.visita_pasto_id] = [...(fotosByPasto[f.visita_pasto_id] || []), f];
      });
    }
    const built: Pasto[] = await Promise.all(pastoRows.map(async p => {
      const snapPasto = (snap?.pastos || []).find((x: any) => x.id === p.id) as any;
      const fallbackFotos = Array.isArray((p as any).fotos) ? (p as any).fotos : (snapPasto?.fotos || []);
      const remoteFotos = fotosByPasto[p.id] || [];
      const queuedFotos = fallbackFotos.filter((f: any) => String(f.url || "").startsWith("queued:"));
      const fotos = remoteFotos.length ? [...remoteFotos, ...queuedFotos.filter((q: any) => !remoteFotos.some((r: any) => r.ordem === q.ordem))] : fallbackFotos;
      const signed: Record<string, string> = { ...(snapPasto?.signed || {}), ...((p as any).signed || {}) };
      await Promise.all(fotos
        .filter((f: any) => online && !preferLocal && !String(f.url || "").startsWith("queued:"))
        .map(async f => { signed[f.id] = await signPath(f.url); }));
      return {
        ...p,
        samples: samplesByPasto[p.id] || (p as any).samples || snapPasto?.samples || { fezes: [], corporal: [], bebedouro: [] },
        fotos, signed,
      } as Pasto;
    }));
    setPastos(built);
    setPendingThisVisit(await hasPendingLocalChanges(visitaId!));
    // Snapshot local — permite reabrir a visita offline com dados pré-carregados
    if (!preferLocal) {
      void saveSnapshot(visitaId!, {
        ...(snap || {}),
        visita: visitaRow,
        fazenda: fazendaRow,
        consultor: consultorRow,
        pastos: built,
      }).catch(() => {});
    }
    setLoading(false);
  }

  async function notifyEdit() {
    if (!visita || visita.status !== "finalizada") return;
    await offlineUpdate({ visitaId: visita.id, table: "visitas_tecnicas", rowId: visita.id, patch: { pdf_url: null, status: "revisao" } });
    setVisita(prev => prev ? { ...prev, pdf_url: null, status: "revisao" } : prev);
  }

  async function autosavePasto(pastoId: string, patch: Partial<Pasto>) {
    await notifyEdit();
    const dbPatch: any = {};
    ["letra","num_pasto","qtd_animais","tipo_produto","percentual_pv","consumo_kg_dia","consumo_real_kg","consumo_esperado_kg","peso_medio_kg","categoria","area_alqueires","observacao"].forEach(k => {
      if (k in patch) dbPatch[k] = (patch as any)[k];
    });
    if (Object.keys(dbPatch).length === 0) return;
    const res = await offlineUpdate({
      visitaId: visitaId!,
      table: "visita_pastos",
      rowId: pastoId,
      patch: dbPatch,
      applyToSnapshot: (curr, p) => ({
        ...curr,
        pastos: (curr.pastos || []).map((x: any) => x.id === pastoId ? { ...x, ...p } : x),
      }),
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar");
  }

  function updatePasto(id: string, patch: Partial<Pasto>) {
    setPastos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  async function addSample(pastoId: string, tipo: "fezes"|"corporal"|"bebedouro", nota: number) {
    await notifyEdit();
    const id = crypto.randomUUID();
    const res = await offlineUpsert({
      visitaId: visitaId!,
      table: "avaliacoes_score",
      rowId: id,
      payload: { visita_pasto_id: pastoId, tipo, nota },
      applyToSnapshot: (curr) => ({
        ...curr,
        pastos: (curr.pastos || []).map((p: any) => p.id === pastoId
          ? { ...p, samples: { ...(p.samples || {}), [tipo]: [...((p.samples || {})[tipo] || []), { id, nota }] } }
          : p),
      }),
    });
    if (!res.ok && !res.queued) { toast.error("Erro ao adicionar amostra"); return; }
    setPastos(prev => prev.map(p => p.id === pastoId
      ? { ...p, samples: { ...p.samples, [tipo]: [...p.samples[tipo], { id, nota }] } }
      : p));
  }

  async function removeSample(pastoId: string, tipo: "fezes"|"corporal"|"bebedouro", index: number) {
    await notifyEdit();
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    const s = p.samples[tipo][index]; if (!s?.id) return;
    await offlineDelete({
      visitaId: visitaId!,
      table: "avaliacoes_score",
      rowId: s.id,
      applyToSnapshot: (curr) => ({
        ...curr,
        pastos: (curr.pastos || []).map((p: any) => p.id === pastoId
          ? { ...p, samples: { ...(p.samples || {}), [tipo]: ((p.samples || {})[tipo] || []).filter((x: any) => x.id !== s.id) } }
          : p),
      }),
    });
    setPastos(prev => prev.map(x => x.id === pastoId
      ? { ...x, samples: { ...x.samples, [tipo]: x.samples[tipo].filter((_, i) => i !== index) } }
      : x));
  }

  async function autosaveVisita(patch: Partial<Visita>) {
    await notifyEdit();
    const res = await offlineUpdate({
      visitaId: visitaId!,
      table: "visitas_tecnicas",
      rowId: visitaId!,
      patch: patch as any,
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar");
  }

  async function addFoto(pastoId: string, file: File) {
    await notifyEdit();
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    if (p.fotos.length >= 5) { toast.error("Máx. 5 fotos"); return; }
    const usadas = new Set(p.fotos.map(f => f.ordem));
    let ordem = 1;
    while (usadas.has(ordem) && ordem <= 5) ordem++;
    try {
      const { dataUrl, blob } = await prepareConsultorPhotoFile(file);
      const queued = await enqueuePhoto({ visitaId: visitaId!, parentKind: "pasto", parentId: pastoId, ordem, blob, fileName: file.name });
      const data = { id: queued.localId, url: `queued:${queued.localId}`, ordem } as Foto;
      updatePasto(pastoId, {
        fotos: [...p.fotos, data].sort((a, b) => a.ordem - b.ordem),
        signed: { ...p.signed, [data.id]: dataUrl },
      });
      await patchSnapshot(visitaId!, (curr) => ({
        ...curr,
        pastos: (curr.pastos || []).map((x: any) => x.id === pastoId
          ? (() => {
              const current = (x.fotos || []) as Foto[];
              const alreadySyncedAtSlot = current.some((f) => f.ordem === ordem && !String(f.url || "").startsWith("queued:"));
              const alreadyQueued = current.some((f) => f.id === data.id || f.url === data.url);
              const fotos = alreadySyncedAtSlot || alreadyQueued ? current : [...current, data].sort((a: Foto, b: Foto) => a.ordem - b.ordem);
              return { ...x, fotos, signed: { ...(x.signed || {}), [data.id]: dataUrl } };
            })()
          : x),
      }));
      toast.info("Foto salva off-line. Sincronize quando houver internet.");
    } catch (err: any) {
      toast.error("Erro ao preparar foto: " + (err?.message || ""));
    }
  }

  async function delFoto(pastoId: string, f: Foto) {
    await notifyEdit();
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    if (String(f.url).startsWith("queued:")) {
      await deleteQueuedFoto(f.id);
    } else {
      if (typeof navigator === "undefined" || navigator.onLine) await supabase.storage.from(BUCKET).remove([f.url]);
      await offlineDelete({ visitaId: visitaId!, table: "visita_fotos", rowId: f.id });
    }
    updatePasto(pastoId, { fotos: p.fotos.filter(x => x.id !== f.id) });
    await patchSnapshot(visitaId!, (curr) => ({
      ...curr,
      pastos: (curr.pastos || []).map((x: any) => x.id === pastoId
        ? { ...x, fotos: (x.fotos || []).filter((foto: Foto) => foto.id !== f.id) }
        : x),
    }));
  }

  async function moveFoto(pastoId: string, index: number, dir: -1 | 1) {
    await notifyEdit();
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    const arr = [...p.fotos];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const updates = arr.map((f, i) => ({ ...f, ordem: i + 1 }));
    updatePasto(pastoId, { fotos: updates });
    await patchSnapshot(visitaId!, (curr) => ({
      ...curr,
      pastos: (curr.pastos || []).map((x: any) => x.id === pastoId ? { ...x, fotos: updates } : x),
    }));
    await Promise.all(updates
      .filter(u => String(u.url).startsWith("queued:"))
      .map(u => updateFotoOrdem(u.id, u.ordem))
    );
    await Promise.all(updates
      .filter(u => !String(u.url).startsWith("queued:"))
      .map(u => offlineUpdate({ visitaId: visitaId!, table: "visita_fotos", rowId: u.id, patch: { ordem: u.ordem } }))
    );
  }

  async function confirmarRevisao() {
    setConfirmando(true);
    try {
      await autosaveVisita({ observacoes_gerais: obsGerais, conclusao, status: "revisao" as any });
      toast.success("Visita revisada. Pronta para gerar o PDF.");
      await load(true);
    } finally { setConfirmando(false); }
  }

  async function gerarPdf(opts?: { ignorarFotosPendentes?: boolean }) {
    if (!visita || !fazenda || !consultor) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Conecte à internet e sincronize antes de gerar o PDF.");
      return;
    }
    // Se houver pendências desta visita, sincroniza primeiro e aguarda concluir.
    if (await hasPendingLocalChanges(visita.id)) {
      const tSync = toast.loading("Sincronizando dados desta visita…");
      const { syncVisitaWithRetries } = await import("@/lib/consultorOffline/snapshotStore");
      const result = await syncVisitaWithRetries(visita.id, { attempts: 3, totalTimeoutMs: 90000 });
      toast.dismiss(tSync);
      if (!result.ok) {
        setPendingThisVisit(true);
        const motivo = result.reason || "Ainda há itens pendentes.";
        toast.error(`Não foi possível sincronizar. ${motivo}. Tentar novamente?`, {
          action: { label: "Tentar novamente", onClick: () => void gerarPdf() },
        });
        return;
      }
      setPendingThisVisit(false);
    }
    // Fotos ainda apenas locais não existem no servidor e sumiriam do relatório.
    if (!opts?.ignorarFotosPendentes) {
      const { getQueuedPhotoCountForVisita } = await import("@/lib/consultorOffline/photoQueue");
      const pendentes = await getQueuedPhotoCountForVisita(visita.id);
      if (pendentes > 0) { setFotosPendentesAviso(pendentes); return; }
    }

    setGerandoPdf(true);
    const t = toast.loading("Gerando PDF...");
    try {
      // Salva últimas edições antes
      const saveRes = await offlineUpdate({
        visitaId: visita.id,
        table: "visitas_tecnicas",
        rowId: visita.id,
        patch: {
          observacoes_gerais: obsGerais, conclusao,
          objetivo_visita: objetivo || null,
          resumo_executivo: resumo || null,
          indicadores_gerais: indicadores || null,
          indicadores_tabela: indicadoresTabela as any,
          area_total_alqueires: parseAlqueires(areaAlqueires),
        } as any,
      });
      if (!saveRes.ok) throw new Error("Não foi possível confirmar as últimas edições antes do PDF");

      const autoInd = computeIndicadoresAuto(pastos, parseAlqueires(areaAlqueires));
      const tabelaFinal: IndicadorRow[] = INDICADOR_LABELS.map(({ key, label }) => ({
        key, label,
        value: (indicadoresTabela[key] ?? "").trim() || autoInd[key],
      }));

      // Refetch fresh fotos direct from Supabase — local state may still carry
      // queued: URLs from photos that just synced.
      const topicosForPdf = await Promise.all(topicos.map(async t => {
        const { data: fresh } = await withConsultorTimeout<any>((supabase as any).from("visita_topico_fotos")
          .select("*").eq("visita_topico_id", t.id).order("ordem"), "busca de fotos dos tópicos");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return { id: t.id, titulo: t.titulo, texto: t.texto, ordem: t.ordem, zona: (t as any).zona, fotos };
      }));

      const pastosForPdf = await Promise.all(pastos.map(async p => {
        const { data: fresh } = await withConsultorTimeout<any>(supabase.from("visita_fotos")
          .select("*").eq("visita_pasto_id", p.id).order("ordem"), "busca de fotos dos pastos");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return {
          id: p.id, letra: p.letra, num_pasto: p.num_pasto, qtd_animais: p.qtd_animais,
          tipo_produto: p.tipo_produto, percentual_pv: p.percentual_pv,
          consumo_kg_dia: p.consumo_kg_dia, observacao: p.observacao,
          categoria: p.categoria,
          peso_medio_kg: p.peso_medio_kg,
          consumo_esperado_kg: p.consumo_esperado_kg,
          consumo_real_kg: p.consumo_real_kg,
          area_alqueires: (p as any).area_alqueires ?? null,
          scores: {
            fezes: averageOf(p.samples.fezes),
            corporal: averageOf(p.samples.corporal),
            bebedouro: averageOf(p.samples.bebedouro),
          },
          samples: {
            fezes: p.samples.fezes.map((s: any) => s.nota).filter((n: any) => Number.isFinite(n)),
            corporal: p.samples.corporal.map((s: any) => s.nota).filter((n: any) => Number.isFinite(n)),
            bebedouro: p.samples.bebedouro.map((s: any) => s.nota).filter((n: any) => Number.isFinite(n)),
          },
          fotos,
        };
      }));

      const numeroMap = computeRotinaPhotoNumbering(
        (topicosForPdf as any[]).map(t => ({ id: t.id, ordem: t.ordem, zona: t.zona, fotos: t.fotos })),
        (pastosForPdf as any[]).map(p => ({ id: p.id, fotos: p.fotos })),
      );

      const cab = cabecalhoEfetivo();
      const { blob, fileName } = await generateVisitaPdf({
        visitaId: visita.id,
        fazenda: {
          nome_fazenda: cab.fazenda_nome,
          proprietario: cab.proprietario || null,
          responsavel: cab.responsavel || null,
          municipio: fazenda.municipio,
          uf: fazenda.uf,
          localizacao: cab.localizacao || null,
        },
        consultor: { nome: cab.consultor_nome },
        hora_inicio: visita.hora_inicio,
        hora_fim: visita.hora_fim || new Date().toISOString(),
        observacoes_gerais: obsGerais,
        conclusao,
        objetivo_visita: objetivo,
        resumo_executivo: resumo,
        indicadores_gerais: indicadores,
        indicadores_tabela: tabelaFinal,
        nota_area: resolveAreaTotal(pastos, parseAlqueires(areaAlqueires)).nota,
        topicos: topicosForPdf,
        assinantes: (await fetchAssinantes(visita.id)).map(a => ({ nome: a.nome, cargo_funcao: a.cargo_funcao })),
        logoOverride: {
          esquerdaPath: (consultor as any)?.logo_esquerda_url || null,
          direitaPath: (consultor as any)?.logo_direita_url || null,
        },
        pastos: pastosForPdf,
        numeroMap,
        sampleChartTypes: {
          fezes: sampleChartFezes,
          corporal: sampleChartCorporal,
          bebedouro: sampleChartBebedouro,
        },
      });


      const pdfUrl = await withConsultorTimeout(
        uploadVisitaPdf(blob, fileName, visita.consultor_id, visita.id),
        "upload do PDF",
      );
      const { error } = await withConsultorTimeout(supabase.from("visitas_tecnicas").update({
        pdf_url: pdfUrl,
        status: "finalizada",
        hora_fim: visita.hora_fim || new Date().toISOString(),
      }).eq("id", visita.id), "finalização da visita");
      if (error) throw error;

      toast.dismiss(t);
      toast.success("PDF gerado e visita finalizada!");
      setVisita(v => v ? { ...v, pdf_url: pdfUrl, status: "finalizada" } : v);
      setPdfVisualizar({ url: pdfUrl, nome: fazenda.nome_fazenda || "visita" });
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + getErrorMessage(err));
    } finally { setGerandoPdf(false); }
  }

  async function compartilhar() {
    if (!visita?.pdf_url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Visita – ${fazenda?.nome_fazenda || ""}`,
          text: "Relatório de visita técnica Consubov",
          url: visita.pdf_url,
        });
      } else {
        await navigator.clipboard.writeText(visita.pdf_url);
        toast.success("Link copiado!");
      }
    } catch { /* user cancelou */ }
  }

  function cabecalhoOriginais(): Record<CabecalhoKey, string> {
    return {
      fazenda_nome: fazenda?.nome_fazenda || "",
      localizacao: [fazenda?.municipio, fazenda?.uf].filter(Boolean).join("/"),
      proprietario: fazenda?.proprietario || "",
      responsavel: (fazenda as any)?.responsavel || "",
      consultor_nome: consultor?.nome || "",
    };
  }

  function cabecalhoEfetivo(): Record<CabecalhoKey, string> {
    const orig = cabecalhoOriginais();
    const out = { ...orig };
    (Object.keys(orig) as CabecalhoKey[]).forEach(k => {
      const ov = (overrides[k] || "").trim();
      if (ov) out[k] = ov;
    });
    return out;
  }

  async function salvarOverride(key: CabecalhoKey, raw: string) {
    const valor = raw.trim();
    const original = cabecalhoOriginais()[key];
    // Só grava override quando o valor for realmente diferente do original.
    const final = !valor || valor === original.trim() ? null : valor;
    setOverrides(prev => ({ ...prev, [key]: final || "" }));
    const column = `${key}_override` as const;
    setVisita(prev => prev ? { ...prev, [column]: final } as Visita : prev);
    await autosaveVisita({ [column]: final } as any);
  }


  if (tipoLoaded === "confinamento") return <ConfinamentoRevisaoView visitaId={visitaId!} />;
  if (loading || !tipoLoaded) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!visita) return <div className="text-center py-12">Visita não encontrada</div>;

  const readOnly = false;

  return (
    <div className="space-y-4 pb-32" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Cabeçalho estilo relatório */}
      <div
        className="rounded-lg p-4 text-white"
        style={{ background: "#14432B", fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg" style={{ background: "#C9A84C", color: "#14432B" }}>C</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Revisão · Rotina</div>
          </div>
        </div>
        <div className="text-lg font-extrabold leading-tight">{cabecalhoEfetivo().fazenda_nome || "—"}</div>
        <div className="text-xs opacity-80 mt-0.5">
          {[cabecalhoEfetivo().proprietario, cabecalhoEfetivo().localizacao].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div>
            <div className="opacity-60">Consultor</div>
            <div className="font-semibold">{cabecalhoEfetivo().consultor_nome || "—"}</div>
          </div>
          <div>
            <div className="opacity-60">Início</div>
            <div className="font-semibold">{format(new Date(visita.hora_inicio), "dd/MM HH:mm", { locale: ptBR })}</div>
          </div>
        </div>
      </div>

      {/* Dados do cabeçalho do relatório — editáveis nesta tela */}
      <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>
          Dados do cabeçalho do relatório
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CABECALHO_FIELDS.map(({ key, label }) => (
            <FieldInline
              key={key}
              label={label}
              value={cabecalhoEfetivo()[key]}
              onSave={v => void salvarOverride(key, v)}
              disabled={readOnly}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Alterações valem apenas para este relatório — os cadastros de fazenda e consultor não são modificados.
        </p>
      </div>

      {/* Blocos de pasto */}
      <div className="space-y-3">
        {pastos.map(p => (
          <div key={p.id} className="rounded-lg border bg-card" style={{ borderColor: "#E7E3D6" }}>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: "#E7E3D6" }}>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-lg"
                style={{ background: "#14432B", color: "#C9A84C", fontFamily: "'Manrope', sans-serif" }}
              >
                {p.letra}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <FieldInline
                  label="Nº Pasto"
                  value={p.num_pasto || ""}
                  onSave={v => { updatePasto(p.id, { num_pasto: v || null }); autosavePasto(p.id, { num_pasto: v || null }); }}
                  disabled={readOnly}
                />
                <FieldInline
                  label="Animais"
                  value={p.qtd_animais?.toString() || ""}
                  type="number"
                  onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { qtd_animais: n }); autosavePasto(p.id, { qtd_animais: n }); }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>Produto</div>
                  <Select
                    value={p.tipo_produto || ""}
                    onValueChange={v => { updatePasto(p.id, { tipo_produto: v }); autosavePasto(p.id, { tipo_produto: v }); }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {PRODUTOS.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <FieldInline
                  label="% PV"
                  value={p.percentual_pv || ""}
                  onSave={v => { updatePasto(p.id, { percentual_pv: v || null }); autosavePasto(p.id, { percentual_pv: v || null }); }}
                  disabled={readOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInline
                  label="Consumo Esperado (kg/dia)"
                  type="number"
                  value={p.consumo_esperado_kg?.toString() || ""}
                  onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { consumo_esperado_kg: n }); autosavePasto(p.id, { consumo_esperado_kg: n }); }}
                  disabled={readOnly}
                />
                <FieldInline
                  label="Consumo Real (kg/dia)"
                  type="number"
                  value={(p.consumo_real_kg ?? p.consumo_kg_dia)?.toString() || ""}
                  onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { consumo_real_kg: n, consumo_kg_dia: n }); autosavePasto(p.id, { consumo_real_kg: n, consumo_kg_dia: n }); }}
                  disabled={readOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInline
                  label="Área do pasto (alqueires)"
                  type="number"
                  value={p.area_alqueires?.toString() || ""}
                  onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { area_alqueires: n }); autosavePasto(p.id, { area_alqueires: n }); }}
                  disabled={readOnly}
                />
              </div>

              {/* Resumo calculado (read-only) */}
              {(() => {
                const real = p.consumo_real_kg ?? p.consumo_kg_dia ?? 0;
                const esp = p.consumo_esperado_kg ?? 0;
                const pvt = (p.qtd_animais || 0) * (p.peso_medio_kg || 0);
                const ind = real > 0 && esp > 0 ? (real / esp) * 100 : 0;
                const uaHa = computeUAHaPasto(p.qtd_animais, p.peso_medio_kg, p.area_alqueires);
                return (
                  <div className={cn("rounded-md border p-2 bg-muted/40 gap-2 text-[10px] grid", uaHa != null ? "grid-cols-5" : "grid-cols-4")} style={{ borderColor: "#E7E3D6" }}>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground">PV total</div>
                      <div className="font-bold text-foreground text-xs">{pvt > 0 ? `${pvt.toLocaleString("pt-BR")} kg` : "—"}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground">Esperado</div>
                      <div className="font-bold text-foreground text-xs">{esp > 0 ? `${esp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "—"}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground">Real</div>
                      <div className="font-bold text-foreground text-xs">{real > 0 ? `${real.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "—"}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground">Índice</div>
                      <div className="font-bold text-foreground text-xs">{ind > 0 ? `${ind.toFixed(1)}%` : "—"}</div>
                    </div>
                    {uaHa != null && (
                      <div>
                        <div className="uppercase tracking-wide text-muted-foreground">UA/ha</div>
                        <div className="font-bold text-foreground text-xs">{uaHa.toFixed(2).replace(".", ",")}</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Scores — múltiplas amostras */}
              <div className="space-y-4 pt-1">
                <ScoreSamplesInput label="Fezes" samples={p.samples.fezes}
                  onAdd={n => addSample(p.id, "fezes", n)} onRemove={i => removeSample(p.id, "fezes", i)} disabled={readOnly} />
                <ScoreSamplesInput label="Escore Corporal" samples={p.samples.corporal}
                  onAdd={n => addSample(p.id, "corporal", n)} onRemove={i => removeSample(p.id, "corporal", i)} disabled={readOnly} />
                <ScoreSamplesInput label="Bebedouro" samples={p.samples.bebedouro}
                  onAdd={n => addSample(p.id, "bebedouro", n)} onRemove={i => removeSample(p.id, "bebedouro", i)} disabled={readOnly} />
              </div>

              {/* Observação */}
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>Observação</div>
                <MentionTextarea
                  fieldId={`pasto:${p.id}`}
                  label="Observação do pasto"
                  value={p.observacao || ""}
                  onChange={v => updatePasto(p.id, { observacao: v || null })}
                  onCommit={v => autosavePasto(p.id, { observacao: v || null })}
                  rows={2}
                  className="text-sm"
                  disabled={readOnly}
                />
              </div>

              {/* Fotos */}
              <PhotoManager
                pasto={p}
                readOnly={readOnly}
                numeroMap={numeroMap}
                onAdd={f => addFoto(p.id, f)}
                onDelete={f => delFoto(p.id, f)}
                onMove={(i, d) => moveFoto(p.id, i, d)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Consumo por Pasto — Real x Esperado */}
      <ConsumoPastoChart
        pontos={pastos.map(p => ({
          letra: p.letra || "?",
          nomeCompleto: p.num_pasto ? `Pasto ${p.num_pasto}` : `Pasto ${p.letra || "?"}`,
          real: Number(p.consumo_real_kg ?? p.consumo_kg_dia ?? 0),
          esperado: Number(p.consumo_esperado_kg ?? 0),
        }))}
      />

      {/* Tópicos do Relatório — Introdução, Desenvolvimento e Conclusão */}
      <VisitaTopicosSection
        visitaId={visitaId!}
        onNotifyEdit={notifyEdit}
        onChange={setTopicos}
        numeroMap={numeroMap}
      />


      {/* Tabela Indicadores Gerais da Fazenda (auto + editável) */}
      <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
          Indicadores Gerais da Fazenda
        </div>
        <div className="text-[10px]" style={{ color: "#767066" }}>
          Valores calculados automaticamente. Edite qualquer campo para sobrescrever.
        </div>
        <div className="grid grid-cols-2 gap-2 items-center">
          <div className="text-xs font-medium" style={{ color: "#1C1C1A" }}>
            Área total dos pastos avaliados (alqueires)
          </div>
          <Input
            value={areaAlqueires}
            inputMode="decimal"
            placeholder="opcional"
            onChange={e => setAreaAlqueires(e.target.value)}
            onBlur={() => {
              const n = parseAlqueires(areaAlqueires);
              void autosaveVisita({ area_total_alqueires: n } as any);
            }}
            className="h-8 text-sm"
          />
        </div>
        {(() => {
          const auto = computeIndicadoresAuto(pastos, parseAlqueires(areaAlqueires));
          return INDICADOR_LABELS.map(({ key, label }) => {
            const override = indicadoresTabela[key] ?? "";
            const placeholder = auto[key];
            // Linhas condicionais: omitidas quando não há valor calculado nem override.
            if ((key === "taxa_lotacao" || key === "taxa_lotacao_ha") && !override.trim() && placeholder === "—") return null;
            return (
              <div key={key} className="grid grid-cols-2 gap-2 items-center">
                <div className="text-xs font-medium" style={{ color: "#1C1C1A" }}>{label}</div>
                <Input
                  value={override}
                  placeholder={placeholder}
                  onChange={e => setIndicadoresTabela(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={() => autosaveVisita({ indicadores_tabela: indicadoresTabela } as any)}
                  className="h-8 text-sm"
                />
              </div>
            );
          });
        })()}
        {(() => {
          const ar = resolveAreaTotal(pastos, parseAlqueires(areaAlqueires));
          return (
            <div className="pt-1 space-y-0.5">
              {ar.nota && <p className="text-[10px]" style={{ color: "#767066" }}>{ar.nota}</p>}
              <p className="text-[10px]" style={{ color: "#767066" }}>{NOTA_UA}</p>
            </div>
          );
        })()}
      </div>

      {/* Data e horário editáveis */}
      <VisitaDateTimeEditor
        horaInicio={visita.hora_inicio}
        horaFim={visita.hora_fim}
        onChange={async (patch) => {
          setVisita(prev => prev ? { ...prev, ...patch } as Visita : prev);
          await autosaveVisita(patch as any);
        }}
      />

      {/* Tipo de gráfico dos 3 gráficos de amostras individuais (no PDF) */}
      <div className="rounded-lg border bg-card p-3 space-y-3" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>
          Gráficos de amostras individuais (no PDF)
        </div>
        {([
          { label: "Fezes", value: sampleChartFezes, set: setSampleChartFezes },
          { label: "Escore Corporal", value: sampleChartCorporal, set: setSampleChartCorporal },
          { label: "Bebedouro", value: sampleChartBebedouro, set: setSampleChartBebedouro },
        ] as { label: string; value: SCK; set: (v: SCK) => void }[]).map(row => (
          <div key={row.label}>
            <div className="text-[11px] font-semibold mb-1" style={{ color: "#14432B" }}>{row.label}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { k: "bars", label: "Colunas" },
                { k: "lines", label: "Linhas" },
                { k: "pie", label: "Pizza" },
                { k: "radar", label: "Radar" },
              ] as { k: SCK; label: string }[]).map(opt => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => row.set(opt.k)}
                  className={cn(
                    "h-9 rounded-md text-xs font-semibold border transition-colors",
                    row.value === opt.k ? "" : "bg-muted text-muted-foreground border-transparent"
                  )}
                  style={row.value === opt.k ? { background: "#14432B", color: "white", borderColor: "#14432B" } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>


      {/* Assinaturas — múltiplos consultores */}
      <AssinaturasSection
        visitaId={visitaId!}
        onNotifyEdit={notifyEdit}
        onChange={setAssinantes}
      />


      {/* Botão fixo por status — acima da nav */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-background border-t z-50">
        <div className="max-w-md mx-auto space-y-2">
          
          <div className="flex gap-2">
          {(visita.status === "rascunho") && (
            <Button
              onClick={confirmarRevisao}
              disabled={confirmando}
              className="w-full gap-2"
              style={{ background: "#1F7A4D", color: "white" }}
            >
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar Revisão
            </Button>
          )}
          {(visita.status === "revisao" || visita.status === "finalizada") && !online && (
            <Button
              onClick={async () => {
                setSalvandoOffline(true);
                try {
                  await autosaveVisita({
                    observacoes_gerais: obsGerais,
                    conclusao,
                    objetivo_visita: objetivo || null,
                    resumo_executivo: resumo || null,
                    indicadores_gerais: indicadores || null,
                    indicadores_tabela: indicadoresTabela as any,
                    area_total_alqueires: parseAlqueires(areaAlqueires),
                  } as any);
                  toast.success("Visita salva off-line. Sincronize quando tiver internet para gerar o PDF.");
                  navigate("/consultor/historico");
                } finally { setSalvandoOffline(false); }
              }}
              disabled={salvandoOffline}
              className="flex-1 gap-2"
              style={{ background: "#1F7A4D", color: "white" }}
            >
              {salvandoOffline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar off-line
            </Button>
          )}
          {(visita.status === "revisao" || visita.status === "finalizada") && online && (
            <Button
              onClick={() => void gerarPdf()}
              disabled={gerandoPdf}
              className="flex-1 gap-2"
              style={{ background: "#14432B", color: "white" }}
            >
              {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {visita.status === "finalizada" ? "Gerar Novo PDF" : "Salvar e Gerar PDF"}
            </Button>
          )}
          {visita.status === "finalizada" && visita.pdf_url && (
            <>
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => setPdfVisualizar({ url: visita.pdf_url!, nome: fazenda?.nome_fazenda || "visita" })}
              >
                <FileText className="w-4 h-4" /> Ver PDF
              </Button>
              <Button onClick={compartilhar} className="flex-1 gap-1.5" style={{ background: "#1F7A4D", color: "white" }}>
                <Share2 className="w-4 h-4" /> Enviar
              </Button>
            </>
          )}
          </div>
        </div>
      </div>
      <PdfViewerDialog
        url={pdfVisualizar?.url ?? null}
        fileName={pdfVisualizar ? `visita-${pdfVisualizar.nome}.pdf` : undefined}
        title={pdfVisualizar ? `Relatório — ${pdfVisualizar.nome}` : undefined}
        onClose={() => {
          setPdfVisualizar(null);
          if (visita?.status === "finalizada") navigate("/consultor/historico");
        }}
      />

      <AlertDialog open={fotosPendentesAviso != null} onOpenChange={(v) => { if (!v) setFotosPendentesAviso(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fotos ainda não sincronizadas</AlertDialogTitle>
            <AlertDialogDescription>
              Existem {fotosPendentesAviso} foto(s) ainda não sincronizada(s). Sincronize antes de gerar o
              relatório para garantir que todas apareçam. Se gerar mesmo assim, essas fotos ficarão de fora do PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sincronizandoFotos}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={sincronizandoFotos}
              onClick={async () => {
                setSincronizandoFotos(true);
                try {
                  const { syncNow, getQueuedPhotoCountForVisita } = await import("@/lib/consultorOffline/photoQueue");
                  await syncNow();
                  const restantes = visita ? await getQueuedPhotoCountForVisita(visita.id) : 0;
                  if (restantes > 0) {
                    setFotosPendentesAviso(restantes);
                    toast.error(`Ainda restam ${restantes} foto(s) pendente(s).`);
                  } else {
                    setFotosPendentesAviso(null);
                    toast.success("Fotos sincronizadas.");
                    void gerarPdf({ ignorarFotosPendentes: true });
                  }
                } catch (err) {
                  toast.error(`Não foi possível sincronizar. ${getErrorMessage(err)}`);
                } finally { setSincronizandoFotos(false); }
              }}
            >
              {sincronizandoFotos ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sincronizar agora"}
            </Button>
            <AlertDialogAction
              disabled={sincronizandoFotos}
              onClick={(e) => {
                e.preventDefault();
                setFotosPendentesAviso(null);
                void gerarPdf({ ignorarFotosPendentes: true });
              }}
            >
              Gerar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function FieldInline({ label, value, onSave, type, disabled }: {
  label: string; value: string; onSave: (v: string) => void; type?: string; disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>{label}</div>
      <Input
        value={v}
        type={type}
        disabled={disabled}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v); }}
        className="h-8 text-sm mt-0.5"
      />
    </div>
  );
}

function ScoreBlock({ label, value, onChange, disabled }: { label: string; value?: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: "#E7E3D6" }}>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-center" style={{ color: "#767066" }}>{label}</div>
      <div className="flex justify-center gap-0.5 mt-1">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "w-6 h-6 rounded-full text-[11px] font-bold transition-colors",
              value === n ? "" : "bg-muted text-muted-foreground",
              disabled && "opacity-60"
            )}
            style={value === n ? { background: "#C9A84C", color: "#14432B" } : {}}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function PhotoManager({ pasto, readOnly, numeroMap, onAdd, onDelete, onMove }: {
  pasto: Pasto; readOnly?: boolean; numeroMap?: Record<string, number>;
  onAdd: (f: File) => void; onDelete: (f: Foto) => void; onMove: (i: number, d: -1 | 1) => void;
}) {
  // O snapshot pode conter registros/slots sem URL. No card de revisão, eles não
  // são fotos reais e não podem criar título, espaço reservado ou quadrados.
  const fotosReais = pasto.fotos.filter(isRenderablePastoFoto).slice(0, 5);
  if (fotosReais.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
        Fotos ({fotosReais.length}/5)
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {fotosReais.map((f, i) => (
          <MentionablePhoto key={f.id} numero={numeroMap?.[f.id]}
            className="aspect-square rounded-md overflow-hidden relative border"
            style={{ borderColor: "#E7E3D6" }}
          >
            {pasto.signed[f.id]
              ? <img loading="lazy" decoding="async" src={pasto.signed[f.id]} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-3 h-3 animate-spin" /></div>}
            {numeroMap?.[f.id] != null && (
              <div className="absolute top-0.5 left-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#14432B" }}>
                {numeroMap[f.id]}
              </div>
            )}
            {String(f.url || "").startsWith("queued:") ? (
              <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 rounded bg-background/85 px-1 py-0.5 text-[8px] font-medium text-amber-600" title="Foto ainda não sincronizada">
                <CloudOff className="w-2.5 h-2.5" /> pendente
              </div>
            ) : (
              <div className="absolute bottom-0.5 left-0.5 rounded-full bg-background/85 p-0.5" title="Foto sincronizada">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              </div>
            )}

            {!readOnly && (
              <>
                <button type="button" onClick={() => onDelete(f)}
                  className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 pb-0.5">
                  <button type="button" onClick={() => onMove(pasto.fotos.indexOf(f), -1)} disabled={i === 0}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => onMove(pasto.fotos.indexOf(f), 1)} disabled={i === fotosReais.length - 1}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </MentionablePhoto>
        ))}
      </div>
    </div>
  );
}
