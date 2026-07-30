import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { hasPendingLocalChanges, loadSnapshot, offlineDelete, offlineUpdate, offlineUpsert } from "@/lib/consultorOffline/snapshotStore";
import { useAuth } from "@/hooks/useAuth";
import { DIETA_CATEGORIAS_FIXAS, useDietaCategorias } from "@/hooks/useDietaCategorias";

const OUTROS_VALUE = "__outros__";

export interface VisitaCurralRow {
  id: string;
  num_curral: string;
  organizacao_fabrica_nota: number | null;
  organizacao_insumos_nota: number | null;
  ordem: number;
  dieta_categoria?: string | null;
  scores?: { fezes?: number; corporal?: number; bebedouro?: number }; // averages (legacy shape)
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

type SamplesState = { fezes: ScoreSample[]; corporal: ScoreSample[]; bebedouro: ScoreSample[] };
const EMPTY_SAMPLES: SamplesState = { fezes: [], corporal: [], bebedouro: [] };

export default function CurralVisitaModal({
  open, onOpenChange, visitaId, curral, proximaOrdem, onSaved, readOnly,
}: Props) {
  const { roleData } = useAuth();
  const consultorId = roleData?.consultorId ?? null;
  const { categorias, criar } = useDietaCategorias(consultorId);
  const [numCurral, setNumCurral] = useState("");
  const [curralIdLocal, setCurralIdLocal] = useState<string | null>(null);
  const [samples, setSamples] = useState<SamplesState>(EMPTY_SAMPLES);
  const [dietaCategoria, setDietaCategoria] = useState<string>("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!open) return;
    setMostrarNovaCategoria(false);
    setNovaCategoria("");
    if (curral) {
      setCurralIdLocal(curral.id);
      setNumCurral(curral.num_curral);
      setDietaCategoria(curral.dieta_categoria || "");

      // load samples
      const online = typeof navigator === "undefined" || navigator.onLine;
      const source = (async () => {
        const snap = await loadSnapshot(visitaId);
        const snapCurral = (snap?.currais || []).find((c: any) => c.id === curral.id) as any;
        if (snapCurral?.samples && await hasPendingLocalChanges(visitaId)) return { data: [], snap, snapCurral };
        if (!online) return { data: [], snap, snapCurral };
        return supabase.from("avaliacoes_score")
          .select("id, tipo, nota")
          .eq("visita_curral_id", curral.id)
          .then((res) => ({ ...res, snap, snapCurral }));
      })();
      source.then(async ({ data, snap, snapCurral }) => {
          const next: SamplesState = { fezes: [], corporal: [], bebedouro: [] };
          let rows = (data as any[]) || [];
          if (rows.length === 0) {
            if (snapCurral?.samples) {
              setSamples({
                fezes: snapCurral.samples.fezes || [],
                corporal: snapCurral.samples.corporal || [],
                bebedouro: snapCurral.samples.bebedouro || [],
              });
              return;
            }
            rows = ((snap?.avaliacoes_score as any[]) || []).filter((s: any) => s.visita_curral_id === curral.id);
          }
          rows.forEach((s: any) => {
            if (s.tipo in next) next[s.tipo as keyof SamplesState].push({ id: s.id, nota: s.nota });
          });
          setSamples(next);
        });
    } else {
      setCurralIdLocal(null);
      setNumCurral("");
      setSamples(EMPTY_SAMPLES);
    }
  }, [open, curral]);

