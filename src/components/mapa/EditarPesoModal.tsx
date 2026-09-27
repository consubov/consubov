import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PastoMapaData } from "@/hooks/useMapaData";
import CategoriaPastoSelect from "@/components/pastos/CategoriaPastoSelect";
import { faltaCategoria, isCategoriaValida, MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoMapaData | null;
  onDone: () => void;
}

export default function EditarPesoModal({ open, onClose, pasto, onDone }: Props) {
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [categoria, setCategoria] = useState("");
  const precisaCategoria = !!pasto && faltaCategoria(pasto.num_animais, pasto.categoria);

  function handleOpen() {
    if (pasto?.peso_medio_kg) setPeso(pasto.peso_medio_kg.toString());
    setCategoria(isCategoriaValida(pasto?.categoria) ? (pasto!.categoria as string) : "");
  }

  function handleClose() {
    setPeso("");
    setCategoria("");
    setSalvando(false);
    onClose();
  }

  const pesoNum = parseFloat(peso) || 0;
  const isValid = pesoNum > 0 && (!precisaCategoria || isCategoriaValida(categoria));

  async function handleSave() {
    if (!pasto) return;
    if (precisaCategoria && !isCategoriaValida(categoria)) { toast.error(MSG_CATEGORIA_OBRIGATORIA); return; }
    if (!isValid) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update(precisaCategoria ? { peso_medio_kg: pesoNum, categoria } : { peso_medio_kg: pesoNum })
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
          {precisaCategoria && <CategoriaPastoSelect value={categoria} onChange={setCategoria} />}
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
