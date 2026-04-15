import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  userId: string;
  onSaved?: () => void;
}

export default function ObservacaoLoteModal({ open, onClose, pastoId, pastoNome, userId, onSaved }: Props) {
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!texto.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("eventos_lote").insert({
        lote_id: pastoId,
        tipo: "observacao",
        usuario_id: userId,
        data_evento: new Date().toISOString(),
        dados: { texto: texto.trim() },
      });
      if (error) throw error;
      toast.success("Observação registrada!");
      setTexto("");
      onClose();
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTexto(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Observação do Lote</DialogTitle>
          <DialogDescription>{pastoNome}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label>Descrição</Label>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Descreva a observação..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setTexto(""); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!texto.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
