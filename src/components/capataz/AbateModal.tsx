import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AbateModalProps {
  open: boolean;
  onClose: () => void;
  pasto: { id: string; nome: string; num_animais: number } | null;
  fazendaId: string;
  retiroId: string;
  mesOperacional: number;
  anoOperacional: number;
  onAbateConfirmed: (pastoId: string, quantidade: number) => void;
}

export default function AbateModal({
  open, onClose, pasto, fazendaId, retiroId,
  mesOperacional, anoOperacional, onAbateConfirmed,
}: AbateModalProps) {
  const [quantidade, setQuantidade] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  const qtd = parseInt(quantidade) || 0;
  const isValid = qtd > 0 && pasto && qtd <= pasto.num_animais;

  function handleClose() {
    setQuantidade("");
    setStep('input');
    setConfirmando(false);
    onClose();
  }

  async function handleConfirm() {
    if (!pasto || !isValid) return;
    setConfirmando(true);
    try {
      // 1. Insert abate record
      const { error: abateErr } = await supabase.from("abates" as any).insert({
        fazenda_id: fazendaId,
        retiro_id: retiroId,
        pasto_id: pasto.id,
        quantidade: qtd,
        mes: mesOperacional,
        ano: anoOperacional,
        usuario_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (abateErr) throw abateErr;

      // 2. Update pasto num_animais
      const newTotal = pasto.num_animais - qtd;
      const { error: updateErr } = await supabase.from("pastos")
        .update({ num_animais: newTotal })
        .eq("id", pasto.id);
      if (updateErr) throw updateErr;

      toast.success(`${qtd} animais abatidos de ${pasto.nome}. Restam ${newTotal}.`);
      onAbateConfirmed(pasto.id, qtd);
      handleClose();
    } catch (err: any) {
      console.error("Erro no abate:", err);
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
          <DialogTitle className="text-destructive">🔴 Abater Animais</DialogTitle>
          <DialogDescription>
            Pasto: <strong>{pasto.nome}</strong> — Total: <strong>{pasto.num_animais}</strong> animais
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade a abater (máx: {pasto.num_animais})</Label>
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
            {qtd > 0 && qtd <= pasto.num_animais && (
              <div className="bg-destructive/10 rounded-md p-3 text-sm text-destructive">
                <strong>{qtd}</strong> animais serão abatidos. Restam <strong>{pasto.num_animais - qtd}</strong>.
                {qtd === pasto.num_animais && <p className="mt-1 font-semibold">⚠ Abate total — pasto ficará zerado.</p>}
              </div>
            )}
            {qtd > pasto.num_animais && (
              <p className="text-sm text-destructive font-medium">Quantidade maior que o total disponível.</p>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm space-y-2">
            <p className="font-bold text-destructive">Tem certeza que deseja abater {qtd} animais do pasto {pasto.nome}?</p>
            <p className="text-muted-foreground">Esta ação não pode ser desfeita.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'input' ? (
            <Button
              variant="destructive"
              onClick={() => setStep('confirm')}
              disabled={!isValid}
            >
              Avançar
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={confirmando}
            >
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Abate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
