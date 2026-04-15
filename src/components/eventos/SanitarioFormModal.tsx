import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SanitarioFormData {
  categoria: string;
  medicamento: string;
  dose: string;
  lote_completo: boolean;
  quantidade_tratada: number | null;
  tem_carencia: boolean;
  dias_carencia: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimais: number;
  userId: string;
  userName: string;
  /** If provided, only collect data and call onCollected instead of saving */
  collectOnly?: boolean;
  onCollected?: (data: SanitarioFormData) => void;
  onSaved?: () => void;
}

const categorias = [
  { value: "vermifugo", label: "Vermífugo" },
  { value: "vacina", label: "Vacina" },
  { value: "vitamina", label: "Vitamina" },
  { value: "antibiotico", label: "Antibiótico" },
  { value: "outro", label: "Outro" },
];

export default function SanitarioFormModal({ open, onClose, pastoId, pastoNome, numAnimais, userId, userName, collectOnly, onCollected, onSaved }: Props) {
  const [categoria, setCategoria] = useState("vermifugo");
  const [medicamento, setMedicamento] = useState("");
  const [dose, setDose] = useState("");
  const [loteCompleto, setLoteCompleto] = useState(true);
  const [qtdTratada, setQtdTratada] = useState("");
  const [temCarencia, setTemCarencia] = useState(false);
  const [diasCarencia, setDiasCarencia] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = medicamento.trim() && dose.trim() && (!temCarencia || Number(diasCarencia) > 0);

  async function handleSave() {
    const formData: SanitarioFormData = {
      categoria,
      medicamento: medicamento.trim(),
      dose: dose.trim(),
      lote_completo: loteCompleto,
      quantidade_tratada: loteCompleto ? numAnimais : Number(qtdTratada) || 0,
      tem_carencia: temCarencia,
      dias_carencia: temCarencia ? Number(diasCarencia) || 0 : 0,
    };

    if (collectOnly && onCollected) {
      onCollected(formData);
      resetForm();
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const dataFimCarencia = temCarencia && Number(diasCarencia) > 0
        ? new Date(Date.now() + Number(diasCarencia) * 86400000).toISOString().slice(0, 10)
        : null;

      // Insert evento_lote
      const { data: evento, error: evErr } = await (supabase
        .from("eventos_lote") as any)
        .insert({
          lote_id: pastoId,
          tipo: "sanitario",
          usuario_id: userId,
          data_evento: now,
          dados: { ...formData, aplicador: userName },
        })
        .select("id")
        .single();

      if (evErr) throw evErr;

      // Insert evento_sanitario
      const { error: sanErr } = await (supabase
        .from("eventos_sanitarios") as any)
        .insert({
          evento_id: evento.id,
          lote_id: pastoId,
          categoria: formData.categoria,
          medicamento: formData.medicamento,
          dose: formData.dose,
          lote_completo: formData.lote_completo,
          quantidade_tratada: formData.quantidade_tratada,
          tem_carencia: formData.tem_carencia,
          dias_carencia: formData.dias_carencia,
          data_fim_carencia: dataFimCarencia,
          aplicador_id: userId,
          data_aplicacao: now,
        });

      if (sanErr) throw sanErr;

      // Update pasto
      const updateData: any = { ultimo_evento_sanitario_id: evento.id };
      if (dataFimCarencia) updateData.data_fim_carencia = dataFimCarencia;
      await supabase.from("pastos").update(updateData).eq("id", pastoId);

      toast.success("Evento sanitário registrado!");
      resetForm();
      onClose();
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setCategoria("vermifugo");
    setMedicamento("");
    setDose("");
    setLoteCompleto(true);
    setQtdTratada("");
    setTemCarencia(false);
    setDiasCarencia("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Controle Sanitário</DialogTitle>
          <DialogDescription>{pastoNome} — {numAnimais} animais</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Medicamento *</Label>
            <Input value={medicamento} onChange={(e) => setMedicamento(e.target.value)} placeholder="Nome do medicamento" />
          </div>

          <div>
            <Label>Dose *</Label>
            <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex: 3ml por animal" />
          </div>

          <div className="flex items-center justify-between">
            <Label>Lote completo?</Label>
            <Switch checked={loteCompleto} onCheckedChange={setLoteCompleto} />
          </div>

          {!loteCompleto && (
            <div>
              <Label>Quantidade tratada</Label>
              <Input type="number" value={qtdTratada} onChange={(e) => setQtdTratada(e.target.value)} min={1} max={numAnimais} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Carência para abate?</Label>
            <Switch checked={temCarencia} onCheckedChange={setTemCarencia} />
          </div>

          {temCarencia && (
            <div>
              <Label>Dias de carência</Label>
              <Input type="number" value={diasCarencia} onChange={(e) => setDiasCarencia(e.target.value)} min={1} />
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Aplicador:</strong> {userName}</p>
            <p><strong>Data/hora:</strong> {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {collectOnly ? "Continuar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
