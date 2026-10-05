import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoMapaData | null;
  fazendaId: string;
  retiroId: string;
  mes: number;
  ano: number;
  onDone: () => void;
}

export default function MapaAbateModal({ open, onClose, pasto, fazendaId, retiroId, mes, ano, onDone }: Props) {
  const [quantidade, setQuantidade] = useState("");
  const [pesoAbate, setPesoAbate] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [step, setStep] = useState<"input" | "confirm">("input");

  const qtd = parseInt(quantidade) || 0;
  const pesoAbateNum = parseFloat(pesoAbate) || null;
  const isValid = qtd > 0 && pasto && qtd <= pasto.num_animais;

  function handleClose() {
    setQuantidade("");
    setPesoAbate("");
    setStep("input");
    setConfirmando(false);
    onClose();
  }

  function calcNovoPeso(): number | null {
    if (!pasto || !pasto.peso_medio_kg) return pasto?.peso_medio_kg ?? null;
    const totalQtd = pasto.num_animais;
    const restante = totalQtd - qtd;
    if (restante <= 0) return null;

    // No weight informed → keep same average
    if (!pesoAbateNum) return pasto.peso_medio_kg;

    // Recalculate: (total*avg - abate*pesoAbate) / restante
    const novoPeso = (totalQtd * pasto.peso_medio_kg - qtd * pesoAbateNum) / restante;
    return Math.max(0, Math.round(novoPeso * 10) / 10);
  }

  async function handleConfirm() {
    if (!pasto || !isValid) return;
    setConfirmando(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

      // Insert abate record
      const { error: abateErr } = await supabase.from("abates").insert({
        fazenda_id: fazendaId,
        retiro_id: retiroId,
        pasto_id: pasto.pasto_id,
        quantidade: qtd,
        mes, ano,
        usuario_id: userId,
      });
      if (abateErr) throw abateErr;

      // Update pasto
      const newTotal = pasto.num_animais - qtd;
      const novoPeso = calcNovoPeso();
      const updateData: TablesUpdate<"pastos"> = { num_animais: newTotal };
      if (novoPeso !== null) updateData.peso_medio_kg = novoPeso;

      const { error: updateErr } = await supabase.from("pastos")
        .update(updateData)
        .eq("id", pasto.pasto_id);
      if (updateErr) throw updateErr;

      toast.success(`${qtd} animais abatidos de ${pasto.pasto_nome}. Restam ${newTotal}.`);
      onDone();
      handleClose();
    } catch (err: unknown) {
      console.error("Erro no abate:", err);
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setConfirmando(false);
    }
  }

  if (!pasto) return null;

  const novoPeso = calcNovoPeso();
  const restante = pasto.num_animais - qtd;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">🔪 Registrar Abate</DialogTitle>
          <DialogDescription>
            Pasto: <strong>{pasto.pasto_nome}</strong> — {pasto.num_animais} animais · {pasto.peso_medio_kg?.toFixed(1).replace(".", ",") ?? "—"} kg
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade a abater (máx: {pasto.num_animais})</Label>
              <Input type="number" inputMode="numeric" min={1} max={pasto.num_animais}
                value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Peso médio dos abatidos (kg) — opcional</Label>
              <Input type="number" inputMode="decimal" step="0.1" min={0}
                value={pesoAbate} onChange={e => setPesoAbate(e.target.value)}
                placeholder="Deixe vazio para manter peso do lote" />
            </div>

            {qtd > 0 && qtd <= pasto.num_animais && (
              <div className="bg-destructive/10 rounded-md p-3 text-sm text-destructive space-y-1">
                <p><strong>{qtd}</strong> animais serão abatidos. Restam <strong>{restante}</strong>.</p>
                {novoPeso !== null && restante > 0 && (
                  <p className="text-xs">Novo peso médio: <strong>{novoPeso.toFixed(1).replace(".", ",")} kg</strong></p>
                )}
                {restante === 0 && <p className="font-semibold">⚠ Abate total — pasto ficará zerado.</p>}
              </div>
            )}
            {qtd > pasto.num_animais && (
              <p className="text-sm text-destructive font-medium">Quantidade maior que o disponível.</p>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm space-y-2">
            <p className="font-bold text-destructive">Confirmar abate de {qtd} animais do pasto {pasto.pasto_nome}?</p>
            <p className="text-muted-foreground">Esta ação não pode ser desfeita.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === "input" ? (
            <Button variant="destructive" onClick={() => setStep("confirm")} disabled={!isValid}>Avançar</Button>
          ) : (
            <Button variant="destructive" onClick={handleConfirm} disabled={confirmando}>
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Abate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
