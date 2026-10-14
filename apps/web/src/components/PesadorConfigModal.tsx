import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function uploadErrorDescription(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return undefined;
}

export default function PesadorConfigModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const dialogOpener = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pesadorId, setPesadorId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pesadores")
        .select("id, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setPesadorId(data?.id ?? null);
      setLogoUrl(data?.logo_url ?? null);
      setLoading(false);
    })();
  }, [open, user]);

  async function handleUpload(file: File) {
    if (!pesadorId) return;
    setSaving(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `pesador-logos/${pesadorId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("relatorios").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("pesadores")
        .update({ logo_url: url })
        .eq("id", pesadorId);
      if (updErr) throw updErr;
      setLogoUrl(url);
      toast({ title: "Logo atualizada" });
    } catch (e: unknown) {
      toast({ title: "Erro ao enviar logo", description: uploadErrorDescription(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!pesadorId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pesadores")
        .update({ logo_url: null })
        .eq("id", pesadorId);
      if (error) throw error;
      setLogoUrl(null);
      toast({ title: "Logo removida" });
    } catch (e: unknown) {
      toast({ title: "Erro", description: uploadErrorDescription(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-modal="true"
        onOpenAutoFocus={() => { dialogOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); dialogOpener.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">A logo aparecerá no canto direito dos relatórios em PDF.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Logo do Pesador</div>
              <div className="text-xs text-muted-foreground mb-3">
                A logo aparecerá no canto direito dos relatórios em PDF.
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center min-h-[100px]">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhuma logo cadastrada</span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={saving || !pesadorId}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {logoUrl ? "Substituir" : "Enviar"}
                </Button>
                {logoUrl && (
                  <Button aria-label="Remover logo" variant="ghost" size="sm" onClick={handleRemove} disabled={saving}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
