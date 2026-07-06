import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PhotoGrid from "./PhotoGrid";

export interface VisitaCurralRow {
  id: string;
  num_curral: string;
  organizacao_fabrica_nota: number | null;
  organizacao_insumos_nota: number | null;
  ordem: number;
  scores?: { fezes?: number; corporal?: number; bebedouro?: number };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  visitaId: string;
  curral: VisitaCurralRow | null; // null = new
  proximaOrdem: number;
  onSaved: (opts: { continueSequential: boolean }) => void;
  readOnly?: boolean;
}

function ScoreSelector({
  label, value, onChange, disabled,
}: { label: string; value?: number | null; onChange: (v: number) => void; disabled?: boolean }) {
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

export default function CurralVisitaModal({
  open, onOpenChange, visitaId, curral, proximaOrdem, onSaved, readOnly,
}: Props) {
  const [numCurral, setNumCurral] = useState("");
  const [fezes, setFezes] = useState<number | undefined>();
  const [corporal, setCorporal] = useState<number | undefined>();
  const [bebedouro, setBebedouro] = useState<number | undefined>();
  const [orgFabrica, setOrgFabrica] = useState<number | undefined>();
  const [orgInsumos, setOrgInsumos] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (curral) {
      setNumCurral(curral.num_curral);
      setFezes(curral.scores?.fezes);
      setCorporal(curral.scores?.corporal);
      setBebedouro(curral.scores?.bebedouro);
      setOrgFabrica(curral.organizacao_fabrica_nota ?? undefined);
      setOrgInsumos(curral.organizacao_insumos_nota ?? undefined);
    } else {
      setNumCurral("");
      setFezes(undefined); setCorporal(undefined); setBebedouro(undefined);
      setOrgFabrica(undefined); setOrgInsumos(undefined);
    }
  }, [open, curral]);

  async function persist(continueSequential: boolean) {
    if (!numCurral.trim()) return toast.error("Número do curral é obrigatório");
    setSaving(true);
    try {
      let curralId: string;
      const payload = {
        visita_id: visitaId,
        num_curral: numCurral.trim(),
        organizacao_fabrica_nota: orgFabrica ?? null,
        organizacao_insumos_nota: orgInsumos ?? null,
      };
      if (curral) {
        const { error } = await supabase.from("visita_currais").update(payload).eq("id", curral.id);
        if (error) throw error;
        curralId = curral.id;
      } else {
        const { data, error } = await supabase.from("visita_currais")
          .insert({ ...payload, ordem: proximaOrdem })
          .select("id").single();
        if (error) throw error;
        curralId = data.id;
      }

      // Upsert scores (delete + insert)
      await supabase.from("avaliacoes_score").delete().eq("visita_curral_id", curralId);
      const scoreEntries: Array<{ tipo: "fezes" | "corporal" | "bebedouro"; nota?: number }> = [
        { tipo: "fezes", nota: fezes },
        { tipo: "corporal", nota: corporal },
        { tipo: "bebedouro", nota: bebedouro },
      ];
      const toInsert = scoreEntries
        .filter(s => s.nota !== undefined)
        .map(s => ({ visita_curral_id: curralId, tipo: s.tipo, nota: s.nota! }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("avaliacoes_score").insert(toInsert);
        if (error) throw error;
      }

      toast.success(curral ? "Curral atualizado" : "Curral adicionado");
      onSaved({ continueSequential });
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{curral ? `Curral ${curral.num_curral}` : "Adicionar Curral"}</DialogTitle>
          <DialogDescription>Informe o número do curral e as avaliações.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Número do Curral *</Label>
            <Input
              value={numCurral}
              onChange={e => setNumCurral(e.target.value)}
              disabled={readOnly}
              placeholder="ex: 12"
              autoFocus={!curral}
            />
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="text-sm font-semibold text-foreground">Avaliações (1–5)</div>
            <ScoreSelector label="Fezes" value={fezes} onChange={setFezes} disabled={readOnly} />
            <ScoreSelector label="Escore Corporal" value={corporal} onChange={setCorporal} disabled={readOnly} />
            <ScoreSelector label="Bebedouro" value={bebedouro} onChange={setBebedouro} disabled={readOnly} />
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="text-sm font-semibold text-foreground">Organização (1–5)</div>
            <ScoreSelector label="Organização de Fábrica" value={orgFabrica} onChange={setOrgFabrica} disabled={readOnly} />
            <ScoreSelector label="Organização de Insumos" value={orgInsumos} onChange={setOrgInsumos} disabled={readOnly} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <>
              <Button
                variant="secondary"
                onClick={() => persist(false)}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
              {!curral && (
                <Button
                  onClick={() => persist(true)}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar e próximo
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
