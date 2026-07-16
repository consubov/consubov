import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Loader2, Clock, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import CurralVisitaModal, { type VisitaCurralRow } from "@/components/consultor/CurralVisitaModal";
import { averageOf, formatAvg } from "@/components/consultor/ScoreSamplesInput";
import { loadSnapshot, offlineUpdate, offlineUpsert, saveSnapshot } from "@/lib/consultorOffline/snapshotStore";

interface Visita {
  id: string;
  tipo: string;
  status: string;
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  fazenda_consultor_id: string;
}
interface Fazenda { id: string; nome_fazenda: string; proprietario?: string | null; responsavel?: string | null; municipio?: string | null; uf?: string | null; }

interface CurralComAmostras extends VisitaCurralRow {
  samples: { fezes: number[]; corporal: number[]; bebedouro: number[] };
}

interface Props { visitaId: string; visita: Visita; fazenda: Fazenda | null; }

export default function ConfinamentoVisitaView({ visitaId, visita: initialVisita, fazenda }: Props) {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita>(initialVisita);
  const [currais, setCurrais] = useState<CurralComAmostras[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VisitaCurralRow | null>(null);
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [obsGerais, setObsGerais] = useState(initialVisita.observacoes_gerais || "");
  const [conclusao, setConclusao] = useState(initialVisita.conclusao || "");
  const [finalizando, setFinalizando] = useState(false);

  // Avaliação da fábrica (por visita)
  const [fabricaNota, setFabricaNota] = useState<number | null>(null);
  const [insumosNota, setInsumosNota] = useState<number | null>(null);

  const readOnly = false;

  useEffect(() => { load(); }, [visitaId]);

  const load = useCallback(async () => {
    setLoading(true);
    const snap = await loadSnapshot(visitaId);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const cRes = online
      ? await supabase.from("visita_currais").select("*").eq("visita_id", visitaId).order("ordem")
      : { data: null };
    let curraisData = (cRes.data as any[]) || [];
    if (curraisData.length === 0 && snap?.currais?.length) curraisData = snap.currais as any[];
    const ids = curraisData.map(c => c.id);
    const samplesByCurral: Record<string, { fezes: number[]; corporal: number[]; bebedouro: number[] }> = {};
    if (ids.length > 0 && online) {
      const { data: scoresData } = await supabase.from("avaliacoes_score")
        .select("visita_curral_id, tipo, nota")
        .in("visita_curral_id", ids);
      (scoresData || []).forEach((s: any) => {
        const bucket = samplesByCurral[s.visita_curral_id] ??= { fezes: [], corporal: [], bebedouro: [] };
        if (s.tipo in bucket) bucket[s.tipo as "fezes" | "corporal" | "bebedouro"].push(s.nota);
      });
    }
    const built = curraisData.map(c => {
      const snapSamples = (c as any).samples || {};
      const samples = samplesByCurral[c.id] || {
        fezes: (snapSamples.fezes || []).map((s: any) => s.nota ?? s),
        corporal: (snapSamples.corporal || []).map((s: any) => s.nota ?? s),
        bebedouro: (snapSamples.bebedouro || []).map((s: any) => s.nota ?? s),
      };
      return {
        ...c,
        samples,
        scores: {
          fezes: averageOf(samples.fezes),
          corporal: averageOf(samples.corporal),
          bebedouro: averageOf(samples.bebedouro),
        },
      };
    });
    setCurrais(built);

    // load avaliacao fabrica
    const { data: af } = online
      ? await (supabase as any).from("avaliacao_fabrica_visita")
          .select("id, organizacao_fabrica_nota, organizacao_insumos_nota")
          .eq("visita_id", visitaId).maybeSingle()
      : { data: null };
    const afRow = af || snap?.avaliacao_fabrica_visita || null;
    setFabricaNota(afRow?.organizacao_fabrica_nota ?? null);
    setInsumosNota(afRow?.organizacao_insumos_nota ?? null);

    // refresh visita
    const vRes = online
      ? await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId).maybeSingle()
      : { data: null };
    if (vRes.data) {
      const v = vRes.data as Visita;
      setVisita(v);
      setObsGerais(v.observacoes_gerais || "");
      setConclusao(v.conclusao || "");
    }
    void saveSnapshot(visitaId, {
      ...(snap || {}),
      visita: vRes.data || snap?.visita || visita,
      fazenda: fazenda || snap?.fazenda,
      currais: built,
      avaliacao_fabrica_visita: afRow,
    }).catch(() => {});
    setLoading(false);
  }, [visitaId, fazenda, visita]);

  const nextOrdem = useMemo(
    () => (currais.length > 0 ? Math.max(...currais.map(c => c.ordem)) + 1 : 0),
    [currais],
  );

  async function upsertFabrica(patch: { organizacao_fabrica_nota?: number | null; organizacao_insumos_nota?: number | null }) {
    const next = {
      organizacao_fabrica_nota: patch.organizacao_fabrica_nota !== undefined ? patch.organizacao_fabrica_nota : fabricaNota,
      organizacao_insumos_nota: patch.organizacao_insumos_nota !== undefined ? patch.organizacao_insumos_nota : insumosNota,
    };
    if (patch.organizacao_fabrica_nota !== undefined) setFabricaNota(patch.organizacao_fabrica_nota);
    if (patch.organizacao_insumos_nota !== undefined) setInsumosNota(patch.organizacao_insumos_nota);
    const rowId = (await loadSnapshot(visitaId))?.avaliacao_fabrica_visita?.id || crypto.randomUUID();
    const res = await offlineUpsert({
      visitaId,
      table: "avaliacao_fabrica_visita",
      rowId,
      payload: { visita_id: visitaId, ...next },
      onConflict: "visita_id",
      applyToSnapshot: (curr, payload) => ({ ...curr, avaliacao_fabrica_visita: { id: rowId, ...payload } }),
    });
    if (!res.ok && !res.queued) toast.error("Erro ao salvar avaliação da fábrica");
  }

  function openNew() { setEditing(null); setModalOpen(true); }

  async function handleSavedFromModal({ continueSequential }: { continueSequential: boolean }) {
    setModalOpen(false);
    await load();
    if (continueSequential && !readOnly) {
      setTimeout(() => { setEditing(null); setModalOpen(true); }, 150);
    }
  }

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      const { queued } = await offlineUpdate({
        visitaId,
        table: "visitas_tecnicas",
        rowId: visitaId,
        patch: {
        observacoes_gerais: obsGerais.trim() || null,
        conclusao: conclusao.trim() || null,
        status: "rascunho",
        },
      });
      toast.success(queued ? "Visita salva off-line." : "Visita salva!");
      setFinalizarOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setFinalizando(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="p-3 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-foreground truncate">{fazenda?.nome_fazenda || "—"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Início: {format(new Date(visita.hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
              {visita.hora_fim && ` · Fim: ${format(new Date(visita.hora_fim), "HH:mm", { locale: ptBR })}`}
            </div>
          </div>
          <Badge variant="secondary" className="capitalize shrink-0">Confinamento</Badge>
        </div>
      </Card>

      {/* Avaliação da Fábrica (única por visita) */}
      <Card className="p-3 space-y-3">
        <div className="text-sm font-semibold text-foreground">Avaliação da Fábrica</div>
        <div className="text-[11px] text-muted-foreground -mt-2">
          Avaliada uma única vez por visita
        </div>
        <FabricaScore label="Organização de Fábrica" value={fabricaNota} onChange={n => upsertFabrica({ organizacao_fabrica_nota: n })} disabled={readOnly} />
        <FabricaScore label="Organização de Insumos" value={insumosNota} onChange={n => upsertFabrica({ organizacao_insumos_nota: n })} disabled={readOnly} />
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Currais avaliados ({currais.length})</h2>
        {!readOnly && (
          <Button size="sm" onClick={openNew} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Curral
          </Button>
        )}
      </div>

      {currais.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum curral adicionado ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {currais.map(c => (
            <Card
              key={c.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => { setEditing(c); setModalOpen(true); }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 text-sm">
                  {c.num_curral}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm font-medium text-foreground">Curral {c.num_curral}</div>
                  <div className="flex gap-1.5 flex-wrap text-[10px]">
                    <ScorePill label="F" avg={c.scores?.fezes} n={c.samples.fezes.length} />
                    <ScorePill label="C" avg={c.scores?.corporal} n={c.samples.corporal.length} />
                    <ScorePill label="B" avg={c.scores?.bebedouro} n={c.samples.bebedouro.length} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="sticky bottom-16 pt-2 space-y-2">
          <Button
            onClick={() => navigate(`/consultor/visitas/${visitaId}/revisao`)}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
            disabled={currais.length === 0}
          >
            <FileCheck className="w-4 h-4" />
            {visita.status === "revisao" ? "Continuar Revisão" : "Revisar Visita"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFinalizarOpen(true)}
            className="w-full gap-2"
            disabled={currais.length === 0}
          >
            Salvar observações e conclusão
          </Button>
        </div>
      )}

      {(visita.observacoes_gerais || visita.conclusao) && (
        <Card className="p-3 space-y-2">
          {visita.observacoes_gerais && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Observações gerais</div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{visita.observacoes_gerais}</div>
            </div>
          )}
          {visita.conclusao && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Conclusão</div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{visita.conclusao}</div>
            </div>
          )}
        </Card>
      )}

      <CurralVisitaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        visitaId={visitaId}
        curral={editing}
        proximaOrdem={nextOrdem}
        onSaved={handleSavedFromModal}
        readOnly={readOnly}
      />

      <Dialog open={finalizarOpen} onOpenChange={setFinalizarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Visita</DialogTitle>
            <DialogDescription>Adicione as observações gerais e a conclusão da visita.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Observações gerais</Label>
              <Textarea rows={3} value={obsGerais} onChange={e => setObsGerais(e.target.value)} />
            </div>
            <div>
              <Label>Conclusão</Label>
              <Textarea rows={3} value={conclusao} onChange={e => setConclusao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizarOpen(false)}>Cancelar</Button>
            <Button onClick={handleFinalizar} disabled={finalizando} className="bg-primary hover:bg-primary/90">
              {finalizando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FabricaScore({ label, value, onChange, disabled }: {
  label: string; value: number | null; onChange: (n: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium mb-1">{label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "w-9 h-9 rounded-full border-2 text-sm font-semibold transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function ScorePill({ label, avg, n }: { label: string; avg?: number; n: number }) {
  return (
    <span className={`px-1.5 py-0.5 rounded font-semibold ${n > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {label}: {formatAvg(avg)}
      {n > 1 && <span className="opacity-60"> ({n})</span>}
    </span>
  );
}
