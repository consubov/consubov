import { useState, useEffect, useCallback } from "react";
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
import ScoreSamplesInput, { ScoreSample } from "./ScoreSamplesInput";

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
  scores?: { fezes?: number; corporal?: number; bebedouro?: number }; // averages
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  visitaId: string;
  pasto: VisitaPastoRow | null;
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

type SamplesState = { fezes: ScoreSample[]; corporal: ScoreSample[]; bebedouro: ScoreSample[] };
const EMPTY_SAMPLES: SamplesState = { fezes: [], corporal: [], bebedouro: [] };

export default function PastoVisitaModal({
  open, onOpenChange, visitaId, pasto, proximaLetra, proximaOrdem, onSaved, readOnly,
}: Props) {
  const [pastoIdLocal, setPastoIdLocal] = useState<string | null>(null);
  const [letra, setLetra] = useState("");
  const [numPasto, setNumPasto] = useState("");
  const [qtdAnimais, setQtdAnimais] = useState("");
  const [tipoProduto, setTipoProduto] = useState("");
  const [percentualPv, setPercentualPv] = useState("");
  const [consumo, setConsumo] = useState("");
  const [obs, setObs] = useState("");
  const [samples, setSamples] = useState<SamplesState>(EMPTY_SAMPLES);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pasto) {
      setPastoIdLocal(pasto.id);
      setLetra(pasto.letra);
      setNumPasto(pasto.num_pasto || "");
      setQtdAnimais(pasto.qtd_animais?.toString() || "");
      setTipoProduto(pasto.tipo_produto || "");
      setPercentualPv(pasto.percentual_pv || "");
      setConsumo(pasto.consumo_kg_dia?.toString() || "");
      setObs(pasto.observacao || "");
      supabase.from("avaliacoes_score")
        .select("id, tipo, nota")
        .eq("visita_pasto_id", pasto.id)
        .then(({ data }) => {
          const next: SamplesState = { fezes: [], corporal: [], bebedouro: [] };
          (data || []).forEach((s: any) => {
            if (s.tipo in next) next[s.tipo as keyof SamplesState].push({ id: s.id, nota: s.nota });
          });
          setSamples(next);
        });
    } else {
      setPastoIdLocal(null);
      setLetra(proximaLetra);
      setNumPasto(""); setQtdAnimais(""); setTipoProduto(""); setPercentualPv("");
      setConsumo(""); setObs(""); setSamples(EMPTY_SAMPLES);
    }
  }, [open, pasto, proximaLetra]);

  const ensurePasto = useCallback(async (): Promise<string | null> => {
    if (pastoIdLocal) return pastoIdLocal;
    if (!letra.trim()) return null;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("visita_pastos")
        .insert({
          visita_id: visitaId,
          letra: letra.trim().toUpperCase(),
          ordem: proximaOrdem,
        })
        .select("id").single();
      if (error) throw error;
      setPastoIdLocal(data.id);
      return data.id;
    } catch (err: any) {
      toast.error("Erro ao criar pasto: " + (err?.message || ""));
      return null;
    } finally {
      setCreating(false);
    }
  }, [pastoIdLocal, letra, visitaId, proximaOrdem]);

  async function handleLetraBlur() {
    if (readOnly) return;
    if (!pastoIdLocal && letra.trim()) {
      await ensurePasto();
    } else if (pastoIdLocal && letra.trim()) {
      await supabase.from("visita_pastos").update({ letra: letra.trim().toUpperCase() }).eq("id", pastoIdLocal);
    }
  }

  async function addSample(tipo: keyof SamplesState, nota: number) {
    const id = await ensurePasto();
    if (!id) { toast.error("Informe a letra do pasto primeiro"); return; }
    const { data, error } = await supabase.from("avaliacoes_score")
      .insert({ visita_pasto_id: id, tipo, nota }).select("id").single();
    if (error) { toast.error("Erro: " + error.message); return; }
    setSamples(prev => ({ ...prev, [tipo]: [...prev[tipo], { id: data.id, nota }] }));
  }

  async function removeSample(tipo: keyof SamplesState, index: number) {
    const s = samples[tipo][index];
    if (!s?.id) return;
    await supabase.from("avaliacoes_score").delete().eq("id", s.id);
    setSamples(prev => ({ ...prev, [tipo]: prev[tipo].filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!letra.trim()) return toast.error("Letra é obrigatória");
    setSaving(true);
    try {
      const id = await ensurePasto();
      if (!id) return;
      const payload = {
        letra: letra.trim().toUpperCase(),
        num_pasto: numPasto.trim() || null,
        qtd_animais: qtdAnimais ? Number(qtdAnimais) : null,
        tipo_produto: tipoProduto || null,
        percentual_pv: percentualPv.trim() || null,
        consumo_kg_dia: consumo ? Number(consumo) : null,
        observacao: obs.trim() || null,
      };
      const { error } = await supabase.from("visita_pastos").update(payload).eq("id", id);
      if (error) throw error;
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
              <div className="relative">
                <Input
                  value={letra}
                  onChange={e => setLetra(e.target.value)}
                  onBlur={handleLetraBlur}
                  maxLength={2}
                  disabled={readOnly}
                  autoFocus={!pasto}
                />
                {creating && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
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

          <div className="pt-2 border-t space-y-4">
            <div className="text-sm font-semibold text-foreground">Avaliações (1–5) — múltiplas amostras</div>
            <ScoreSamplesInput
              label="Fezes" samples={samples.fezes}
              onAdd={n => addSample("fezes", n)} onRemove={i => removeSample("fezes", i)} disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Escore Corporal" samples={samples.corporal}
              onAdd={n => addSample("corporal", n)} onRemove={i => removeSample("corporal", i)} disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Bebedouro" samples={samples.bebedouro}
              onAdd={n => addSample("bebedouro", n)} onRemove={i => removeSample("bebedouro", i)} disabled={readOnly}
            />
          </div>

          <div className="pt-2 border-t">
            <PhotoGrid visitaPastoId={pastoIdLocal} disabled={readOnly} />
            {!pastoIdLocal && (
              <p className="text-[11px] text-muted-foreground mt-1">Informe a letra do pasto para habilitar o envio de fotos.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Fechar" : "Fechar"}</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving || !letra.trim()} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
