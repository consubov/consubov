import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { PastoMapaData } from "@/hooks/useMapaData";
import CategoriaPastoSelect from "@/components/pastos/CategoriaPastoSelect";
import { isCategoriaValida, MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoMapaData | null;
  allPastos: PastoMapaData[];
  fazendaId: string;
  retiroId: string;
  mes: number;
  ano: number;
  onDone: () => void;
  onSelectDestino: () => void;
  selectedDestino: PastoMapaData | null;
}

export default function MapaTransferenciaModal({
  open, onClose, pasto, allPastos, fazendaId, retiroId, mes, ano, onDone, onSelectDestino, selectedDestino,
}: Props) {
  const [quantidade, setQuantidade] = useState("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [categoriaDestino, setCategoriaDestino] = useState("");
  const destinoSemCategoria = !!selectedDestino && !isCategoriaValida(selectedDestino.categoria);
  useEffect(() => {
    setCategoriaDestino(isCategoriaValida(pasto?.categoria) ? (pasto!.categoria as string) : "");
  }, [selectedDestino?.pasto_id, pasto?.pasto_id, pasto?.categoria]);
  const categoriaOk = !destinoSemCategoria || isCategoriaValida(categoriaDestino);

  const qtd = parseInt(quantidade) || 0;
  const pesoTransf = parseFloat(pesoMedio) || (pasto?.peso_medio_kg ?? 0);
  const isValid = qtd > 0 && pasto && qtd <= pasto.num_animais && selectedDestino && selectedDestino.pasto_id !== pasto.pasto_id && categoriaOk;

  function handleClose() {
    setQuantidade("");
    setPesoMedio("");
    setStep("input");
    setConfirmando(false);
    onClose();
  }

  function calcWeightedAvg(qtd1: number, peso1: number, qtd2: number, peso2: number) {
    const total = qtd1 + qtd2;
    if (total === 0) return 0;
    return (qtd1 * peso1 + qtd2 * peso2) / total;
  }

  async function handleConfirm() {
    if (!pasto || !selectedDestino) return;
    if (!categoriaOk) { toast.error(MSG_CATEGORIA_OBRIGATORIA); return; }
    if (!isValid) return;
    setConfirmando(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const nowIso = new Date().toISOString();
      const isFullTransfer = qtd === pasto.num_animais;

      // Record transfer (with peso_medio + categoria)
      const { error: movErr } = await supabase.from("movimentacoes_animais").insert({
        fazenda_id: fazendaId,
        retiro_id: retiroId,
        pasto_origem_id: pasto.pasto_id,
        pasto_destino_id: selectedDestino.pasto_id,
        quantidade: qtd,
        peso_medio: pesoTransf || null,
        categoria: pasto.categoria ?? null,
        mes, ano,
        usuario_id: userId,
      });
      if (movErr) throw movErr;

      // Update origin
      const newOrigemQtd = pasto.num_animais - qtd;
      const origemUpdate: TablesUpdate<"pastos"> = { num_animais: newOrigemQtd };
      if (isFullTransfer) {
        origemUpdate.peso_medio_kg = null;
        origemUpdate.categoria = null;
        origemUpdate.sexo = null;
        origemUpdate.peso_entrada = null;
        origemUpdate.data_entrada = null;
        origemUpdate.dias_no_pasto = 0;
        origemUpdate.data_movimentacao = null;
      }
      const { error: errO } = await supabase.from("pastos")
        .update(origemUpdate)
        .eq("id", pasto.pasto_id);
      if (errO) throw errO;

      // Update destination with weighted average + data_movimentacao
      const newDestinoQtd = selectedDestino.num_animais + qtd;
      const pesoDestino = selectedDestino.peso_medio_kg ?? 0;
      const novoPesoDestino = calcWeightedAvg(selectedDestino.num_animais, pesoDestino, qtd, pesoTransf);

      const destinoUpdate: TablesUpdate<"pastos"> = {
        num_animais: newDestinoQtd,
        peso_medio_kg: Math.round(novoPesoDestino * 10) / 10,
        data_movimentacao: nowIso,
      };
      if (isFullTransfer) {
        if (pasto.categoria) destinoUpdate.categoria = pasto.categoria;
        if (pasto.sexo) destinoUpdate.sexo = pasto.sexo;
      }
      if (destinoSemCategoria) destinoUpdate.categoria = categoriaDestino;

      const { error: errD } = await supabase.from("pastos")
        .update(destinoUpdate)
        .eq("id", selectedDestino.pasto_id);
      if (errD) throw errD;

      // In full transfer, migrate full history to destination pasto
      if (isFullTransfer) {
        await Promise.all([
          supabase.from("eventos_lote").update({ lote_id: selectedDestino.pasto_id }).eq("lote_id", pasto.pasto_id),
          supabase.from("pesagens").update({ lote_id: selectedDestino.pasto_id }).eq("lote_id", pasto.pasto_id),
          supabase.from("eventos_sanitarios").update({ lote_id: selectedDestino.pasto_id }).eq("lote_id", pasto.pasto_id),
        ]);
      }

      toast.success(`${qtd} animais transferidos de ${pasto.pasto_nome} → ${selectedDestino.pasto_nome}`);
      onDone();
      handleClose();
    } catch (err: unknown) {
      console.error("Erro na transferência:", err);
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setConfirmando(false);
    }
  }

  if (!pasto) return null;

  const pesoOrigemDisplay = pasto.peso_medio_kg?.toFixed(1).replace(".", ",") ?? "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🔄 Transferir Animais</DialogTitle>
          <DialogDescription>
            Origem: <strong>{pasto.pasto_nome}</strong> — {pasto.num_animais} animais · {pesoOrigemDisplay} kg
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade (máx: {pasto.num_animais})</Label>
              <Input type="number" inputMode="numeric" min={1} max={pasto.num_animais}
                value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Peso médio dos animais (kg)</Label>
              <Input type="number" inputMode="decimal" step="0.1" min={0}
                value={pesoMedio} onChange={e => setPesoMedio(e.target.value)}
                placeholder={pasto.peso_medio_kg?.toString() || "0"} />
              <p className="text-xs text-muted-foreground">Deixe vazio para usar o peso do lote ({pesoOrigemDisplay} kg)</p>
            </div>

            <div className="space-y-2">
              <Label>Pasto destino</Label>
              {selectedDestino ? (
                <div className="flex items-center justify-between bg-muted rounded-md p-3">
                  <span className="font-medium">{selectedDestino.pasto_nome} ({selectedDestino.num_animais} cab)</span>
                  <Button size="sm" variant="outline" onClick={onSelectDestino}>Trocar</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={onSelectDestino}>
                  Selecionar no mapa
                </Button>
              )}
            </div>

            {destinoSemCategoria && (
              <CategoriaPastoSelect label="Categoria do pasto destino *" value={categoriaDestino} onChange={setCategoriaDestino} />
            )}

            {qtd > 0 && selectedDestino && qtd <= pasto.num_animais && (
              <div className="bg-muted rounded-md p-3 text-sm space-y-1">
                <p><strong>{qtd}</strong> animais → <strong>{selectedDestino.pasto_nome}</strong></p>
                {selectedDestino.num_animais > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Novo peso médio destino: {calcWeightedAvg(selectedDestino.num_animais, selectedDestino.peso_medio_kg ?? 0, qtd, pesoTransf).toFixed(1).replace(".", ",")} kg
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === "confirm" && selectedDestino && (
          <div className="bg-primary/10 border border-primary/30 rounded-md p-4 text-sm space-y-2">
            <p className="font-bold text-primary">
              Transferir {qtd} animais de {pasto.pasto_nome} para {selectedDestino.pasto_nome}?
            </p>
            <p className="text-muted-foreground">Peso médio transferido: {pesoTransf.toFixed(1).replace(".", ",")} kg</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === "input" ? (
            <Button onClick={() => setStep("confirm")} disabled={!isValid}>Avançar</Button>
          ) : (
            <Button onClick={handleConfirm} disabled={confirmando}>
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
