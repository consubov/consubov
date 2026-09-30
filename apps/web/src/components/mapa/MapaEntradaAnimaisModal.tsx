import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  fazendaId: string;
  retiroId: string;
  mes: number;
  ano: number;
  onDone: () => void;
}

export default function MapaEntradaAnimaisModal({ open, onClose, pasto, fazendaId, retiroId, mes, ano, onDone }: Props) {
  const [origem, setOrigem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [categoria, setCategoria] = useState("");
  useEffect(() => {
    if (open) setCategoria(isCategoriaValida(pasto?.categoria) ? (pasto!.categoria as string) : "");
  }, [open, pasto?.pasto_id]);

  const qtd = parseInt(quantidade);
  const peso = parseFloat(pesoMedio);
  const isValid = origem.trim().length > 0 && qtd > 0 && peso > 0 && !faltaCategoria(qtd, categoria);

  const handleOpen = (o: boolean) => {
    if (!o) {
      setOrigem("");
      setQuantidade("");
      setPesoMedio("");
      setData(new Date().toISOString().slice(0, 10));
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (!pasto) return;
    if (faltaCategoria(qtd, categoria)) { toast.error(MSG_CATEGORIA_OBRIGATORIA); return; }
    if (!isValid) return;
    setSaving(true);
    try {
      // 1. Check ciclo is open
      const { data: ciclo, error: cicloErr } = await supabase
        .from("ciclos")
        .select("id, fechado")
        .eq("fazenda_id", fazendaId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (cicloErr) throw cicloErr;
      if (!ciclo) {
        toast.error("Não há ciclo aberto para este mês. Inicie o mês primeiro.");
        return;
      }
      if (ciclo.fechado) {
        toast.error("O ciclo deste mês já foi fechado.");
        return;
      }

      // 2. Calculate weighted average
      const qtdAtual = pasto.num_animais;
      const pesoAtual = pasto.peso_medio_kg ?? 0;
      const qtdTotal = qtdAtual + qtd;
      const novoPeso = qtdTotal > 0
        ? ((qtdAtual * pesoAtual) + (qtd * peso)) / qtdTotal
        : peso;

      // 3. Update pasto
      const { error: updErr } = await supabase
        .from("pastos")
        .update({
          num_animais: qtdTotal,
          peso_medio_kg: Math.round(novoPeso * 10) / 10,
          categoria,
        })
        .eq("id", pasto.pasto_id);
      if (updErr) throw updErr;

      // 4. Record history in observacoes
      const { error: obsErr } = await supabase
        .from("observacoes")
        .insert({
          fazenda_id: fazendaId,
          retiro_id: retiroId,
          pasto_id: pasto.pasto_id,
          tipo: "entrada",
          descricao: `Entrada de ${qtd} animais (peso médio ${peso} kg) — Origem: ${origem.trim()}`,
          capataz_nome: "Via mapa",
        });
      if (obsErr) throw obsErr;

      toast.success(`✅ ${qtd} animais adicionados ao pasto ${pasto.pasto_nome}`);
      handleOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar entrada");
    } finally {
      setSaving(false);
    }
  };

  if (!pasto) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>➕ Adicionar Animais — {pasto.pasto_nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Origem *</label>
            <Input
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Ex: Compra, Outro retiro, Recria"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Quantidade de animais *</label>
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex: 50"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Peso médio (kg) *</label>
            <Input
              type="number"
              min={1}
              step="0.1"
              value={pesoMedio}
              onChange={(e) => setPesoMedio(e.target.value)}
              placeholder="Ex: 350"
            />
          </div>

          <CategoriaPastoSelect value={categoria} onChange={setCategoria} />

          <div>
            <label className="text-sm font-medium mb-1 block">Data da movimentação</label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {pasto.num_animais > 0 && qtd > 0 && peso > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              Novo total: {pasto.num_animais + qtd} animais · Peso médio:{" "}
              {(((pasto.num_animais * (pasto.peso_medio_kg ?? 0)) + (qtd * peso)) / (pasto.num_animais + qtd)).toFixed(1).replace(".", ",")} kg
            </p>
          )}

          <Button onClick={handleConfirm} className="w-full" disabled={saving || !isValid}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
