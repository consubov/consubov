import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoMapaData | null;
  onDone: () => void;
}

export default function EditarPesoModal({ open, onClose, pasto, onDone }: Props) {
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);

  function handleOpen() {
    if (pasto?.peso_medio_kg) setPeso(pasto.peso_medio_kg.toString());
  }

  function handleClose() {
    setPeso("");
    setSalvando(false);
    onClose();
  }

  const pesoNum = parseFloat(peso) || 0;
  const isValid = pesoNum > 0;

  async function handleSave() {
    if (!pasto || !isValid) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update({ peso_medio_kg: pesoNum })
        .eq("id", pasto.pasto_id);
      if (error) throw error;

      toast.success(`Peso médio de ${pasto.pasto_nome} atualizado para ${pesoNum.toFixed(1).replace(".", ",")} kg`);
      onDone();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  if (!pasto) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); if (!o) handleClose(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>⚖️ Editar Peso Médio</DialogTitle>
          <DialogDescription>
            Pasto: <strong>{pasto.pasto_nome}</strong> — Atual: {pasto.peso_medio_kg?.toFixed(1).replace(".", ",") ?? "—"} kg
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Novo peso médio (kg)</Label>
            <Input type="number" inputMode="decimal" step="0.1" min={0}
              value={peso} onChange={e => setPeso(e.target.value)}
              placeholder={pasto.peso_medio_kg?.toString() || "0"} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isValid || salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
