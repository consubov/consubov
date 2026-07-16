import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineUpdate } from "@/lib/consultorOffline/snapshotStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "visitas-consultor-fotos";
const MAX_FOTOS = 5;

export interface TopicoFoto { id: string; url: string; ordem: number; }
export interface Topico {
  id: string;
  visita_id: string;
  titulo: string;
  texto: string | null;
  ordem: number;
  fotos: TopicoFoto[];
  signed: Record<string, string>;
}

const DEFAULT_TITLES = ["Objetivo da Visita", "Resumo Executivo", "Indicadores Gerais"];

async function signPath(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}


interface Props {
  visitaId: string;
  seedFrom?: {
    objetivo?: string | null; resumo?: string | null; indicadores?: string | null;
    observacoes?: string | null; conclusao?: string | null;
  };
  onNotifyEdit?: () => void;
  onChange?: (topicos: Topico[]) => void;
  /** "rotina" (padrão) = 3 fixos + 2 encerramento. "fabrica" = apenas 1 tópico inicial editável. */
  mode?: "rotina" | "fabrica";
  /** Numeração global de fotos por visita (id -> número sequencial). */
  numeroMap?: Record<string, number>;
}

export default function VisitaTopicosSection({ visitaId, seedFrom, onNotifyEdit, onChange, mode = "rotina", numeroMap }: Props) {
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [visitaId]);
  useEffect(() => { onChange?.(topicos); /* eslint-disable-next-line */ }, [topicos]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from("visita_topicos")
      .select("*").eq("visita_id", visitaId).order("ordem");
    let rows = (data as any[]) || [];

    // Seed defaults: 3 header (1-3) + 2 footer (1001-1002). Insert only missing ordens.
    if (!seededRef.current) {
      seededRef.current = true;
      const defaults: { ordem: number; titulo: string; texto: string | null }[] =
        mode === "fabrica"
          ? [
              { ordem: 5, titulo: "Observações Gerais da Fábrica", texto: null },
            ]
          : [
              { ordem: 1, titulo: DEFAULT_TITLES[0], texto: seedFrom?.objetivo || null },
              { ordem: 2, titulo: DEFAULT_TITLES[1], texto: seedFrom?.resumo || null },
              { ordem: 3, titulo: DEFAULT_TITLES[2], texto: seedFrom?.indicadores || null },
              { ordem: 1001, titulo: "Observações Gerais", texto: seedFrom?.observacoes || null },
              { ordem: 1002, titulo: "Conclusão", texto: seedFrom?.conclusao || null },
            ];
      const existingOrdens = new Set(rows.map(r => r.ordem));
      // Fábrica: só semeia se não houver NENHUM tópico ainda. Rotina: insere apenas os fixos que faltam.
      const shouldSeed = mode === "fabrica" ? rows.length === 0 : true;
      if (shouldSeed) {
        const toInsert = defaults
          .filter(d => !existingOrdens.has(d.ordem))
          .map(d => ({ ...d, visita_id: visitaId }));
        if (toInsert.length) {
          const { data: ins } = await (supabase as any).from("visita_topicos")
            .insert(toInsert).select();
          rows = [...rows, ...((ins as any[]) || [])];
        }
      }
    }

    const ids = rows.map(r => r.id);
    const fotosByTopico: Record<string, TopicoFoto[]> = {};
    if (ids.length) {
      const { data: ft } = await (supabase as any).from("visita_topico_fotos")
        .select("*").in("visita_topico_id", ids).order("ordem");
      (ft as any[] || []).forEach(f => {
        fotosByTopico[f.visita_topico_id] = [...(fotosByTopico[f.visita_topico_id] || []), f];
      });
    }
    const built: Topico[] = await Promise.all(rows.map(async r => {
      const fotos = fotosByTopico[r.id] || [];
      const signed: Record<string, string> = {};
      await Promise.all(fotos.map(async f => { signed[f.id] = await signPath(f.url); }));
      return { ...r, fotos, signed } as Topico;
    }));
    setTopicos(built.sort((a, b) => a.ordem - b.ordem));
    setLoading(false);
  }

  function update(id: string, patch: Partial<Topico>) {
    setTopicos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  async function saveField(id: string, patch: Partial<Topico>) {
    onNotifyEdit?.();
    const dbPatch: any = {};
    if ("titulo" in patch) dbPatch.titulo = patch.titulo ?? "";
    if ("texto" in patch) dbPatch.texto = patch.texto || null;
    if (!Object.keys(dbPatch).length) return;
    const res = await offlineUpdate({
      visitaId,
      table: "visita_topicos",
      rowId: id,
      patch: dbPatch,
      applyToSnapshot: (curr, p) => {
        const topicos = (curr.topicos ?? []).map((t: any) => (t.id === id ? { ...t, ...p } : t));
        return { ...curr, topicos };
      },
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar tópico");
  }

  async function addTopico() {
    onNotifyEdit?.();
    const customs = topicos.filter(t => t.ordem >= 5 && t.ordem <= 1000);
    const nextOrdem = customs.length ? Math.max(...customs.map(t => t.ordem)) + 1 : 5;
    const { data, error } = await (supabase as any).from("visita_topicos")
      .insert({ visita_id: visitaId, titulo: "", texto: null, ordem: nextOrdem })
      .select().single();
    if (error) { toast.error("Erro ao criar tópico"); return; }
    setTopicos(prev => [...prev, { ...(data as any), fotos: [], signed: {} }].sort((a,b)=>a.ordem-b.ordem));
  }

  async function deleteTopico(t: Topico) {
    if (t.ordem <= 3 || t.ordem >= 1001) return;
    if (!confirm("Remover este tópico?")) return;
    onNotifyEdit?.();
    if (t.fotos.length) {
      await supabase.storage.from(BUCKET).remove(t.fotos.map(f => f.url));
    }
    await (supabase as any).from("visita_topicos").delete().eq("id", t.id);
    const remaining = topicos.filter(x => x.id !== t.id);
    const others = remaining.filter(x => x.ordem <= 3 || x.ordem >= 1001);
    const customs = remaining.filter(x => x.ordem >= 5 && x.ordem <= 1000).sort((a,b)=>a.ordem-b.ordem);
    const renum = customs.map((c, i) => ({ ...c, ordem: 5 + i }));
    setTopicos([...others, ...renum].sort((a,b)=>a.ordem-b.ordem));
    await Promise.all(renum.map((c, i) => {
      if (c.ordem === customs[i]?.ordem) return Promise.resolve();
      return (supabase as any).from("visita_topicos").update({ ordem: c.ordem }).eq("id", c.id);
    }));
  }

  async function move(t: Topico, dir: -1 | 1) {
    if (t.ordem < 5 || t.ordem > 1000) return;
    const customs = topicos.filter(x => x.ordem >= 5 && x.ordem <= 1000).sort((a,b)=>a.ordem-b.ordem);
    const idx = customs.findIndex(c => c.id === t.id);
    const j = idx + dir;
    if (j < 0 || j >= customs.length) return;
    onNotifyEdit?.();
    const arr = [...customs];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    const renum = arr.map((c, i) => ({ ...c, ordem: 5 + i }));
    const others = topicos.filter(x => x.ordem <= 3 || x.ordem >= 1001);
    setTopicos([...others, ...renum].sort((a,b)=>a.ordem-b.ordem));
    await Promise.all(renum.map(c =>
      (supabase as any).from("visita_topicos").update({ ordem: c.ordem }).eq("id", c.id)
    ));
  }

  async function addFoto(t: Topico, file: File) {
    if (t.fotos.length >= MAX_FOTOS) { toast.error("Máx. 5 fotos"); return; }
    onNotifyEdit?.();
    setUploading(t.id);
    try {
      const usadas = new Set(t.fotos.map(f => f.ordem));
      let ordem = 1;
      while (usadas.has(ordem) && ordem <= MAX_FOTOS) ordem++;
      // Comprimir no cliente para acelerar upload (câmera/galeria)
      const { compressImageFileToDataUrl } = await import("@/lib/imageCompression");
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDimension: 1600, quality: 0.78, maxBytes: 900_000,
      });
      let uploadBody: Blob = file;
      let ext = file.name.split(".").pop() || "jpg";
      if (dataUrl) {
        const [meta, b64] = dataUrl.split(",");
        const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        uploadBody = new Blob([arr], { type: mime });
        ext = "jpg";
      }
      const path = `topicos/${t.id}/${ordem}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, uploadBody, {
        upsert: true, contentType: uploadBody.type || "image/jpeg",
      });
      if (error) throw error;
      const { data, error: insErr } = await (supabase as any).from("visita_topico_fotos")
        .insert({ visita_topico_id: t.id, url: path, ordem }).select().single();
      if (insErr) throw insErr;
      // Preview instantâneo com o dataUrl local
      update(t.id, {
        fotos: [...t.fotos, data as TopicoFoto].sort((a,b)=>a.ordem-b.ordem),
        signed: { ...t.signed, [(data as any).id]: dataUrl || "" },
      });
      // Signed URL em background (não bloqueia UI)
      signPath((data as any).url).then(url => {
        if (url) update(t.id, { signed: { ...t.signed, [(data as any).id]: url } });
      });
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + (err?.message || ""));
    } finally { setUploading(null); }
  }

  async function delFoto(t: Topico, f: TopicoFoto) {
    onNotifyEdit?.();
    await supabase.storage.from(BUCKET).remove([f.url]);
    await (supabase as any).from("visita_topico_fotos").delete().eq("id", f.id);
    update(t.id, { fotos: t.fotos.filter(x => x.id !== f.id) });
  }

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  const fixos = topicos.filter(t => t.ordem <= 3).sort((a,b)=>a.ordem-b.ordem);
  const customs = topicos.filter(t => t.ordem >= 5 && t.ordem <= 1000).sort((a,b)=>a.ordem-b.ordem);
  const footer = topicos.filter(t => t.ordem >= 1001).sort((a,b)=>a.ordem-b.ordem);

  return (
    <div className="space-y-3">
      {fixos.map(t => <TopicoCard key={t.id} topico={t} numeroMap={numeroMap} onUpdate={update} onSave={saveField} onAddFoto={addFoto} onDelFoto={delFoto} uploading={uploading===t.id} />)}
      {mode === "rotina" && fixos.length > 0 && (
        <div className="rounded-lg border-2 border-dashed p-3 text-center text-xs text-muted-foreground" style={{ borderColor: "#C9A84C" }}>
          ⬇ Tabela "Indicadores Gerais da Fazenda" abaixo (posição 4) ⬇
        </div>
      )}
      {customs.map((t, i) => (
        <TopicoCard key={t.id} topico={t} numeroMap={numeroMap}
          onUpdate={update} onSave={saveField} onAddFoto={addFoto} onDelFoto={delFoto}
          uploading={uploading===t.id}
          onMoveUp={i > 0 ? () => move(t, -1) : undefined}
          onMoveDown={i < customs.length - 1 ? () => move(t, 1) : undefined}
          onDelete={() => deleteTopico(t)}
        />
      ))}
      <Button type="button" onClick={addTopico} variant="outline" className="w-full gap-1.5">
        <Plus className="w-4 h-4" /> Mais
      </Button>
      {footer.length > 0 && (
        <div className="pt-3 space-y-3 border-t" style={{ borderColor: "#E7E3D6" }}>
          <div className="text-[11px] uppercase tracking-wide font-bold px-1" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
            Encerramento do Relatório
          </div>
          {footer.map(t => (
            <TopicoCard key={t.id} topico={t} numeroMap={numeroMap}
              onUpdate={update} onSave={saveField} onAddFoto={addFoto} onDelFoto={delFoto}
              uploading={uploading===t.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicoCard({
  topico, uploading, numeroMap,
  onUpdate, onSave, onAddFoto, onDelFoto,
  onMoveUp, onMoveDown, onDelete,
}: {
  topico: Topico; uploading: boolean;
  numeroMap?: Record<string, number>;
  onUpdate: (id: string, patch: Partial<Topico>) => void;
  onSave: (id: string, patch: Partial<Topico>) => void;
  onAddFoto: (t: Topico, f: File) => void;
  onDelFoto: (t: Topico, f: TopicoFoto) => void;
  onMoveUp?: () => void; onMoveDown?: () => void; onDelete?: () => void;
}) {
  const inputId = `topico-foto-${topico.id}`;
  return (
    <div className="rounded-lg border bg-card" style={{ borderColor: "#E7E3D6" }}>
      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: "#E7E3D6" }}>
        <Input
          value={topico.titulo}
          placeholder="Título do tópico"
          onChange={e => onUpdate(topico.id, { titulo: e.target.value })}
          onBlur={() => onSave(topico.id, { titulo: topico.titulo })}
          className="h-9 text-sm font-semibold flex-1"
        />
        {onMoveUp !== undefined && (
          <button type="button" onClick={onMoveUp} disabled={!onMoveUp}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        {onMoveDown !== undefined && (
          <button type="button" onClick={onMoveDown} disabled={!onMoveDown}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-3 space-y-3">
        <Textarea
          value={topico.texto || ""}
          onChange={e => onUpdate(topico.id, { texto: e.target.value })}
          onBlur={() => onSave(topico.id, { texto: topico.texto })}
          rows={3}
          className="text-sm"
          placeholder="Texto do tópico (opcional)"
        />
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
            Fotos ({topico.fotos.length}/{MAX_FOTOS})
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {topico.fotos.map(f => (
              <div key={f.id} className="aspect-square rounded-md overflow-hidden relative border" style={{ borderColor: "#E7E3D6" }}>
                {topico.signed[f.id]
                  ? <img src={topico.signed[f.id]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-3 h-3 animate-spin" /></div>}
                {numeroMap?.[f.id] != null && (
                  <div className="absolute top-0.5 left-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow"
                    style={{ background: "#14432B", color: "#C9A84C" }}>
                    {numeroMap[f.id]}
                  </div>
                )}
                <button type="button" onClick={() => onDelFoto(topico, f)}
                  className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ))}
            {topico.fotos.length < MAX_FOTOS && (
              <label htmlFor={inputId} className="aspect-square rounded-md border border-dashed flex items-center justify-center cursor-pointer bg-muted/40"
                style={{ borderColor: "#E7E3D6" }}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
                <input id={inputId} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onAddFoto(topico, f); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
