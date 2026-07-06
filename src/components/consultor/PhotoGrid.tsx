import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BUCKET = "visitas-consultor-fotos";
const MAX = 5;

export interface FotoRow {
  id: string;
  visita_pasto_id: string;
  url: string; // storage path
  ordem: number;
}

interface Props {
  visitaPastoId: string | null; // null = not yet saved
  disabled?: boolean;
  className?: string;
}

async function getSignedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

export default function PhotoGrid({ visitaPastoId, disabled, className }: Props) {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<number>(1);

  useEffect(() => {
    if (!visitaPastoId) { setFotos([]); return; }
    (async () => {
      const { data } = await supabase.from("visita_fotos")
        .select("*").eq("visita_pasto_id", visitaPastoId).order("ordem");
      const rows = (data as FotoRow[]) || [];
      setFotos(rows);
      const map: Record<string, string> = {};
      await Promise.all(rows.map(async r => { map[r.id] = await getSignedUrl(r.url); }));
      setSigned(map);
    })();
  }, [visitaPastoId]);

  const slots = Array.from({ length: MAX }, (_, i) => {
    const ordem = i + 1;
    return { ordem, foto: fotos.find(f => f.ordem === ordem) };
  });

  async function handleUpload(file: File) {
    if (!visitaPastoId) { toast.error("Salve o pasto antes de anexar fotos"); return; }
    const ordem = slotRef.current;
    setUploadingSlot(ordem);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${visitaPastoId}/${ordem}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: insErr } = await supabase.from("visita_fotos")
        .insert({ visita_pasto_id: visitaPastoId, url: path, ordem })
        .select().single();
      if (insErr) throw insErr;
      const row = data as FotoRow;
      const url = await getSignedUrl(row.url);
      setFotos(prev => [...prev.filter(f => f.ordem !== ordem), row].sort((a, b) => a.ordem - b.ordem));
      setSigned(prev => ({ ...prev, [row.id]: url }));
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + (err?.message || "desconhecido"));
    } finally {
      setUploadingSlot(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(f: FotoRow) {
    try {
      await supabase.storage.from(BUCKET).remove([f.url]);
      await supabase.from("visita_fotos").delete().eq("id", f.id);
      setFotos(prev => prev.filter(x => x.id !== f.id));
    } catch (err: any) {
      toast.error("Erro ao remover foto");
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold text-muted-foreground">Fotos ({fotos.length}/{MAX})</div>
      <div className="grid grid-cols-5 gap-1.5">
        {slots.map(({ ordem, foto }) => (
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
            ) : (
              <button
                type="button"
                disabled={disabled || uploadingSlot !== null || !visitaPastoId}
                onClick={() => { slotRef.current = ordem; inputRef.current?.click(); }}
                className="w-full h-full flex items-center justify-center text-muted-foreground disabled:opacity-40"
                title={visitaPastoId ? "Adicionar foto" : "Salve o pasto primeiro"}
              >
                {uploadingSlot === ordem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
      />
    </div>
  );
}
