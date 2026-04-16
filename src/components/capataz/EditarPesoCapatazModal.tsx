import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  pesoAtual: number | null;
  onDone: () => void;
}

export default function EditarPesoCapatazModal({ open, onClose, pastoId, pastoNome, pesoAtual, onDone }: Props) {
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);

  function handleOpen() {
    if (pesoAtual) setPeso(pesoAtual.toString());
  }

  function handleClose() {
    setPeso("");
    setSalvando(false);
    onClose();
  }

  const pesoNum = parseFloat(peso) || 0;

  async function handleSave() {
    if (pesoNum <= 0) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos").update({ peso_medio_kg: pesoNum }).eq("id", pastoId);
      if (error) throw error;
      toast.success(`Peso médio atualizado para ${pesoNum.toFixed(1).replace(".", ",")} kg`);
      onDone();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); if (!o) handleClose(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>⚖️ Editar Peso Médio</DialogTitle>
          <DialogDescription>
            Pasto: <strong>{pastoNome}</strong> — Atual: {pesoAtual?.toFixed(1).replace(".", ",") ?? "—"} kg
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Novo peso médio (kg)</Label>
            <Input type="number" inputMode="decimal" step="0.1" min={0}
              value={peso} onChange={e => setPeso(e.target.value)}
              placeholder={pesoAtual?.toString() || "0"} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={pesoNum <= 0 || salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
