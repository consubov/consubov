import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { faltaCategoria, isCategoriaValida, MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";
import CategoriaPastoSelect from "@/components/pastos/CategoriaPastoSelect";

interface TransferenciaModalProps {
  open: boolean;
  onClose: () => void;
  pasto: { id: string; nome: string; num_animais: number; categoria?: string | null } | null;
  pastos: { id: string; nome: string; num_animais: number; categoria?: string | null }[];
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
  const [categoriaDestino, setCategoriaDestino] = useState("");

  const qtd = parseInt(quantidade) || 0;
  const isValid = qtd > 0 && pasto && qtd <= pasto.num_animais && destinoId && destinoId !== pasto.id;
  const destino = pastos.find(p => p.id === destinoId);
  const destinoSemCategoria = !!destino && !isCategoriaValida(destino.categoria);
  const categoriaOk = !destinoSemCategoria || isCategoriaValida(categoriaDestino);
  function escolherDestino(id: string) {
    setDestinoId(id);
    setCategoriaDestino(isCategoriaValida(pasto?.categoria) ? (pasto!.categoria as string) : "");
  }
  const destinosDisponiveis = pastos.filter(p => pasto && p.id !== pasto.id);

  function handleClose() {
    setQuantidade("");
    setDestinoId("");
    setStep('input');
    setConfirmando(false);
    onClose();
  }

  async function handleConfirm() {
    if (!pasto || !destino) return;
    if (!categoriaOk) { toast.error(MSG_CATEGORIA_OBRIGATORIA); return; }
    if (!isValid) return;
    setConfirmando(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const nowIso = new Date().toISOString();

      // 1. Fetch full origin pasto data (needed for movimentacao + lote transfer)
      const { data: origemData } = await supabase.from("pastos")
        .select("peso_medio_kg, categoria, sexo, peso_entrada, data_entrada, gmd_kg_dia, dias_no_pasto, produto_id, peso_abate_meta_kg")
        .eq("id", pasto.id)
        .maybeSingle();

      const isFullTransfer = qtd === pasto.num_animais;

      // 2. Record transfer event (with peso_medio + categoria)
      const { error: movErr } = await supabase.from("movimentacoes_animais" as any).insert({
        fazenda_id: fazendaId,
        retiro_id: retiroId,
        pasto_origem_id: pasto.id,
        pasto_destino_id: destinoId,
        quantidade: qtd,
        peso_medio: origemData?.peso_medio_kg ?? null,
        categoria: origemData?.categoria ?? null,
        mes: mesOperacional,
        ano: anoOperacional,
        usuario_id: userId,
      });
      if (movErr) throw movErr;

      // 3. Update origin pasto
      const origemUpdate: Record<string, any> = { num_animais: pasto.num_animais - qtd };
      if (isFullTransfer) {
        // Clear lote data from origin when all animals leave
        origemUpdate.peso_medio_kg = null;
        origemUpdate.categoria = null;
        origemUpdate.sexo = null;
        origemUpdate.peso_entrada = null;
        origemUpdate.data_entrada = null;
        origemUpdate.dias_no_pasto = 0;
        origemUpdate.data_movimentacao = null;
      }
      const { error: errOrigem } = await supabase.from("pastos")
        .update(origemUpdate)
        .eq("id", pasto.id);
      if (errOrigem) throw errOrigem;

      // 4. Update destination pasto with lote data + data_movimentacao
      const destinoUpdate: Record<string, any> = {
        num_animais: destino.num_animais + qtd,
        data_movimentacao: nowIso,
      };
      if (origemData) {
        // Transfer lote metadata to destination
        if (origemData.peso_medio_kg != null) destinoUpdate.peso_medio_kg = origemData.peso_medio_kg;
        if (origemData.categoria) destinoUpdate.categoria = origemData.categoria;
        if (origemData.sexo) destinoUpdate.sexo = origemData.sexo;
        if (isFullTransfer) {
          if (origemData.peso_entrada != null) destinoUpdate.peso_entrada = origemData.peso_entrada;
          if (origemData.data_entrada) destinoUpdate.data_entrada = origemData.data_entrada;
          if (origemData.gmd_kg_dia != null) destinoUpdate.gmd_kg_dia = origemData.gmd_kg_dia;
          if (origemData.dias_no_pasto != null) destinoUpdate.dias_no_pasto = origemData.dias_no_pasto;
          if (origemData.produto_id) destinoUpdate.produto_id = origemData.produto_id;
          if (origemData.peso_abate_meta_kg != null) destinoUpdate.peso_abate_meta_kg = origemData.peso_abate_meta_kg;
        }
      }
      if (destinoSemCategoria) destinoUpdate.categoria = categoriaDestino;
      const { error: errDestino } = await supabase.from("pastos")
        .update(destinoUpdate)
        .eq("id", destinoId);
      if (errDestino) throw errDestino;

      // 5. In full transfer, migrate full history to destination pasto
      if (isFullTransfer) {
        await Promise.all([
          supabase.from("eventos_lote").update({ lote_id: destinoId }).eq("lote_id", pasto.id),
          supabase.from("pesagens").update({ lote_id: destinoId }).eq("lote_id", pasto.id),
          supabase.from("eventos_sanitarios").update({ lote_id: destinoId }).eq("lote_id", pasto.id),
        ]);
      }

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
              <Select value={destinoId} onValueChange={escolherDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione o pasto" /></SelectTrigger>
                <SelectContent>
                  {destinosDisponiveis.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.num_animais} animais)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {destinoSemCategoria && (
              <CategoriaPastoSelect label="Categoria do pasto destino *" value={categoriaDestino} onChange={setCategoriaDestino} />
            )}
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
            <Button onClick={() => setStep('confirm')} disabled={!isValid || !categoriaOk}>
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