  const ensureCurral = useCallback(async (): Promise<string | null> => {
    if (curralIdLocal) return curralIdLocal;
    if (!numCurral.trim()) return null;
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const payload = { visita_id: visitaId, num_curral: numCurral.trim(), ordem: proximaOrdem };
      const res = await offlineUpsert({
        visitaId,
        table: "visita_currais",
        rowId: id,
        payload,
        applyToSnapshot: (curr, p) => ({
          ...curr,
          currais: [...(curr.currais || []), { id, ...p, fotos: [], signed: {}, samples: { fezes: [], corporal: [], bebedouro: [] } }],
        }),
      });
      if (res.queued) toast.info("Curral salvo off-line.");
      setCurralIdLocal(id);
      return id;
    } catch (err: any) {
      toast.error("Erro ao criar curral: " + (err?.message || ""));
      return null;
    } finally {
      setCreating(false);
    }
  }, [curralIdLocal, numCurral, visitaId, proximaOrdem]);

  async function handleNumBlur() {
    if (readOnly) return;
    if (!curralIdLocal && numCurral.trim()) {
      await ensureCurral();
    } else if (curralIdLocal && numCurral.trim() && curral && numCurral.trim() !== curral.num_curral) {
      await offlineUpdate({
        visitaId,
        table: "visita_currais",
        rowId: curralIdLocal,
        patch: { num_curral: numCurral.trim() },
        applyToSnapshot: (curr, patch) => ({
          ...curr,
          currais: (curr.currais || []).map((c: any) => c.id === curralIdLocal ? { ...c, ...patch } : c),
        }),
      });
    }
  }

  async function addSample(tipo: keyof SamplesState, nota: number) {
    const id = await ensureCurral();
    if (!id) { toast.error("Informe o número do curral primeiro"); return; }
    const scoreId = crypto.randomUUID();
    setSamples(prev => ({ ...prev, [tipo]: [...prev[tipo], { id: scoreId, nota }] }));
    const res = await offlineUpsert({
      visitaId,
      table: "avaliacoes_score",
      rowId: scoreId,
      payload: { visita_curral_id: id, tipo, nota },
      applyToSnapshot: (curr, payload) => ({
        ...curr,
        avaliacoes_score: [...(curr.avaliacoes_score || []), { id: scoreId, ...payload }],
        currais: (curr.currais || []).map((c: any) => c.id === id
          ? { ...c, samples: { ...(c.samples || EMPTY_SAMPLES), [tipo]: [...((c.samples || EMPTY_SAMPLES)[tipo] || []), { id: scoreId, nota }] } }
          : c),
      }),
    });
    if (res.queued) toast.info("Amostra salva off-line.");
  }

  async function removeSample(tipo: keyof SamplesState, index: number) {
    const s = samples[tipo][index];
    if (!s?.id) return;
    await offlineDelete({
      visitaId,
      table: "avaliacoes_score",
      rowId: s.id,
      applyToSnapshot: (curr) => ({
        ...curr,
        avaliacoes_score: ((curr.avaliacoes_score as any[]) || []).filter((x: any) => x.id !== s.id),
        currais: (curr.currais || []).map((c: any) => c.id === (curralIdLocal || curral?.id)
          ? { ...c, samples: { ...(c.samples || EMPTY_SAMPLES), [tipo]: ((c.samples || EMPTY_SAMPLES)[tipo] || []).filter((x: any) => x.id !== s.id) } }
          : c),
      }),
    });
    setSamples(prev => ({ ...prev, [tipo]: prev[tipo].filter((_, i) => i !== index) }));
  }

  async function persist(continueSequential: boolean) {
    if (!numCurral.trim()) return toast.error("Número do curral é obrigatório");
    setSaving(true);
    try {
      const id = await ensureCurral();
      if (!id) return;
      // ensure num_curral persisted
      const res = await offlineUpdate({
        visitaId,
        table: "visita_currais",
        rowId: id,
        patch: { num_curral: numCurral.trim() },
        applyToSnapshot: (curr, patch) => ({
          ...curr,
          currais: (curr.currais || []).map((c: any) => c.id === id ? { ...c, ...patch } : c),
        }),
      });
      if (res.queued) toast.info("Curral salvo off-line.");
      toast.success(curral || curralIdLocal ? "Curral salvo" : "Curral adicionado");
      onSaved({ continueSequential });
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  const isNew = !curral;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{curral ? `Curral ${curral.num_curral}` : "Adicionar Curral"}</DialogTitle>
          <DialogDescription>Informe o número do curral e registre as amostras.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Número do Curral *</Label>
            <div className="relative">
              <Input
                value={numCurral}
                onChange={e => setNumCurral(e.target.value)}
                onBlur={handleNumBlur}
                disabled={readOnly}
                placeholder="ex: 12"
                autoFocus={isNew}
              />
              {creating && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="pt-2 border-t space-y-4">
            <div className="text-sm font-semibold text-foreground">Avaliações (1–5) — múltiplas amostras</div>
            <ScoreSamplesInput
              label="Fezes"
              samples={samples.fezes}
              onAdd={n => addSample("fezes", n)}
              onRemove={i => removeSample("fezes", i)}
              disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Escore Corporal"
              samples={samples.corporal}
              onAdd={n => addSample("corporal", n)}
              onRemove={i => removeSample("corporal", i)}
              disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Bebedouro"
              samples={samples.bebedouro}
              onAdd={n => addSample("bebedouro", n)}
              onRemove={i => removeSample("bebedouro", i)}
              disabled={readOnly}
            />
          </div>

          <div className="pt-2 border-t">
            <PhotoGrid visitaId={visitaId} visitaCurralId={curralIdLocal} max={10} disabled={readOnly} />
            {!curralIdLocal && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Informe o número do curral para habilitar o envio de fotos.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {readOnly ? "Fechar" : "Fechar"}
          </Button>
          {!readOnly && (
            <>
              <Button
                variant="secondary"
                onClick={() => persist(false)}
                disabled={saving || !numCurral.trim()}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
              {isNew && (
                <Button
                  onClick={() => persist(true)}
                  disabled={saving || !numCurral.trim()}
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
