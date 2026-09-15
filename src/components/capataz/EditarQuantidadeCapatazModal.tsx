import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimaisAtual: number;
  pesoAtual: number | null;
  onPastoUpdated: () => void;
}

export default function EditarQuantidadeCapatazModal({ open, onClose, pastoId, pastoNome, numAnimaisAtual, pesoAtual, onPastoUpdated }: Props) {
  const [quantidade, setQuantidade] = useState(() => numAnimaisAtual > 0 ? String(numAnimaisAtual) : "");
  const [peso, setPeso] = useState(() => pesoAtual != null && pesoAtual > 0 ? String(pesoAtual) : "");
  const [salvando, setSalvando] = useState(false);
  const [zerarOpen, setZerarOpen] = useState(false);

  function handleOpen() {
    setQuantidade(numAnimaisAtual > 0 ? String(numAnimaisAtual) : "");
    setPeso(pesoAtual != null && pesoAtual > 0 ? String(pesoAtual) : "");
    setZerarOpen(false);
  }

  useEffect(() => {
    if (open) handleOpen();
  }, [open]);

  function handleClose() {
    setQuantidade("");
    setPeso("");
    setSalvando(false);
    setZerarOpen(false);
    onClose();
  }

  const qtdNum = parseInt(quantidade, 10);
  const pesoNum = parseFloat(peso);
  const isValid = Number.isFinite(qtdNum) && qtdNum >= 0 && Number.isFinite(pesoNum) && pesoNum >= 0;

  async function handleSave() {
    if (!isValid) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update({ num_animais: qtdNum, peso_medio_kg: pesoNum })
        .eq("id", pastoId);
      if (error) throw error;
      toast.success(`Pasto ${pastoNome} atualizado: ${qtdNum} animais · ${pesoNum.toFixed(1).replace(".", ",")} kg`);
      onPastoUpdated();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleZerar() {
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update({ num_animais: 0, peso_medio_kg: 0 })
        .eq("id", pastoId);
      if (error) throw error;
      toast.success(`Pasto ${pastoNome} zerado`);
      setZerarOpen(false);
      onPastoUpdated();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); if (!o) handleClose(); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>✏️ Editar quantidade</DialogTitle>
                <DialogDescription>
                  Pasto: <strong>{pastoNome}</strong>
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => setZerarOpen(true)}
                disabled={salvando}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Zerar pasto
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade de animais</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Peso médio (kg)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!isValid || salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={zerarOpen} onOpenChange={setZerarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar pasto {pastoNome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso define a quantidade de animais e o peso médio como 0. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleZerar} disabled={salvando} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Zerar pasto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
