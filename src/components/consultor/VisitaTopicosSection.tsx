import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineUpdate, offlineUpsert, offlineDelete, loadSnapshot, patchSnapshot } from "@/lib/consultorOffline/snapshotStore";
import { enqueuePhoto, subscribeSyncStatus } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto } from "@/lib/consultorOffline/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Camera, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "visitas-consultor-fotos";
const MAX_FOTOS = 5;

export type TopicoZona = "introducao" | "desenvolvimento" | "conclusao";

export interface TopicoFoto { id: string; url: string; ordem: number; }
export interface Topico {
  id: string;
  visita_id: string;
  titulo: string;
  texto: string | null;
  ordem: number;
  zona: TopicoZona;
  fotos: TopicoFoto[];
  signed: Record<string, string>;
}

const ZONA_LABELS: Record<TopicoZona, string> = {
  introducao: "Introdução",
  desenvolvimento: "Desenvolvimento",
  conclusao: "Conclusão",
};

const ZONA_HINTS: Record<TopicoZona, string> = {
  introducao: "Aparece na primeira página do PDF.",
  desenvolvimento: "Entra no meio do relatório, após os pastos/currais avaliados.",
  conclusao: "Fecha o relatório, junto com Observações e Recomendações.",
};

async function signPath(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

interface Props {
  visitaId: string;
  onNotifyEdit?: () => void;
  onChange?: (topicos: Topico[]) => void;
  /** Numeração global de fotos por visita (id -> número sequencial). */
  numeroMap?: Record<string, number>;
  /** Zonas permitidas (default: as três). */
  zonas?: TopicoZona[];
}

export default function VisitaTopicosSection({ visitaId, onNotifyEdit, onChange, numeroMap, zonas }: Props) {
  const allowedZonas: TopicoZona[] = zonas && zonas.length > 0 ? zonas : ["introducao", "desenvolvimento", "conclusao"];
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [visitaId]);
  useEffect(() => { onChange?.(topicos); /* eslint-disable-next-line */ }, [topicos]);
  useEffect(() => {
    const unsub = subscribeSyncStatus(() => {});
    return () => { unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitaId]);

  function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function load() {
    setLoading(true);
    const snap = await loadSnapshot(visitaId);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const { data } = online
      ? await (supabase as any).from("visita_topicos")
          .select("*").eq("visita_id", visitaId).order("ordem")
      : { data: null };
    let rows = (data as any[]) || [];
    if (rows.length === 0 && snap?.topicos?.length) rows = snap.topicos as any[];

    const ids = rows.map(r => r.id);
    const fotosByTopico: Record<string, TopicoFoto[]> = {};
    if (ids.length && online) {
      const { data: ft } = await (supabase as any).from("visita_topico_fotos")
        .select("*").in("visita_topico_id", ids).order("ordem");
      (ft as any[] || []).forEach(f => {
        fotosByTopico[f.visita_topico_id] = [...(fotosByTopico[f.visita_topico_id] || []), f];
      });
    }
    const built: Topico[] = await Promise.all(rows.map(async r => {
      const snapTopico = (snap?.topicos || []).find((x: any) => x.id === r.id) as any;
      const fallbackFotos = Array.isArray((r as any).fotos) ? (r as any).fotos : (snapTopico?.fotos || []);
      const remoteFotos = fotosByTopico[r.id] || [];
      const queuedFotos = fallbackFotos.filter((f: any) => String(f.url || "").startsWith("queued:"));
      const fotos = remoteFotos.length
        ? [...remoteFotos, ...queuedFotos.filter((q: any) => !remoteFotos.some((rf: any) => rf.ordem === q.ordem))]
        : fallbackFotos;
      const signed: Record<string, string> = { ...(snapTopico?.signed || {}), ...((r as any).signed || {}) };
      await Promise.all(fotos
        .filter((f: any) => online && !String(f.url || "").startsWith("queued:"))
        .map(async f => { signed[f.id] = await signPath(f.url); }));
      // Compat: registros antigos podem não ter `zona`. Heurística por ordem:
      //  ordem <= 3 => introdução; ordem >= 1001 => conclusão; senão => desenvolvimento
      let zona: TopicoZona = (r as any).zona || "introducao";
      if (!(r as any).zona) {
        if ((r as any).ordem >= 1001) zona = "conclusao";
        else if ((r as any).ordem >= 5 && (r as any).ordem <= 1000) zona = "desenvolvimento";
      }
      return { ...r, zona, fotos, signed } as Topico;
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

  async function addTopico(zona: TopicoZona) {
    setPickerOpen(false);
    onNotifyEdit?.();
    const inZone = topicos.filter(t => t.zona === zona);
    const nextOrdem = inZone.length ? Math.max(...inZone.map(t => t.ordem)) + 1 : 1;
    const id = crypto.randomUUID();
    const payload: any = { visita_id: visitaId, titulo: "", texto: null, ordem: nextOrdem, zona };
    const res = await offlineUpsert({
      visitaId,
      table: "visita_topicos",
      rowId: id,
      payload,
      applyToSnapshot: (curr, p) => ({
        ...curr,
        topicos: [...(curr.topicos || []), { id, ...p, fotos: [], signed: {} }],
      }),
    });
    if (res.queued) toast.info("Tópico salvo off-line.");
    setTopicos(prev => [...prev, { id, ...payload, fotos: [], signed: {} } as Topico]);
  }

  async function deleteTopico(t: Topico) {
    if (!confirm("Remover este tópico?")) return;
    onNotifyEdit?.();
    for (const f of t.fotos) {
      if (String(f.url).startsWith("queued:")) await deleteQueuedFoto(f.id);
      else if (typeof navigator === "undefined" || navigator.onLine) await supabase.storage.from(BUCKET).remove([f.url]);
    }
    await offlineDelete({
      visitaId,
      table: "visita_topicos",
      rowId: t.id,
      applyToSnapshot: (curr) => ({ ...curr, topicos: (curr.topicos || []).filter((x: any) => x.id !== t.id) }),
    });
    setTopicos(prev => prev.filter(x => x.id !== t.id));
  }

  async function move(t: Topico, dir: -1 | 1) {
    const inZone = topicos.filter(x => x.zona === t.zona).sort((a, b) => a.ordem - b.ordem);
    const idx = inZone.findIndex(c => c.id === t.id);
    const j = idx + dir;
    if (j < 0 || j >= inZone.length) return;
    onNotifyEdit?.();
    const arr = [...inZone];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    const renum = arr.map((c, i) => ({ ...c, ordem: i + 1 }));
    const others = topicos.filter(x => x.zona !== t.zona);
    const next = [...others, ...renum];
    setTopicos(next);
    await patchSnapshot(visitaId, (curr) => ({ ...curr, topicos: next }));
    await Promise.all(renum.map(c =>
      offlineUpdate({ visitaId, table: "visita_topicos", rowId: c.id, patch: { ordem: c.ordem } })
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
      const { compressImageFileToDataUrl } = await import("@/lib/imageCompression");
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDimension: 1600, quality: 0.78, maxBytes: 900_000,
      });
      const blob = dataUrl ? dataUrlToBlob(dataUrl) : file;
      const queued = await enqueuePhoto({ visitaId, parentKind: "topico", parentId: t.id, ordem, blob });
      const data = { id: queued.localId, url: `queued:${queued.localId}`, ordem } as TopicoFoto;
      setTopicos(prev => prev.map(x => x.id === t.id
        ? { ...x, fotos: [...x.fotos, data].sort((a,b)=>a.ordem-b.ordem), signed: { ...x.signed, [data.id]: dataUrl || "" } }
        : x));
      await patchSnapshot(visitaId, (curr) => ({
        ...curr,
        topicos: (curr.topicos || []).map((x: any) => x.id === t.id
          ? { ...x, fotos: [...(x.fotos || []), data], signed: { ...(x.signed || {}), [(data as any).id]: dataUrl || "" } }
          : x),
      }));
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.info("Foto salva off-line. Sincronize quando houver internet.");
      }
    } catch (err: any) {
      toast.error("Erro ao preparar foto: " + (err?.message || ""));
    } finally { setUploading(null); }
  }

  async function delFoto(t: Topico, f: TopicoFoto) {
    onNotifyEdit?.();
    if (String(f.url).startsWith("queued:")) {
      await deleteQueuedFoto(f.id);
    } else {
      if (typeof navigator === "undefined" || navigator.onLine) await supabase.storage.from(BUCKET).remove([f.url]);
      await offlineDelete({ visitaId, table: "visita_topico_fotos", rowId: f.id });
    }
    update(t.id, { fotos: t.fotos.filter(x => x.id !== f.id) });
    await patchSnapshot(visitaId, (curr) => ({
      ...curr,
      topicos: (curr.topicos || []).map((x: any) => x.id === t.id
        ? { ...x, fotos: (x.fotos || []).filter((foto: TopicoFoto) => foto.id !== f.id) }
        : x),
    }));
  }

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  const grupos = allowedZonas.map(z => ({
    zona: z,
    items: topicos.filter(t => t.zona === z).sort((a, b) => a.ordem - b.ordem),
  }));

  return (
    <div className="space-y-4">
      {grupos.map(g => (
        <div key={g.zona} className="space-y-2">
          <div
            className="text-[11px] uppercase tracking-wide font-bold px-1"
            style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}
          >
            {ZONA_LABELS[g.zona]}
          </div>
          {g.items.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-3 text-center text-[11px] text-muted-foreground"
              style={{ borderColor: "#E7E3D6" }}>
              Nenhum tópico nesta seção ainda.
            </div>
          )}
          {g.items.map((t, i) => (
            <TopicoCard key={t.id} topico={t} numeroMap={numeroMap}
              onUpdate={update} onSave={saveField} onAddFoto={addFoto} onDelFoto={delFoto}
              uploading={uploading === t.id}
              onMoveUp={i > 0 ? () => move(t, -1) : undefined}
              onMoveDown={i < g.items.length - 1 ? () => move(t, 1) : undefined}
              onDelete={() => deleteTopico(t)}
            />
          ))}
        </div>
      ))}

      <Button type="button" onClick={() => setPickerOpen(true)} variant="outline" className="w-full gap-1.5">
        <Plus className="w-4 h-4" /> Mais
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onde adicionar este tópico?</DialogTitle>
            <DialogDescription>Escolha em qual parte do relatório o novo tópico deve aparecer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {allowedZonas.map(z => (
              <Button
                key={z}
                variant="outline"
                className="h-auto py-3 justify-start flex-col items-start"
                onClick={() => addTopico(z)}
              >
                <div className="font-semibold text-sm">{ZONA_LABELS[z]}</div>
                <div className="text-[11px] text-muted-foreground font-normal text-left">{ZONA_HINTS[z]}</div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
        {onMoveUp && (
          <button type="button" onClick={onMoveUp} className="p-1.5 rounded hover:bg-muted">
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        {onMoveDown && (
          <button type="button" onClick={onMoveDown} className="p-1.5 rounded hover:bg-muted">
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
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
