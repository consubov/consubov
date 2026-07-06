import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PhotoGrid from "./PhotoGrid";
import { cn } from "@/lib/utils";

export interface VisitaPastoRow {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  observacao: string | null;
  ordem: number;
  scores?: { fezes?: number; corporal?: number; bebedouro?: number };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  visitaId: string;
  pasto: VisitaPastoRow | null; // null = new
  proximaLetra: string;
  proximaOrdem: number;
  onSaved: () => void;
  readOnly?: boolean;
}

const PRODUTOS = [
  { value: "mineral", label: "Mineral" },
  { value: "racao", label: "Ração" },
  { value: "proteinado_0.1", label: "Proteinado 0,1%" },
  { value: "proteinado_0.3", label: "Proteinado 0,3%" },
  { value: "proteinado_0.5", label: "Proteinado 0,5%" },
  { value: "proteinado_1", label: "Proteinado 1%" },
  { value: "outro", label: "Outro" },
];

function ScoreSelector({ label, value, onChange, disabled }: { label: string; value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5 mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PastoVisitaModal({ open, onOpenChange, visitaId, pasto, proximaLetra, proximaOrdem, onSaved, readOnly }: Props) {
  const [letra, setLetra] = useState("");
  const [numPasto, setNumPasto] = useState("");
  const [qtdAnimais, setQtdAnimais] = useState("");
  const [tipoProduto, setTipoProduto] = useState("");
  const [percentualPv, setPercentualPv] = useState("");
  const [consumo, setConsumo] = useState("");
  const [obs, setObs] = useState("");
  const [fezes, setFezes] = useState<number | undefined>();
  const [corporal, setCorporal] = useState<number | undefined>();
  const [bebedouro, setBebedouro] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pasto) {
      setLetra(pasto.letra);
      setNumPasto(pasto.num_pasto || "");
      setQtdAnimais(pasto.qtd_animais?.toString() || "");
      setTipoProduto(pasto.tipo_produto || "");
      setPercentualPv(pasto.percentual_pv || "");
      setConsumo(pasto.consumo_kg_dia?.toString() || "");
      setObs(pasto.observacao || "");
      setFezes(pasto.scores?.fezes);
      setCorporal(pasto.scores?.corporal);
      setBebedouro(pasto.scores?.bebedouro);
    } else {
      setLetra(proximaLetra);
      setNumPasto(""); setQtdAnimais(""); setTipoProduto(""); setPercentualPv("");
      setConsumo(""); setObs(""); setFezes(undefined); setCorporal(undefined); setBebedouro(undefined);
    }
  }, [open, pasto, proximaLetra]);

  async function handleSave() {
    if (!letra.trim()) return toast.error("Letra é obrigatória");
    setSaving(true);
    try {
      let pastoId: string;
      const payload = {
        visita_id: visitaId,
        letra: letra.trim().toUpperCase(),
        num_pasto: numPasto.trim() || null,
        qtd_animais: qtdAnimais ? Number(qtdAnimais) : null,
        tipo_produto: tipoProduto || null,
        percentual_pv: percentualPv.trim() || null,
        consumo_kg_dia: consumo ? Number(consumo) : null,
        observacao: obs.trim() || null,
      };
      if (pasto) {
        const { error } = await supabase.from("visita_pastos").update(payload).eq("id", pasto.id);
        if (error) throw error;
        pastoId = pasto.id;
      } else {
        const { data, error } = await supabase.from("visita_pastos")
          .insert({ ...payload, ordem: proximaOrdem })
          .select("id").single();
        if (error) throw error;
        pastoId = data.id;
      }

      // Upsert scores
      const scoreEntries: Array<{ tipo: "fezes" | "corporal" | "bebedouro"; nota?: number }> = [
        { tipo: "fezes", nota: fezes },
        { tipo: "corporal", nota: corporal },
        { tipo: "bebedouro", nota: bebedouro },
      ];
      // delete existing then insert those with values (simplest)
      await supabase.from("avaliacoes_score").delete().eq("visita_pasto_id", pastoId);
      const toInsert = scoreEntries
        .filter(s => s.nota !== undefined)
        .map(s => ({ visita_pasto_id: pastoId, tipo: s.tipo, nota: s.nota! }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("avaliacoes_score").insert(toInsert);
        if (error) throw error;
      }

      toast.success(pasto ? "Pasto atualizado" : "Pasto adicionado");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pasto ? `Pasto ${pasto.letra}` : "Adicionar Pasto"}</DialogTitle>
          <DialogDescription>Registre os dados do pasto e as avaliações.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Letra *</Label>
              <Input value={letra} onChange={e => setLetra(e.target.value)} maxLength={2} disabled={readOnly} />
            </div>
            <div className="col-span-2">
              <Label>Nº Pasto</Label>
              <Input value={numPasto} onChange={e => setNumPasto(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Qtd. Animais</Label>
              <Input type="number" value={qtdAnimais} onChange={e => setQtdAnimais(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>% Peso Vivo</Label>
              <Input value={percentualPv} onChange={e => setPercentualPv(e.target.value)} placeholder="ex: 0,1%" disabled={readOnly} />
            </div>
          </div>
          <div>
            <Label>Tipo de Produto</Label>
            <Select value={tipoProduto} onValueChange={setTipoProduto} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PRODUTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Consumo (kg/dia)</Label>
            <Input type="number" step="any" value={consumo} onChange={e => setConsumo(e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} disabled={readOnly} />
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="text-sm font-semibold text-foreground">Avaliações (1–5)</div>
            <ScoreSelector label="Fezes" value={fezes} onChange={setFezes} disabled={readOnly} />
            <ScoreSelector label="Escore Corporal" value={corporal} onChange={setCorporal} disabled={readOnly} />
            <ScoreSelector label="Bebedouro" value={bebedouro} onChange={setBebedouro} disabled={readOnly} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Fechar" : "Cancelar"}</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
