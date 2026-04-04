import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransferenciaModalProps {
  open: boolean;
  onClose: () => void;
  pasto: { id: string; nome: string; num_animais: number } | null;
  pastos: { id: string; nome: string; num_animais: number }[];
  fazendaId: string;
  retiroId: string;
  mesOperacional: number;
  anoOperacional: number;
  onTransferConfirmed: (origemId: string, destinoId: string, quantidade: number) => void;
}

export default function TransferenciaModal({
  open, onClose, pasto, pastos, fazendaId, retiroId,
  mesOperacional, anoOperacional, onTransferConfirmed,
}: TransferenciaModalProps) {
  const [quantidade, setQuantidade] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  const qtd = parseInt(quantidade) || 0;
  const isValid = qtd > 0 && pasto && qtd <= pasto.num_animais && destinoId && destinoId !== pasto.id;
  const destino = pastos.find(p => p.id === destinoId);
  const destinosDisponiveis = pastos.filter(p => pasto && p.id !== pasto.id);

  function handleClose() {
    setQuantidade("");
    setDestinoId("");
    setStep('input');
    setConfirmando(false);
    onClose();
  }

  async function handleConfirm() {
    if (!pasto || !isValid || !destino) return;
    setConfirmando(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

      // 1. Record transfer event
      const { error: movErr } = await supabase.from("movimentacoes_animais" as any).insert({
        fazenda_id: fazendaId,
        retiro_id: retiroId,
        pasto_origem_id: pasto.id,
        pasto_destino_id: destinoId,
        quantidade: qtd,
        mes: mesOperacional,
        ano: anoOperacional,
        usuario_id: userId,
      });
      if (movErr) throw movErr;

      // 2. Update origin pasto
      const { error: errOrigem } = await supabase.from("pastos")
        .update({ num_animais: pasto.num_animais - qtd })
        .eq("id", pasto.id);
      if (errOrigem) throw errOrigem;

      // 3. Update destination pasto
      const { error: errDestino } = await supabase.from("pastos")
        .update({ num_animais: destino.num_animais + qtd })
        .eq("id", destinoId);
      if (errDestino) throw errDestino;

      toast.success(`${qtd} animais transferidos de ${pasto.nome} para ${destino.nome}.`);
      onTransferConfirmed(pasto.id, destinoId, qtd);
      handleClose();
    } catch (err: any) {
      console.error("Erro na transferência:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setConfirmando(false);
    }
  }

  if (!pasto) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🔄 Transferir Animais</DialogTitle>
          <DialogDescription>
            Pasto: <strong>{pasto.nome}</strong> — Total: <strong>{pasto.num_animais}</strong> animais
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade a transferir (máx: {pasto.num_animais})</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={pasto.num_animais}
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Pasto destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o pasto" /></SelectTrigger>
                <SelectContent>
                  {destinosDisponiveis.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.num_animais} animais)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {qtd > 0 && destino && qtd <= pasto.num_animais && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <strong>{qtd}</strong> animais saem de <strong>{pasto.nome}</strong> → <strong>{destino.nome}</strong>
              </div>
            )}
            {qtd > pasto.num_animais && (
              <p className="text-sm text-destructive font-medium">Quantidade maior que o total disponível.</p>
            )}
          </div>
        )}

        {step === 'confirm' && destino && (
          <div className="bg-primary/10 border border-primary/30 rounded-md p-4 text-sm space-y-2">
            <p className="font-bold text-primary">
              Tem certeza que deseja transferir {qtd} animais do pasto {pasto.nome} para {destino.nome}?
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'input' ? (
            <Button onClick={() => setStep('confirm')} disabled={!isValid}>
              Avançar
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={confirmando}>
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Transferência"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
