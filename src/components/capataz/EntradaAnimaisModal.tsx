import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchFazendaIdDoRetiro, fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";

interface Produto {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  retiroId: string;
  onPastoUpdated: () => void;
}

export default function EntradaAnimaisModal({ open, onClose, pastoId, pastoNome, retiroId, onPastoUpdated }: Props) {
  const [quantidade, setQuantidade] = useState("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantidade("");
    setPesoMedio("");
    setProdutoId("");
    setLoading(true);

    (async () => {
      const fazendaId = await fetchFazendaIdDoRetiro(retiroId);
      const produtoIds = await fetchProdutoIdsDaFazenda(fazendaId);
      let query = supabase.from("produtos").select("id, nome").eq("ativo", true);
      if (produtoIds) query = query.in("id", produtoIds);
      const { data } = await query;
      const list = data ?? [];
      setProdutos(list);
      if (list.length === 1) setProdutoId(list[0].id);
      setLoading(false);
    })();
  }, [open, retiroId]);

  const isValid = parseInt(quantidade) > 0 && parseFloat(pesoMedio) > 0 && produtoId;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pastos")
        .update({
          num_animais: parseInt(quantidade),
          peso_medio_kg: parseFloat(pesoMedio),
          produto_id: produtoId,
        })
        .eq("id", pastoId);
      if (error) throw error;

      toast.success("✅ Animais adicionados ao pasto");
      onPastoUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>➕ Adicionar Animais — {pastoNome}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Quantidade de animais *</label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 200"
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

            <div>
              <label className="text-sm font-medium mb-1 block">Produto *</label>
              {produtos.length === 0 ? (
                <>
                  <Input value="Nenhum produto" disabled />
                  <p className="text-xs text-amber-700 mt-1">{MSG_FAZENDA_SEM_PRODUTO}</p>
                </>
              ) : produtos.length === 1 ? (
                <Input value={produtos[0].nome} disabled />
              ) : (
                <Select value={produtoId} onValueChange={setProdutoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving || !isValid}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Entrada"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
