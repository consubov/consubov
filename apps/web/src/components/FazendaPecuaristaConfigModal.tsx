import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fazendaId: string | null;
  onSaved?: () => void;
}

export default function FazendaPecuaristaConfigModal({ open, onOpenChange, fazendaId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !fazendaId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("fazendas_pecuarista")
        .select("logo_url")
        .eq("id", fazendaId)
        .maybeSingle();
      setLogoUrl((data as any)?.logo_url ?? null);
      setLoading(false);
    })();
  }, [open, fazendaId]);

  async function handleUpload(file: File) {
    if (!fazendaId) return;
    setSaving(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `fazenda-logos/${fazendaId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("relatorios").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("fazendas_pecuarista")
        .update({ logo_url: url })
        .eq("id", fazendaId);
      if (updErr) throw updErr;
      setLogoUrl(url);
      onSaved?.();
      toast.success("Logo atualizada");
    } catch (e: any) {
      toast.error("Erro ao enviar logo: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!fazendaId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("fazendas_pecuarista")
        .update({ logo_url: null })
        .eq("id", fazendaId);
      if (error) throw error;
      setLogoUrl(null);
      onSaved?.();
      toast.success("Logo removida");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configurações da Fazenda</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Logo da fazenda</div>
              <div className="text-xs text-muted-foreground mb-3">
                A logo aparecerá no canto direito dos relatórios em PDF desta fazenda. Sem logo, será usada a marca "Mais Arrobas".
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
                  disabled={saving || !fazendaId}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {logoUrl ? "Substituir" : "Enviar"}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemove} disabled={saving}>
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
