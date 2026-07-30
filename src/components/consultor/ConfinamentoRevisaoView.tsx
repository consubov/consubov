import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MentionablePhoto from "@/components/consultor/MentionablePhoto";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Camera, X, ChevronUp, ChevronDown, Check, FileText, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateConfinamentoPdf, uploadConfinamentoPdf } from "@/lib/confinamentoPdf";
import { computeConfinamentoPhotoNumbering } from "@/lib/photoNumbering";
import ScoreSamplesInput, { ScoreSample, averageOf, formatAvg } from "./ScoreSamplesInput";
import VisitaTopicosSection, { type Topico } from "./VisitaTopicosSection";
import AssinaturasSection, { fetchAssinantes, type Assinante } from "./AssinaturasSection";
import VisitaDateTimeEditor from "./VisitaDateTimeEditor";
import IndicadoresZootecnicosSection, { fetchIndicadoresParaPdf } from "./IndicadoresZootecnicosSection";

import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { hasPendingLocalChanges, isVisitaDeleted, offlineUpdate, offlineUpsert, offlineDelete, saveSnapshot, loadSnapshot, patchSnapshot } from "@/lib/consultorOffline/snapshotStore";
import { getErrorMessage, withConsultorTimeout } from "@/lib/consultorOffline/network";
import { enqueuePhoto } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto, updateFotoOrdem } from "@/lib/consultorOffline/db";
import { prepareConsultorPhotoFile } from "@/lib/consultorOffline/photoBlob";

const BUCKET = "visitas-consultor-fotos";
const MAX_FOTOS = 10;
type ScoreKey = "fezes" | "corporal" | "bebedouro";

interface Foto { id: string; url: string; ordem: number; }
interface Curral {
  id: string;
  num_curral: string;
  ordem: number;
  dieta_categoria?: string | null;
  samples: Record<ScoreKey, ScoreSample[]>;
  fotos: Foto[];
  signed: Record<string, string>;
}
interface Visita {
  id: string; status: string; hora_inicio: string; hora_fim: string | null;
  observacoes_gerais: string | null; conclusao: string | null;
  fazenda_consultor_id: string; consultor_id: string;
  pdf_url: string | null;
  objetivo_visita: string | null;
  resumo_executivo: string | null;
  indicadores_gerais: string | null;
  deleted_at?: string | null;
}

async function signPath(path: string): Promise<string> {
  return (await import("@/lib/consultorOffline/signedUrlCache")).getCachedSignedUrl(path);
}

