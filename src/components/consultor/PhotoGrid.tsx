import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressImageFileToDataUrl } from "@/lib/imageCompression";
import { enqueuePhoto, getQueuedPhotosForParent, subscribeSyncStatus } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto } from "@/lib/consultorOffline/db";
import { loadSnapshot, patchSnapshot } from "@/lib/consultorOffline/snapshotStore";

const BUCKET = "visitas-consultor-fotos";
const DEFAULT_MAX = 5;

export interface FotoRow {
  id: string;
  visita_pasto_id: string | null;
  visita_curral_id: string | null;
  url: string; // storage path
  ordem: number;
}

interface Props {
  visitaId?: string | null;
  visitaPastoId?: string | null;
  visitaCurralId?: string | null;
  max?: number;
  disabled?: boolean;
  className?: string;
}

interface Pending {
  ordem: number;
  previewUrl: string;
  file: Blob;
  ext: string;
  status: "uploading" | "error";
  error?: string;
}

async function getSignedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function PhotoGrid({
  visitaId = null,
  visitaPastoId = null,
  visitaCurralId = null,
  max = DEFAULT_MAX,
  disabled,
  className,
}: Props) {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [pendings, setPendings] = useState<Record<number, Pending>>({});
  const [queuedPreviews, setQueuedPreviews] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<number>(1);

  const targetId = visitaCurralId || visitaPastoId || null;
  const targetKind: "pasto" | "curral" | null =
    visitaCurralId ? "curral" : visitaPastoId ? "pasto" : null;

  const reloadFotos = async () => {
    if (!targetId || !targetKind) { setFotos([]); return; }
    const snap = visitaId ? await loadSnapshot(visitaId) : null;
    const snapParent = targetKind === "curral"
      ? (snap?.currais || []).find((c: any) => c.id === targetId)
      : (snap?.pastos || []).find((p: any) => p.id === targetId);
    const snapFotos = (snapParent?.fotos || []) as FotoRow[];
    const snapSigned = (snapParent?.signed || {}) as Record<string, string>;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFotos(snapFotos.filter((f) => !String(f.url || "").startsWith("queued:")));
      setSigned(snapSigned);
      return;
    }
    const col = targetKind === "curral" ? "visita_curral_id" : "visita_pasto_id";
    const { data } = await supabase.from("visita_fotos")
      .select("*").eq(col, targetId).order("ordem");
    const rows = (data as FotoRow[]) || [];
    const queuedLocal = snapFotos.filter((f) => String(f.url || "").startsWith("queued:"));
    setFotos([...rows, ...queuedLocal.filter((q) => !rows.some((r) => r.ordem === q.ordem))]);
    const map: Record<string, string> = { ...snapSigned };
    await Promise.all(rows.map(async r => { map[r.id] = await getSignedUrl(r.url); }));
    setSigned(map);
  };

  useEffect(() => {
    void reloadFotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetKind]);

  // Load queued (persisted) uploads for this parent and refresh when the queue drains
  useEffect(() => {
    if (!targetId || !targetKind) return;
    let alive = true;
    const refresh = async () => {
      const items = await getQueuedPhotosForParent(targetKind, targetId);
      if (!alive) return;
      const map: Record<number, string> = {};
      items.forEach(it => { map[it.ordem] = URL.createObjectURL(it.blob); });
      setQueuedPreviews(prev => {
        // revoke old
        Object.values(prev).forEach(url => URL.revokeObjectURL(url));
        return map;
      });
    };
    void refresh();
    let prevPending = 0;
    const unsub = subscribeSyncStatus((pending) => {
      // só recarrega quando a fila de fotos ACABOU de esvaziar (evita loop de sync ao adicionar fotos online)
      if (prevPending > 0 && pending === 0) { void refresh(); void reloadFotos(); }
      prevPending = pending;
    });
    return () => { alive = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetKind]);

  const slots = Array.from({ length: max }, (_, i) => {
    const ordem = i + 1;
    const foto = fotos.find(f => f.ordem === ordem);
    const pending = pendings[ordem];
    const queuedPreview = queuedPreviews[ordem];
    return { ordem, foto, pending, queuedPreview };
  });

  async function handleUpload(file: File) {
    if (!targetId || !targetKind) {
      toast.error("Salve antes de anexar fotos");
      return;
    }
    const ordem = slotRef.current;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDimension: 1600, quality: 0.78, maxBytes: 900_000,
      });
      if (!dataUrl) throw new Error("Falha ao processar imagem");
      const blob = dataUrlToBlob(dataUrl);
      // Optimistic preview immediately
      setPendings(prev => ({
        ...prev,
        [ordem]: { ordem, previewUrl: dataUrl, file: blob, ext: "jpg", status: "uploading" },
      }));
      // Persist to IndexedDB queue — survives app close, uploads in background
      await enqueuePhoto({
        visitaId: visitaId || targetId,
        parentKind: targetKind,
        parentId: targetId,
        ordem,
        blob,
      });
      if (visitaId) {
        const queuedId = queued.localId;
        await patchSnapshot(visitaId, (curr) => {
          const key = targetKind === "curral" ? "currais" : "pastos";
          return {
            ...curr,
            [key]: ((curr as any)[key] || []).map((item: any) => item.id === targetId
              ? {
                  ...item,
                  fotos: [...(item.fotos || []), { id: queuedId, url: `queued:${queuedId}`, ordem }].sort((a: FotoRow, b: FotoRow) => a.ordem - b.ordem),
                  signed: { ...(item.signed || {}), [queuedId]: dataUrl },
                }
              : item),
          };
        });
      }
      // Clear inline pending — the queue-driven refresh will render it
      setPendings(prev => { const cp = { ...prev }; delete cp[ordem]; return cp; });
    } catch (err: any) {
      toast.error("Erro ao preparar foto: " + (err?.message || "desconhecido"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(f: FotoRow) {
    try {
      await supabase.storage.from(BUCKET).remove([f.url]);
      await supabase.from("visita_fotos").delete().eq("id", f.id);
      setFotos(prev => prev.filter(x => x.id !== f.id));
    } catch {
      toast.error("Erro ao remover foto");
    }
  }

  async function cancelQueued(ordem: number) {
    if (!targetId || !targetKind) return;
    const items = await getQueuedPhotosForParent(targetKind, targetId);
    const target = items.find(it => it.ordem === ordem);
    if (target) {
      await deleteQueuedFoto(target.localId);
      if (visitaId) {
        await patchSnapshot(visitaId, (curr) => {
          const key = targetKind === "curral" ? "currais" : "pastos";
          return {
            ...curr,
            [key]: ((curr as any)[key] || []).map((item: any) => item.id === targetId
              ? { ...item, fotos: (item.fotos || []).filter((f: FotoRow) => f.id !== target.localId) }
              : item),
          };
        });
      }
      setQueuedPreviews(prev => {
        const cp = { ...prev };
        if (cp[ordem]) URL.revokeObjectURL(cp[ordem]);
        delete cp[ordem];
        return cp;
      });
    }
  }

  const gridCols = "grid-cols-5";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold text-muted-foreground">
        Fotos ({fotos.length}/{max})
      </div>
      <div className={cn("grid gap-1.5", gridCols)}>
        {slots.map(({ ordem, foto, pending, queuedPreview }) => {
          const showQueued = !foto && queuedPreview;
          const showPending = !foto && !queuedPreview && pending;
          return (
            <div key={ordem} className="aspect-square rounded-md border border-dashed border-border bg-muted/40 relative overflow-hidden">
              {foto ? (
                <>
                  {signed[foto.id]
                    ? <img src={signed[foto.id]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /></div>}
                  {!disabled && (
                    <button type="button" onClick={() => handleDelete(foto)}
                      className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  )}
                </>
              ) : showQueued ? (
                <>
                  <img src={queuedPreview} alt="" className="w-full h-full object-cover" />
                  {typeof navigator !== "undefined" && !navigator.onLine && (
                    <div className="absolute bottom-0.5 left-0.5 flex items-center gap-1 rounded bg-background/85 px-1 py-0.5 text-[8px] font-medium text-foreground">
                      <Loader2 className="w-2 h-2 animate-spin" /> off-line
                    </div>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => cancelQueued(ordem)}
                      className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5"
                      title="Cancelar envio"
                    >
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  )}
                </>
              ) : showPending ? (
                <>
                  <img src={pending!.previewUrl} alt="" className="w-full h-full object-cover opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled || !targetId}
                  onClick={() => { slotRef.current = ordem; inputRef.current?.click(); }}
                  className="w-full h-full flex items-center justify-center text-muted-foreground disabled:opacity-40"
                  title={targetId ? "Adicionar foto" : "Salve antes"}
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
      />
    </div>
  );
}
