import { useEffect, useRef, useState } from "react";
import { Camera, CloudOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { prepareConsultorPhotoFile } from "@/lib/consultorOffline/photoBlob";
import { getCachedSignedUrl } from "@/lib/consultorOffline/signedUrlCache";
import { pennStateRequest } from "@/lib/pennStateStore";

const BUCKET = "visitas-consultor-fotos";
const MAX = 5;

export interface PennStateFotoRow {
  id: string;
  penn_state_analise_id: string;
  url: string;
  ordem: number;
}

interface Props {
  analiseId: string | null;
  /** Fotos já persistidas desta análise. */
  fotos: PennStateFotoRow[];
  /** id da foto -> número global da visita. */
  numeroMap: Record<string, number>;
  /** Número global a usar para a próxima foto ainda sem id persistido. */
  proximoNumero: number;
  onChange: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

interface Local {
  ordem: number;
  previewUrl: string;
  uploading: boolean;
}

export default function PennStateFotoGrid({
  analiseId, fotos, numeroMap, proximoNumero, onChange, disabled, className,
}: Props) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [locais, setLocais] = useState<Record<number, Local>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<number>(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(fotos.map(async f => { map[f.id] = await getCachedSignedUrl(f.url); }));
      if (alive) setSigned(map);
    })();
    return () => { alive = false; };
  }, [fotos]);

  const slots = Array.from({ length: MAX }, (_, i) => {
    const ordem = i + 1;
    return { ordem, foto: fotos.find(f => f.ordem === ordem), local: locais[ordem] };
  });

  async function handleUpload(file: File) {
    if (!analiseId) { toast.error("Salve a análise antes de anexar fotos."); return; }
    const ordem = slotRef.current;
    try {
      // Preview instantâneo — nunca espera o upload.
      const { dataUrl, blob } = await prepareConsultorPhotoFile(file);
      setLocais(prev => ({ ...prev, [ordem]: { ordem, previewUrl: dataUrl, uploading: true } }));

      const path = `penn-state/${analiseId}/${ordem}-${Date.now()}.jpg`;
      // Recria o Blob a cada tentativa: no Safari uma referência antiga pode
      // já estar inválida e falhar com "Load failed" na primeira chamada.
      const { error: upErr } = await pennStateRequest("enviar foto Penn State", async () => {
        const fresh = new Blob([await blob.arrayBuffer()], { type: blob.type || "image/jpeg" });
        return supabase.storage
          .from(BUCKET)
          .upload(path, fresh, { upsert: true, contentType: fresh.type });
      });
      if (upErr) throw upErr;

      const { error: insErr } = await pennStateRequest("registrar foto Penn State", () =>
        (supabase as any)
          .from("penn_state_analise_fotos")
          .insert({ penn_state_analise_id: analiseId, url: path, ordem }));
      if (insErr) throw insErr;

      setLocais(prev => { const cp = { ...prev }; delete cp[ordem]; return cp; });
      await onChange();
    } catch (err: any) {
      setLocais(prev => ({ ...prev, [ordem]: { ...(prev[ordem] as Local), uploading: false } }));
      toast.error("Não foi possível enviar a foto: " + (err?.message || "sem conexão"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(f: PennStateFotoRow) {
    try {
      await supabase.storage.from(BUCKET).remove([f.url]);
      const { error } = await (supabase as any)
        .from("penn_state_analise_fotos").delete().eq("id", f.id);
      if (error) throw error;
      // Reajusta a numeração dos slots seguintes.
      const restantes = fotos.filter(x => x.id !== f.id).sort((a, b) => a.ordem - b.ordem);
      await Promise.all(restantes.map((x, i) => i + 1 === x.ordem
        ? null
        : (supabase as any).from("penn_state_analise_fotos").update({ ordem: i + 1 }).eq("id", x.id)));
      setLocais({});
      await onChange();
    } catch {
      toast.error("Erro ao remover foto");
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold text-muted-foreground">
        Fotos ({fotos.length}/{MAX})
      </div>
      <div className="grid gap-1.5 grid-cols-5">
        {slots.map(({ ordem, foto, local }) => {
          const numero = foto ? numeroMap[foto.id] : (local ? proximoNumero : undefined);
          return (
            <div key={ordem} className="aspect-square rounded-md border border-dashed border-border bg-muted/40 relative overflow-hidden">
              {foto ? (
                <>
                  {signed[foto.id]
                    ? <img loading="lazy" decoding="async" src={signed[foto.id]} alt={`Foto ${numero ?? ordem} da análise`} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /></div>}
                  {numero != null && (
                    <div className="absolute bottom-0.5 left-0.5 rounded bg-background/85 px-1 text-[9px] font-semibold text-foreground">
                      {numero}
                    </div>
                  )}
                  {!disabled && (
                    <button type="button" onClick={() => handleDelete(foto)}
                      aria-label={`Excluir foto ${numero ?? ordem}`}
                      className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  )}
                </>
              ) : local ? (
                <>
                  <img loading="lazy" decoding="async" src={local.previewUrl} alt="" className="w-full h-full object-cover opacity-90" />
                  <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 rounded bg-background/85 px-1 py-0.5 text-[8px] font-medium text-amber-600">
                    {local.uploading
                      ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> enviando</>
                      : <><CloudOff className="w-2.5 h-2.5" /> falhou</>}
                  </div>
                  {!disabled && (
                    <button type="button"
                      onClick={() => setLocais(prev => { const cp = { ...prev }; delete cp[ordem]; return cp; })}
                      aria-label="Descartar foto"
                      className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled || !analiseId}
                  onClick={() => { slotRef.current = ordem; inputRef.current?.click(); }}
                  className="w-full h-full flex items-center justify-center text-muted-foreground disabled:opacity-40"
                  title={analiseId ? "Adicionar foto" : "Salve a análise antes"}
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!analiseId && (
        <p className="text-[10px] text-muted-foreground">Salve a análise para anexar fotos.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
      />
    </div>
  );
}
