import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdicionarEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retiros: { id: string; nome: string }[];
  onConfirm: (retiroId: string, quantidade: number) => Promise<void>;
}

export default function AdicionarEstoqueModal({ open, onOpenChange, retiros, onConfirm }: AdicionarEstoqueModalProps) {
  const [retiroId, setRetiroId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    const qtd = parseInt(quantidade);
    if (!retiroId || isNaN(qtd) || qtd <= 0) return;
    setSaving(true);
    await onConfirm(retiroId, qtd);
    setSaving(false);
    setRetiroId("");
    setQuantidade("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Estoque</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Retiro</Label>
            <Select value={retiroId} onValueChange={setRetiroId}>
              <SelectTrigger><SelectValue placeholder="Selecione o retiro" /></SelectTrigger>
              <SelectContent>
                {retiros.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade (sacos)</Label>
            <Input type="number" inputMode="numeric" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !retiroId || !quantidade || parseInt(quantidade) <= 0}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
