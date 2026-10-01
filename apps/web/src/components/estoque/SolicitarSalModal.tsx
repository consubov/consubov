import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SolicitarSalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meuRetiroId: string;
  outrosRetiros: { id: string; nome: string }[];
  onSuccess: () => void;
}

export default function SolicitarSalModal({ open, onOpenChange, meuRetiroId, outrosRetiros, onSuccess }: SolicitarSalModalProps) {
  const [tab, setTab] = useState<string>("solicitar");
  const [retiroId, setRetiroId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    const qtd = parseInt(quantidade);
    if (!retiroId || isNaN(qtd) || qtd <= 0) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (tab === "solicitar") {
        // Solicitar: eu sou destino, retiro selecionado é origem
        await supabase.from("transferencias_estoque").insert({
          retiro_origem_id: retiroId,
          retiro_destino_id: meuRetiroId,
          quantidade: qtd,
          tipo_acao: 'solicitacao',
          solicitado_por: user?.id,
        });
        toast.success(`Solicitação de ${qtd} sacos enviada`);
      } else {
        // Enviar: eu sou origem, retiro selecionado é destino
        await supabase.from("transferencias_estoque").insert({
          retiro_origem_id: meuRetiroId,
          retiro_destino_id: retiroId,
          quantidade: qtd,
          tipo_acao: 'envio',
          solicitado_por: user?.id,
        });
        toast.success(`Envio de ${qtd} sacos registrado`);
      }

      setRetiroId("");
      setQuantidade("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar transferência");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>📦 Solicitar / Enviar Sal</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="solicitar">Solicitar Sal</TabsTrigger>
            <TabsTrigger value="enviar">Enviar Sal</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitar" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Solicitar sal de outro retiro para o seu.</p>
            <div>
              <Label>Retiro de origem</Label>
              <Select value={retiroId} onValueChange={setRetiroId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {outrosRetiros.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade (sacos)</Label>
              <Input type="number" inputMode="numeric" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
          </TabsContent>

          <TabsContent value="enviar" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Enviar sal do seu retiro para outro.</p>
            <div>
              <Label>Retiro de destino</Label>
              <Select value={retiroId} onValueChange={setRetiroId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {outrosRetiros.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade (sacos)</Label>
              <Input type="number" inputMode="numeric" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !retiroId || !quantidade || parseInt(quantidade) <= 0}>
            {saving ? "Enviando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