export default function ConfinamentoRevisaoView({ visitaId }: { visitaId: string }) {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [consultor, setConsultor] = useState<any>(null);
  const [currais, setCurrais] = useState<Curral[]>([]);
  const [obsGerais, setObsGerais] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [tituloEncerramento, setTituloEncerramento] = useState("Observações e Recomendações");
  const [fabricaNota, setFabricaNota] = useState<number | null>(null);
  const [insumosNota, setInsumosNota] = useState<number | null>(null);
  const [fabricaAvaliacaoId, setFabricaAvaliacaoId] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [resumo, setResumo] = useState("");
  const [indicadores, setIndicadores] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const numeroMap = useMemo(
    () => computeConfinamentoPhotoNumbering(
      currais.map(c => ({ id: c.id, fotos: c.fotos })),
      topicos.map(t => ({ id: t.id, ordem: t.ordem, zona: t.zona, fotos: t.fotos })),
    ),
    [currais, topicos],
  );
  const [chartType, setChartType] = useState<"bars" | "lines" | "pie" | "radar">("bars");
  type SCK = "bars" | "lines" | "pie" | "radar";
  const [sampleChartFezes, setSampleChartFezes] = useState<SCK>("lines");
  const [sampleChartCorporal, setSampleChartCorporal] = useState<SCK>("lines");
  const [sampleChartBebedouro, setSampleChartBebedouro] = useState<SCK>("lines");
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


  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const snap = await loadSnapshot(visitaId);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const preferLocal = !!snap?.visita && await hasPendingLocalChanges(visitaId);
    const { data: v } = online && !preferLocal
      ? await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId).is("deleted_at", null).maybeSingle()
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

    const [{ data: fz }, { data: cs }, { data: cr }, { data: af }] = online && !preferLocal
      ? await Promise.all([
          supabase.from("fazendas_consultor").select("*").eq("id", visitaRow.fazenda_consultor_id).maybeSingle(),
          supabase.from("consultores").select("*").eq("id", visitaRow.consultor_id).maybeSingle(),
          supabase.from("visita_currais").select("*").eq("visita_id", visitaId).order("ordem"),
          (supabase as any).from("avaliacao_fabrica_visita")
            .select("id, organizacao_fabrica_nota, organizacao_insumos_nota")
            .eq("visita_id", visitaId).maybeSingle(),
        ])
      : [{ data: null }, { data: null }, { data: null }, { data: null }];
    const fazendaRow = fz || snap?.fazenda;
    const consultorRow = cs || snap?.consultor;
    setFazenda(fazendaRow); setConsultor(consultorRow);
    const afRow = af || snap?.avaliacao_fabrica_visita || null;
    setFabricaAvaliacaoId(afRow?.id ?? null);
    setFabricaNota(afRow?.organizacao_fabrica_nota ?? null);
    setInsumosNota(afRow?.organizacao_insumos_nota ?? null);

    let rows = (cr as any[]) || [];
    if (rows.length === 0 && snap?.currais?.length) rows = snap.currais as any[];
    const ids = rows.map(r => r.id);
    const samplesBy: Record<string, Record<ScoreKey, ScoreSample[]>> = {};
    const fotosBy: Record<string, Foto[]> = {};
    if (ids.length && online && !preferLocal) {
      const [{ data: sc }, { data: ft }] = await Promise.all([
        supabase.from("avaliacoes_score").select("id, visita_curral_id, tipo, nota").in("visita_curral_id", ids),
        supabase.from("visita_fotos").select("*").in("visita_curral_id", ids).order("ordem"),
      ]);
      (sc || []).forEach((s: any) => {
        const bucket = samplesBy[s.visita_curral_id] ??= { fezes: [], corporal: [], bebedouro: [] };
        if (s.tipo in bucket) bucket[s.tipo as ScoreKey].push({ id: s.id, nota: s.nota });
      });
      (ft || []).forEach((f: any) => {
        fotosBy[f.visita_curral_id] = [...(fotosBy[f.visita_curral_id] || []), f];
      });
    }
    const built: Curral[] = await Promise.all(rows.map(async r => {
      const snapCurral = (snap?.currais || []).find((x: any) => x.id === r.id) as any;
      const fallbackFotos = Array.isArray((r as any).fotos) ? (r as any).fotos : (snapCurral?.fotos || []);
      const remoteFotos = fotosBy[r.id] || [];
      const queuedFotos = fallbackFotos.filter((f: any) => String(f.url || "").startsWith("queued:"));
      const fotos = remoteFotos.length ? [...remoteFotos, ...queuedFotos.filter((q: any) => !remoteFotos.some((rf: any) => rf.ordem === q.ordem))] : fallbackFotos;
      const signed: Record<string, string> = { ...(snapCurral?.signed || {}), ...((r as any).signed || {}) };
      await Promise.all(fotos
        .filter((f: any) => online && !preferLocal && !String(f.url || "").startsWith("queued:"))
        .map(async f => { signed[f.id] = await signPath(f.url); }));
      return {
        id: r.id, num_curral: r.num_curral, ordem: r.ordem,
        dieta_categoria: (r as any).dieta_categoria ?? snapCurral?.dieta_categoria ?? null,
        samples: samplesBy[r.id] || (r as any).samples || snapCurral?.samples || { fezes: [], corporal: [], bebedouro: [] },
        fotos, signed,
      };
    }));
    setCurrais(built);
    setPendingThisVisit(await hasPendingLocalChanges(visitaId));
    if (!preferLocal) {
      void saveSnapshot(visitaId, {
        ...(snap || {}),
        visita: visitaRow,
        fazenda: fazendaRow,
        consultor: consultorRow,
        currais: built,
        avaliacao_fabrica_visita: afRow,
      }).catch(() => {});
    }
    setLoading(false);
  }, [visitaId]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    if (pendingUploads > 0) setHadPendingUploads(true);
    if (pendingUploads === 0 && hadPendingUploads) {
      setHadPendingUploads(false);
      void load(true);
    }
  }, [pendingUploads, hadPendingUploads, load]);

  function updateCurral(id: string, patch: Partial<Curral>) {
    setCurrais(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  async function notifyEdit() {
    if (!visita || visita.status !== "finalizada") return;
    await offlineUpdate({ visitaId, table: "visitas_tecnicas", rowId: visita.id, patch: { pdf_url: null, status: "revisao" } });
    setVisita(prev => prev ? { ...prev, pdf_url: null, status: "revisao" } : prev);
  }

  async function autosaveCurralNum(curralId: string, num_curral: string) {
    await notifyEdit();
    const res = await offlineUpdate({
      visitaId,
      table: "visita_currais",
      rowId: curralId,
      patch: { num_curral },
      applyToSnapshot: (curr, patch) => ({
        ...curr,
        currais: (curr.currais || []).map((c: any) => c.id === curralId ? { ...c, ...patch } : c),
      }),
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar");
  }

  async function addSample(curralId: string, tipo: ScoreKey, nota: number) {
    await notifyEdit();
    const id = crypto.randomUUID();
    const res = await offlineUpsert({
      visitaId,
      table: "avaliacoes_score",
      rowId: id,
      payload: { visita_curral_id: curralId, tipo, nota },
      applyToSnapshot: (curr) => ({
        ...curr,
        currais: (curr.currais || []).map((c: any) => c.id === curralId
          ? { ...c, samples: { ...(c.samples || {}), [tipo]: [...((c.samples || {})[tipo] || []), { id, nota }] } }
          : c),
      }),
    });
    if (!res.ok && !res.queued) { toast.error("Erro ao adicionar amostra"); return; }
    setCurrais(prev => prev.map(c => c.id === curralId
      ? { ...c, samples: { ...c.samples, [tipo]: [...c.samples[tipo], { id, nota }] } }
      : c));
  }

  async function removeSample(curralId: string, tipo: ScoreKey, index: number) {
    await notifyEdit();
    const c = currais.find(x => x.id === curralId); if (!c) return;
    const s = c.samples[tipo][index]; if (!s?.id) return;
    await offlineDelete({
      visitaId,
      table: "avaliacoes_score",
      rowId: s.id,
      applyToSnapshot: (curr) => ({
        ...curr,
        currais: (curr.currais || []).map((c: any) => c.id === curralId
          ? { ...c, samples: { ...(c.samples || {}), [tipo]: ((c.samples || {})[tipo] || []).filter((x: any) => x.id !== s.id) } }
          : c),
      }),
    });
    setCurrais(prev => prev.map(x => x.id === curralId
      ? { ...x, samples: { ...x.samples, [tipo]: x.samples[tipo].filter((_, i) => i !== index) } }
      : x));
  }

  async function autosaveVisita(patch: Partial<Visita>) {
    await notifyEdit();
    const res = await offlineUpdate({
      visitaId,
      table: "visitas_tecnicas",
      rowId: visitaId,
      patch: patch as any,
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar");
  }

  async function upsertFabrica(patch: { organizacao_fabrica_nota?: number | null; organizacao_insumos_nota?: number | null }) {
    await notifyEdit();
    const next = {
      organizacao_fabrica_nota: patch.organizacao_fabrica_nota !== undefined ? patch.organizacao_fabrica_nota : fabricaNota,
      organizacao_insumos_nota: patch.organizacao_insumos_nota !== undefined ? patch.organizacao_insumos_nota : insumosNota,
    };
    if (patch.organizacao_fabrica_nota !== undefined) setFabricaNota(patch.organizacao_fabrica_nota);
    if (patch.organizacao_insumos_nota !== undefined) setInsumosNota(patch.organizacao_insumos_nota);
    const rowId = fabricaAvaliacaoId || crypto.randomUUID();
    setFabricaAvaliacaoId(rowId);
    const res = await offlineUpsert({
      visitaId,
      table: "avaliacao_fabrica_visita",
      rowId,
      payload: { visita_id: visitaId, ...next },
      onConflict: "visita_id",
      applyToSnapshot: (curr, payload) => ({ ...curr, avaliacao_fabrica_visita: { id: rowId, ...payload } }),
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar avaliação da fábrica");
  }

  async function addFoto(curralId: string, file: File) {
    await notifyEdit();
    const c = currais.find(x => x.id === curralId); if (!c) return;
    if (c.fotos.length >= MAX_FOTOS) { toast.error(`Máx. ${MAX_FOTOS} fotos`); return; }
    const usadas = new Set(c.fotos.map(f => f.ordem));
    let ordem = 1;
    while (usadas.has(ordem) && ordem <= MAX_FOTOS) ordem++;
    try {
      const { dataUrl, blob } = await prepareConsultorPhotoFile(file);
      const queued = await enqueuePhoto({ visitaId, parentKind: "curral", parentId: curralId, ordem, blob, fileName: file.name });
      const data = { id: queued.localId, url: `queued:${queued.localId}`, ordem } as Foto;
      updateCurral(curralId, {
        fotos: [...c.fotos, data].sort((a, b) => a.ordem - b.ordem),
        signed: { ...c.signed, [data.id]: dataUrl },
      });
      await patchSnapshot(visitaId, (curr) => ({
        ...curr,
        currais: (curr.currais || []).map((x: any) => x.id === curralId
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

  async function delFoto(curralId: string, f: Foto) {
    await notifyEdit();
    const c = currais.find(x => x.id === curralId); if (!c) return;
    if (String(f.url).startsWith("queued:")) {
      await deleteQueuedFoto(f.id);
    } else {
      if (typeof navigator === "undefined" || navigator.onLine) await supabase.storage.from(BUCKET).remove([f.url]);
      await offlineDelete({ visitaId, table: "visita_fotos", rowId: f.id });
    }
    updateCurral(curralId, { fotos: c.fotos.filter(x => x.id !== f.id) });
    await patchSnapshot(visitaId, (curr) => ({
      ...curr,
      currais: (curr.currais || []).map((x: any) => x.id === curralId
        ? { ...x, fotos: (x.fotos || []).filter((foto: Foto) => foto.id !== f.id) }
        : x),
    }));
  }

  async function moveFoto(curralId: string, index: number, dir: -1 | 1) {
    await notifyEdit();
    const c = currais.find(x => x.id === curralId); if (!c) return;
    const arr = [...c.fotos];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const updates = arr.map((f, i) => ({ ...f, ordem: i + 1 }));
    updateCurral(curralId, { fotos: updates });
    await patchSnapshot(visitaId, (curr) => ({
      ...curr,
      currais: (curr.currais || []).map((x: any) => x.id === curralId ? { ...x, fotos: updates } : x),
    }));
    await Promise.all(updates
      .filter(u => String(u.url).startsWith("queued:"))
      .map(u => updateFotoOrdem(u.id, u.ordem))
    );
    await Promise.all(updates
      .filter(u => !String(u.url).startsWith("queued:"))
      .map(u => offlineUpdate({ visitaId, table: "visita_fotos", rowId: u.id, patch: { ordem: u.ordem } }))
    );
  }

  async function confirmarRevisao() {
    setConfirmando(true);
    try {
      await autosaveVisita({ observacoes_gerais: obsGerais, conclusao, status: "revisao" as any });
      toast.success("Visita revisada.");
      await load(true);
    } finally { setConfirmando(false); }
  }

  async function gerarPdf() {
    if (!visita || !fazenda || !consultor) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Conecte à internet e sincronize antes de gerar o PDF.");
      return;
    }
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
    setGerandoPdf(true);
    const t = toast.loading("Gerando PDF...");
    try {
      const saveRes = await offlineUpdate({
        visitaId: visita.id,
        table: "visitas_tecnicas",
        rowId: visita.id,
        patch: {
          observacoes_gerais: obsGerais, conclusao,
          objetivo_visita: objetivo || null,
          resumo_executivo: resumo || null,
          indicadores_gerais: indicadores || null,
        } as any,
      });
      if (!saveRes.ok) throw new Error("Não foi possível confirmar as últimas edições antes do PDF");
      const curraisForPdf = await Promise.all(currais.map(async c => {
        const { data: fresh } = await withConsultorTimeout<any>(supabase.from("visita_fotos")
          .select("*").eq("visita_curral_id", c.id).order("ordem"), "busca de fotos dos currais");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return {
          id: c.id,
          num_curral: c.num_curral,
          dieta_categoria: c.dieta_categoria ?? null,
          scores: {
            fezes: averageOf(c.samples.fezes),
            corporal: averageOf(c.samples.corporal),
            bebedouro: averageOf(c.samples.bebedouro),
          },
          sampleCounts: {
            fezes: c.samples.fezes.length,
            corporal: c.samples.corporal.length,
            bebedouro: c.samples.bebedouro.length,
          },
          samples: {
            fezes: c.samples.fezes.map(s => (s as any).nota).filter((n: any) => Number.isFinite(n)),
            corporal: c.samples.corporal.map(s => (s as any).nota).filter((n: any) => Number.isFinite(n)),
            bebedouro: c.samples.bebedouro.map(s => (s as any).nota).filter((n: any) => Number.isFinite(n)),
          },
          fotos,
        };
      }));
      const topicosForPdf = await Promise.all(topicos.map(async t => {
        const { data: fresh } = await withConsultorTimeout<any>((supabase as any).from("visita_topico_fotos")
          .select("*").eq("visita_topico_id", t.id).order("ordem"), "busca de fotos dos tópicos");
        const fotos = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return { id: t.id, titulo: t.titulo, texto: t.texto, ordem: t.ordem, zona: t.zona, fotos };
      }));
      const numeroMap = computeConfinamentoPhotoNumbering(
        curraisForPdf.map(c => ({ id: c.id, fotos: c.fotos })),
        topicosForPdf.map(t => ({ id: t.id, ordem: t.ordem, zona: t.zona, fotos: t.fotos })),
      );
      const indicadoresData = await fetchIndicadoresParaPdf(visita.id);
      const { blob, fileName } = await generateConfinamentoPdf({
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
        titulo_encerramento: tituloEncerramento,
        objetivo_visita: objetivo,
        resumo_executivo: resumo,
        indicadores_gerais: indicadores,
        avaliacaoFabrica: {
          organizacao_fabrica_nota: fabricaNota,
          organizacao_insumos_nota: insumosNota,
        },
        currais: curraisForPdf,
        numeroMap,
        chartType,
        sampleChartTypes: {
          fezes: sampleChartFezes,
          corporal: sampleChartCorporal,
          bebedouro: sampleChartBebedouro,
        },
        logoOverride: {
          esquerdaPath: (consultor as any)?.logo_esquerda_url || null,
          direitaPath: (consultor as any)?.logo_direita_url || null,
        },
        assinantes: (await fetchAssinantes(visita.id)).map(a => ({ nome: a.nome, cargo_funcao: a.cargo_funcao })),
        topicos: topicosForPdf,
        indicadoresZootecnicos: indicadoresData
          ? {
              indicador: indicadoresData.indicador
                ? {
                    currais_ocupados: indicadoresData.indicador.currais_ocupados ?? null,
                    animais_ativos: indicadoresData.indicador.animais_ativos ?? null,
                  }
                : null,
              faixas: indicadoresData.faixas.map(f => ({
                faixa: f.faixa,
                ordem: f.ordem,
                quantidade_animais: f.quantidade_animais,
                consumo_medio_pv: f.consumo_medio_pv,
              })),
            }
          : null,
      });
      const pdfUrl = await withConsultorTimeout(
        uploadConfinamentoPdf(blob, fileName, visita.consultor_id, visita.id),
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
      navigate("/consultor/historico");
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
    } catch { /* cancel */ }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!visita) return <div className="text-center py-12">Visita não encontrada</div>;

  const readOnly = false;

  return (
    <div className="space-y-4 pb-32" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Header */}
      <div
        className="rounded-lg p-4 text-white"
        style={{ background: "#14432B", fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg" style={{ background: "#C9A84C", color: "#14432B" }}>C</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Revisão · Confinamento</div>
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

      {/* Avaliação da Fábrica (única por visita) */}
      <div className="rounded-lg border bg-card p-3 space-y-3" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
          Avaliação da Fábrica (única na visita)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ScoreBlock label="Org. Fábrica" value={fabricaNota ?? undefined} onChange={n => upsertFabrica({ organizacao_fabrica_nota: n })} disabled={readOnly} />
          <ScoreBlock label="Org. Insumos" value={insumosNota ?? undefined} onChange={n => upsertFabrica({ organizacao_insumos_nota: n })} disabled={readOnly} />
        </div>
      </div>

      {/* Indicadores Zootécnicos (única por visita) */}
      <IndicadoresZootecnicosSection visitaId={visita.id} readOnly={readOnly} />

      {/* Blocos de curral */}
      <div className="space-y-3">
        {currais.map(c => (
          <div key={c.id} className="rounded-lg border bg-card" style={{ borderColor: "#E7E3D6" }}>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: "#E7E3D6" }}>
              <div
                className="min-w-11 max-w-[110px] min-h-11 px-2 py-1 rounded-lg flex items-center justify-center font-extrabold text-center leading-tight break-words shrink-0"
                style={{
                  background: "#14432B",
                  color: "#C9A84C",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: (c.num_curral?.length ?? 0) > 6 ? "0.7rem" : (c.num_curral?.length ?? 0) > 3 ? "0.85rem" : "1rem",
                }}
                title={c.num_curral}
              >
                {c.num_curral}
              </div>
              <div className="flex-1">
                <FieldInline
                  label="Nº Curral"
                  value={c.num_curral}
                  onSave={v => {
                    if (!v.trim()) return;
                    updateCurral(c.id, { num_curral: v });
                    autosaveCurralNum(c.id, v);
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="p-3 space-y-4">
              <ScoreSamplesInput
                label="Fezes" samples={c.samples.fezes}
                onAdd={n => addSample(c.id, "fezes", n)}
                onRemove={i => removeSample(c.id, "fezes", i)}
                disabled={readOnly}
              />
              <ScoreSamplesInput
                label="Escore Corporal" samples={c.samples.corporal}
                onAdd={n => addSample(c.id, "corporal", n)}
                onRemove={i => removeSample(c.id, "corporal", i)}
                disabled={readOnly}
              />
              <ScoreSamplesInput
                label="Bebedouro" samples={c.samples.bebedouro}
                onAdd={n => addSample(c.id, "bebedouro", n)}
                onRemove={i => removeSample(c.id, "bebedouro", i)}
                disabled={readOnly}
              />

              <PhotoManager
                curral={c}
                readOnly={readOnly}
                numeroMap={numeroMap}
                onAdd={f => addFoto(c.id, f)}
                onDelete={f => delFoto(c.id, f)}
                onMove={(i, d) => moveFoto(c.id, i, d)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tópicos do Relatório — Introdução, Desenvolvimento e Conclusão */}
      <VisitaTopicosSection
        visitaId={visita.id}
        onChange={setTopicos}
        numeroMap={numeroMap}
      />

      {/* Título da seção final do PDF (opcional) */}
      <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>Título da seção final (no PDF)</div>
        <Input
          value={tituloEncerramento}
          onChange={e => setTituloEncerramento(e.target.value)}
          placeholder="Observações e Recomendações"
        />
      </div>

      {/* Tipo de gráfico das Médias por Classificação (no PDF) */}
      <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>
          Gráfico "Médias por Classificação" (no PDF)
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { k: "bars", label: "Colunas" },
            { k: "lines", label: "Linhas" },
            { k: "pie", label: "Pizza" },
            { k: "radar", label: "Radar" },
          ] as { k: typeof chartType; label: string }[]).map(opt => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setChartType(opt.k)}
              className={cn(
                "h-9 rounded-md text-xs font-semibold border transition-colors",
                chartType === opt.k ? "" : "bg-muted text-muted-foreground border-transparent"
              )}
              style={chartType === opt.k ? { background: "#14432B", color: "white", borderColor: "#14432B" } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
        visitaId={visita.id}
        onNotifyEdit={notifyEdit}
        onChange={setAssinantes}
      />



      {/* Botão fixo — acima da nav */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-background border-t z-50">
        <div className="max-w-md mx-auto space-y-2">
          
          <div className="flex gap-2">
          {visita.status === "rascunho" && (
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
                  await autosaveVisita({ observacoes_gerais: obsGerais, conclusao } as any);
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
        {[1, 2, 3, 4, 5].map(n => (
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

function PhotoManager({ curral, readOnly, numeroMap, onAdd, onDelete, onMove }: {
  curral: Curral; readOnly?: boolean; numeroMap?: Record<string, number>;
  onAdd: (f: File) => void; onDelete: (f: Foto) => void; onMove: (i: number, d: -1 | 1) => void;
}) {
  const inputId = `photo-curral-${curral.id}`;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
        Fotos ({curral.fotos.length}/{MAX_FOTOS})
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {curral.fotos.map((f, i) => (
          <MentionablePhoto key={f.id} numero={numeroMap?.[f.id]}
            className="aspect-square rounded-md overflow-hidden relative border"
            style={{ borderColor: "#E7E3D6" }}
          >
            {curral.signed[f.id]
              ? <img src={curral.signed[f.id]} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-3 h-3 animate-spin" /></div>}
            {numeroMap?.[f.id] != null && (
              <div className="absolute top-0.5 left-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#14432B" }}>
                {numeroMap[f.id]}
              </div>
            )}
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
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === curral.fotos.length - 1}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </MentionablePhoto>
        ))}
        {!readOnly && curral.fotos.length < MAX_FOTOS && (
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

// Suppress unused import warning
void formatAvg;
