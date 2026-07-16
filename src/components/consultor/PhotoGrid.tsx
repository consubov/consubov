import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressImageFileToDataUrl } from "@/lib/imageCompression";
import { enqueuePhoto, getQueuedPhotosForParent, subscribeSyncStatus } from "@/lib/consultorOffline/photoQueue";
import { deleteFoto as deleteQueuedFoto } from "@/lib/consultorOffline/db";

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
  visitaPastoId = null,
  visitaCurralId = null,
  max = DEFAULT_MAX,
  disabled,
  className,
}: Props) {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [pendings, setPendings] = useState<Record<number, Pending>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<number>(1);

  const targetId = visitaCurralId || visitaPastoId || null;
  const targetKind: "pasto" | "curral" | null =
    visitaCurralId ? "curral" : visitaPastoId ? "pasto" : null;

  useEffect(() => {
    if (!targetId || !targetKind) { setFotos([]); return; }
    (async () => {
      const col = targetKind === "curral" ? "visita_curral_id" : "visita_pasto_id";
      const { data } = await supabase.from("visita_fotos")
        .select("*").eq(col, targetId).order("ordem");
      const rows = (data as FotoRow[]) || [];
      setFotos(rows);
      const map: Record<string, string> = {};
      await Promise.all(rows.map(async r => { map[r.id] = await getSignedUrl(r.url); }));
      setSigned(map);
    })();
  }, [targetId, targetKind]);

  const slots = Array.from({ length: max }, (_, i) => {
    const ordem = i + 1;
    return { ordem, foto: fotos.find(f => f.ordem === ordem), pending: pendings[ordem] };
  });

  async function uploadPending(ordem: number, blob: Blob, ext: string, previewUrl: string) {
    if (!targetId || !targetKind) return;
    try {
      const folder = targetKind === "curral" ? "currais" : "pastos";
      const path = `${folder}/${targetId}/${ordem}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        upsert: true, contentType: blob.type || "image/jpeg",
      });
      if (error) throw error;
      const insertPayload: any = { url: path, ordem };
      if (targetKind === "curral") insertPayload.visita_curral_id = targetId;
      else insertPayload.visita_pasto_id = targetId;
      const { data, error: insErr } = await supabase.from("visita_fotos")
        .insert(insertPayload).select().single();
      if (insErr) throw insErr;
      const row = data as FotoRow;
      setFotos(prev => [...prev.filter(f => f.ordem !== ordem), row].sort((a, b) => a.ordem - b.ordem));
      // Preserve immediate preview using the local dataUrl so it appears instantly.
      setSigned(prev => ({ ...prev, [row.id]: previewUrl }));
      // Async fetch signed url (also works offline of cache) — swap when ready.
      getSignedUrl(row.url).then(u => {
        if (u) setSigned(prev => ({ ...prev, [row.id]: u }));
      });
      setPendings(prev => { const cp = { ...prev }; delete cp[ordem]; return cp; });
    } catch (err: any) {
      setPendings(prev => ({
        ...prev,
        [ordem]: { ordem, previewUrl, file: blob, ext, status: "error", error: err?.message || "erro" },
      }));
      toast.error("Falha no envio da foto — toque para tentar novamente");
    }
  }

  async function handleUpload(file: File) {
    if (!targetId || !targetKind) {
      toast.error("Salve antes de anexar fotos");
      return;
    }
    const ordem = slotRef.current;
    try {
      // Compress + generate instant preview
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDimension: 1600, quality: 0.78, maxBytes: 900_000,
      });
      if (!dataUrl) throw new Error("Falha ao processar imagem");
      const blob = dataUrlToBlob(dataUrl);
      const ext = "jpg";
      // Optimistic preview
      setPendings(prev => ({
        ...prev,
        [ordem]: { ordem, previewUrl: dataUrl, file: blob, ext, status: "uploading" },
      }));
      // Fire and forget upload
      uploadPending(ordem, blob, ext, dataUrl);
    } catch (err: any) {
      toast.error("Erro ao preparar foto: " + (err?.message || "desconhecido"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function retryPending(ordem: number) {
    const p = pendings[ordem];
    if (!p) return;
    setPendings(prev => ({ ...prev, [ordem]: { ...p, status: "uploading", error: undefined } }));
    uploadPending(ordem, p.file, p.ext, p.previewUrl);
  }

  function cancelPending(ordem: number) {
    setPendings(prev => { const cp = { ...prev }; delete cp[ordem]; return cp; });
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

  const gridCols = "grid-cols-5";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold text-muted-foreground">
        Fotos ({fotos.length}/{max})
      </div>
      <div className={cn("grid gap-1.5", gridCols)}>
        {slots.map(({ ordem, foto, pending }) => {
          const showPending = pending && !foto;
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
              ) : showPending ? (
                <>
                  <img src={pending!.previewUrl} alt="" className="w-full h-full object-cover opacity-90" />
                  {pending!.status === "uploading" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => retryPending(ordem)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/60 text-destructive-foreground"
                        title={pending!.error || "Tentar novamente"}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelPending(ordem)}
                        className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5"
                      >
                        <X className="w-3 h-3 text-destructive-foreground" />
                      </button>
                    </>
                  )}
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
