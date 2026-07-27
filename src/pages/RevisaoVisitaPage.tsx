import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Camera, X, ChevronUp, ChevronDown, Check, FileText, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateVisitaPdf, uploadVisitaPdf } from "@/lib/visitaPdf";
import ConfinamentoRevisaoView from "@/components/consultor/ConfinamentoRevisaoView";
import ScoreSamplesInput, { ScoreSample, averageOf } from "@/components/consultor/ScoreSamplesInput";
import VisitaTopicosSection, { Topico } from "@/components/consultor/VisitaTopicosSection";
import AssinaturasSection, { fetchAssinantes, type Assinante } from "@/components/consultor/AssinaturasSection";
import VisitaDateTimeEditor from "@/components/consultor/VisitaDateTimeEditor";

import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { hasPendingLocalChanges, offlineUpdate, offlineUpsert, offlineDelete, saveSnapshot, loadSnapshot, patchSnapshot } from "@/lib/consultorOffline/snapshotStore";
import { compressImageFileToDataUrl } from "@/lib/imageCompression";
import { enqueuePhoto } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto, updateFotoOrdem } from "@/lib/consultorOffline/db";

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
  | "condicao_bebedouros" | "qualidade_pastagens";

export interface IndicadorRow { key: IndicadorKey; label: string; value: string; }

export function computeIndicadoresAuto(pastos: {
  qtd_animais: number | null;
  peso_medio_kg: number | null;
  tipo_produto: string | null;
  samples: { fezes: { nota: number }[]; corporal: { nota: number }[]; bebedouro: { nota: number }[] };
}[]): Record<IndicadorKey, string> {
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
  return {
    lotes_avaliados: lotes ? String(lotes) : "—",
    animais_avaliados: animais ? animais.toLocaleString("pt-BR") : "—",
    peso_medio_rebanho: pesoMedio ? `${pesoMedio} kg` : "—",
    estrategias_nutricionais: estrategias || "—",
    score_corporal: fmtScore(corp),
    score_fezes: fmtScore(fezes),
    condicao_bebedouros: fmtScore(beb),
    qualidade_pastagens: "—",
  };
}

export const INDICADOR_LABELS: { key: IndicadorKey; label: string }[] = [
  { key: "lotes_avaliados", label: "Lotes avaliados" },
  { key: "animais_avaliados", label: "Animais avaliados" },
  { key: "peso_medio_rebanho", label: "Peso médio do rebanho avaliado" },
  { key: "estrategias_nutricionais", label: "Estratégias nutricionais" },
  { key: "score_corporal", label: "Score corporal médio" },
  { key: "score_fezes", label: "Score de fezes" },
  { key: "condicao_bebedouros", label: "Condição média dos bebedouros" },
  { key: "qualidade_pastagens", label: "Qualidade das pastagens" },
];


interface Foto { id: string; url: string; ordem: number; }
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
}

async function signPath(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
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
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const { pending: pendingUploads } = useSyncStatus();
  const [hadPendingUploads, setHadPendingUploads] = useState(false);
  const [pendingThisVisit, setPendingThisVisit] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [salvandoOffline, setSalvandoOffline] = useState(false);

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
      const { data } = await supabase.from("visitas_tecnicas").select("tipo").eq("id", visitaId).maybeSingle();
      if (data?.tipo) {
        setTipoLoaded(data.tipo as string);
      } else {
        const snap = await loadSnapshot(visitaId);
        setTipoLoaded((snap?.visita?.tipo as string) || "rotina");
      }
    })();
  }, [visitaId]);

  useEffect(() => { if (visitaId && tipoLoaded && tipoLoaded !== "confinamento") load(); }, [visitaId, tipoLoaded]);
  useEffect(() => {
    if (pendingUploads > 0) setHadPendingUploads(true);
    if (pendingUploads === 0 && hadPendingUploads && visitaId && tipoLoaded && tipoLoaded !== "confinamento") {
      setHadPendingUploads(false);
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUploads, hadPendingUploads, visitaId, tipoLoaded]);

  async function load() {
    setLoading(true);
    const snap = visitaId ? await loadSnapshot(visitaId) : null;
    const online = typeof navigator === "undefined" || navigator.onLine;
    const preferLocal = !!snap?.visita && visitaId ? await hasPendingLocalChanges(visitaId) : false;
    const { data: v } = online && !preferLocal
      ? await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId!).maybeSingle()
      : { data: null };
    const visitaRow = preferLocal ? snap?.visita : (v as any) || snap?.visita;
    if (!visitaRow) { setLoading(false); return; }
    setVisita(visitaRow as any);
    setObsGerais(visitaRow.observacoes_gerais || "");
    setConclusao(visitaRow.conclusao || "");
    setObjetivo((visitaRow as any).objetivo_visita || "");
    setResumo((visitaRow as any).resumo_executivo || "");
    setIndicadores((visitaRow as any).indicadores_gerais || "");
    setIndicadoresTabela(((visitaRow as any).indicadores_tabela as Record<string,string>) || {});

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
    ["letra","num_pasto","qtd_animais","tipo_produto","percentual_pv","consumo_kg_dia","consumo_real_kg","consumo_esperado_kg","peso_medio_kg","categoria","observacao"].forEach(k => {
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
      const dataUrl = await compressImageFileToDataUrl(file, { maxDimension: 1600, quality: 0.78, maxBytes: 900_000 });
      if (!dataUrl) throw new Error("Falha ao processar imagem");
      const [meta, b64] = dataUrl.split(",");
      const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const queued = await enqueuePhoto({ visitaId: visitaId!, parentKind: "pasto", parentId: pastoId, ordem, blob });
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
      await load();
    } finally { setConfirmando(false); }
  }

  async function gerarPdf() {
    if (!visita || !fazenda || !consultor) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Conecte à internet e sincronize antes de gerar o PDF.");
      return;
    }
    // Se houver pendências desta visita, sincroniza primeiro e aguarda concluir.
    if (await hasPendingLocalChanges(visita.id)) {
      const tSync = toast.loading("Sincronizando dados desta visita…");
      const { syncVisitaAndWait } = await import("@/lib/consultorOffline/snapshotStore");
      const ok = await syncVisitaAndWait(visita.id, 90000);
      toast.dismiss(tSync);
      if (!ok) {
        setPendingThisVisit(true);
        toast.error("Ainda há itens pendentes. Toque em Sincronizar e tente novamente.");
        return;
      }
      setPendingThisVisit(false);
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
        } as any,
      });
      if (!saveRes.ok) throw new Error("Não foi possível confirmar as últimas edições antes do PDF");

      const autoInd = computeIndicadoresAuto(pastos);
      const tabelaFinal: IndicadorRow[] = INDICADOR_LABELS.map(({ key, label }) => ({
        key, label,
        value: (indicadoresTabela[key] ?? "").trim() || autoInd[key],
      }));

      // Refetch fresh fotos direct from Supabase — local state may still carry
      // queued: URLs from photos that just synced.
      const topicosForPdf = await Promise.all(topicos.map(async t => {
        const { data: fresh } = await (supabase as any).from("visita_topico_fotos")
          .select("*").eq("visita_topico_id", t.id).order("ordem");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return { id: t.id, titulo: t.titulo, texto: t.texto, ordem: t.ordem, zona: (t as any).zona, fotos };
      }));

      const pastosForPdf = await Promise.all(pastos.map(async p => {
        const { data: fresh } = await supabase.from("visita_fotos")
          .select("*").eq("visita_pasto_id", p.id).order("ordem");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return {
          id: p.id, letra: p.letra, num_pasto: p.num_pasto, qtd_animais: p.qtd_animais,
          tipo_produto: p.tipo_produto, percentual_pv: p.percentual_pv,
          consumo_kg_dia: p.consumo_kg_dia, observacao: p.observacao,
          categoria: p.categoria,
          peso_medio_kg: p.peso_medio_kg,
          consumo_esperado_kg: p.consumo_esperado_kg,
          consumo_real_kg: p.consumo_real_kg,
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

      const { blob, fileName } = await generateVisitaPdf({
        visitaId: visita.id,
        fazenda: {
          nome_fazenda: fazenda.nome_fazenda,
          proprietario: fazenda.proprietario,
          responsavel: (fazenda as any).responsavel ?? null,
          municipio: fazenda.municipio,
          uf: fazenda.uf,
        },
        consultor: { nome: consultor.nome },
        hora_inicio: visita.hora_inicio,
        hora_fim: visita.hora_fim || new Date().toISOString(),
        observacoes_gerais: obsGerais,
        conclusao,
        objetivo_visita: objetivo,
        resumo_executivo: resumo,
        indicadores_gerais: indicadores,
        indicadores_tabela: tabelaFinal,
        topicos: topicosForPdf,
        assinantes: (await fetchAssinantes(visita.id)).map(a => ({ nome: a.nome, cargo_funcao: a.cargo_funcao })),
        logoOverride: {
          esquerdaPath: (consultor as any)?.logo_esquerda_url || null,
          direitaPath: (consultor as any)?.logo_direita_url || null,
        },
        pastos: pastosForPdf,
      });


      const pdfUrl = await uploadVisitaPdf(blob, fileName, visita.consultor_id, visita.id);
      const { error } = await supabase.from("visitas_tecnicas").update({
        pdf_url: pdfUrl,
        status: "finalizada",
        hora_fim: visita.hora_fim || new Date().toISOString(),
      }).eq("id", visita.id);
      if (error) throw error;

      toast.dismiss(t);
      toast.success("PDF gerado e visita finalizada!");
      navigate("/consultor/historico");
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + (err?.message || "desconhecido"));
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
        <div className="text-lg font-extrabold leading-tight">{fazenda?.nome_fazenda || "—"}</div>
        <div className="text-xs opacity-80 mt-0.5">
          {[fazenda?.proprietario, fazenda?.municipio, fazenda?.uf].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div>
            <div className="opacity-60">Consultor</div>
            <div className="font-semibold">{consultor?.nome || "—"}</div>
          </div>
          <div>
            <div className="opacity-60">Início</div>
            <div className="font-semibold">{format(new Date(visita.hora_inicio), "dd/MM HH:mm", { locale: ptBR })}</div>
          </div>
        </div>
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

              {/* Resumo calculado (read-only) */}
              {(() => {
                const real = p.consumo_real_kg ?? p.consumo_kg_dia ?? 0;
                const esp = p.consumo_esperado_kg ?? 0;
                const pvt = (p.qtd_animais || 0) * (p.peso_medio_kg || 0);
                const ind = real > 0 && esp > 0 ? (real / esp) * 100 : 0;
                return (
                  <div className="rounded-md border p-2 bg-muted/40 grid grid-cols-4 gap-2 text-[10px]" style={{ borderColor: "#E7E3D6" }}>
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
                <Textarea
                  defaultValue={p.observacao || ""}
                  onBlur={e => { const v = e.target.value; updatePasto(p.id, { observacao: v || null }); autosavePasto(p.id, { observacao: v || null }); }}
                  rows={2}
                  className="text-sm"
                  disabled={readOnly}
                />
              </div>

              {/* Fotos */}
              <PhotoManager
                pasto={p}
                readOnly={readOnly}
                onAdd={f => addFoto(p.id, f)}
                onDelete={f => delFoto(p.id, f)}
                onMove={(i, d) => moveFoto(p.id, i, d)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tópicos do Relatório — Introdução, Desenvolvimento e Conclusão */}
      <VisitaTopicosSection
        visitaId={visitaId!}
        onNotifyEdit={notifyEdit}
        onChange={setTopicos}
      />


      {/* Tabela Indicadores Gerais da Fazenda (auto + editável) */}
      <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
          Indicadores Gerais da Fazenda
        </div>
        <div className="text-[10px]" style={{ color: "#767066" }}>
          Valores calculados automaticamente. Edite qualquer campo para sobrescrever.
        </div>
        {(() => {
          const auto = computeIndicadoresAuto(pastos);
          return INDICADOR_LABELS.map(({ key, label }) => {
            const override = indicadoresTabela[key] ?? "";
            const placeholder = auto[key];
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
              onClick={gerarPdf}
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
              <Button asChild variant="outline" className="flex-1 gap-1.5">
                <a href={visita.pdf_url} download>
                  <Download className="w-4 h-4" /> Baixar
                </a>
              </Button>
              <Button onClick={compartilhar} className="flex-1 gap-1.5" style={{ background: "#1F7A4D", color: "white" }}>
                <Share2 className="w-4 h-4" /> Enviar
              </Button>
            </>
          )}
          </div>
        </div>
      </div>
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

function PhotoManager({ pasto, readOnly, onAdd, onDelete, onMove }: {
  pasto: Pasto; readOnly?: boolean;
  onAdd: (f: File) => void; onDelete: (f: Foto) => void; onMove: (i: number, d: -1 | 1) => void;
}) {
  const inputId = `photo-${pasto.id}`;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
        Fotos ({pasto.fotos.length}/5)
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {pasto.fotos.map((f, i) => (
          <div key={f.id} className="aspect-square rounded-md overflow-hidden relative border" style={{ borderColor: "#E7E3D6" }}>
            {pasto.signed[f.id]
              ? <img src={pasto.signed[f.id]} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-3 h-3 animate-spin" /></div>}
            {!readOnly && (
              <>
                <button type="button" onClick={() => onDelete(f)}
                  className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 pb-0.5">
                  <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === pasto.fotos.length - 1}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!readOnly && pasto.fotos.length < 5 && (
          <label htmlFor={inputId} className="aspect-square rounded-md border border-dashed flex items-center justify-center cursor-pointer bg-muted/40"
            style={{ borderColor: "#E7E3D6" }}>
            <Camera className="w-4 h-4 text-muted-foreground" />
            <input id={inputId} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </div>
  );
}
