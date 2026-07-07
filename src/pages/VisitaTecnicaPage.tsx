import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Loader2, Clock, FileCheck, FileText, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PastoVisitaModal, { type VisitaPastoRow } from "@/components/consultor/PastoVisitaModal";
import ConfinamentoVisitaView from "@/components/consultor/ConfinamentoVisitaView";
import { averageOf, formatAvg } from "@/components/consultor/ScoreSamplesInput";

interface Visita {
  id: string;
  tipo: string;
  status: string;
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  fazenda_consultor_id: string;
  pdf_url: string | null;
}
interface Fazenda { id: string; nome_fazenda: string; }

function proximaLetra(pastos: VisitaPastoRow[]): string {
  const usadas = new Set(pastos.map(p => p.letra.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!usadas.has(l)) return l;
  }
  return "";
}

export default function VisitaTecnicaPage() {
  const { visitaId } = useParams<{ visitaId: string }>();
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [pastos, setPastos] = useState<VisitaPastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPasto, setEditingPasto] = useState<VisitaPastoRow | null>(null);
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [obsGerais, setObsGerais] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => { if (visitaId) load(); }, [visitaId]);

  const readOnly = visita?.status === "finalizada";

  async function load() {
    setLoading(true);
    const vRes = await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId!).maybeSingle();
    const v = vRes.data as Visita | null;
    setVisita(v);
    if (v) {
      setObsGerais(v.observacoes_gerais || "");
      setConclusao(v.conclusao || "");
      const [fRes, pRes] = await Promise.all([
        supabase.from("fazendas_consultor").select("id, nome_fazenda").eq("id", v.fazenda_consultor_id).maybeSingle(),
        supabase.from("visita_pastos").select("*").eq("visita_id", visitaId!).order("ordem"),
      ]);
      setFazenda(fRes.data as Fazenda | null);
      const pastosData = (pRes.data as any[]) || [];
      const ids = pastosData.map(p => p.id);
      let scoresByPasto: Record<string, VisitaPastoRow["scores"]> = {};
      if (ids.length > 0) {
        const { data: scoresData } = await supabase.from("avaliacoes_score")
          .select("visita_pasto_id, tipo, nota")
          .in("visita_pasto_id", ids);
        (scoresData || []).forEach((s: any) => {
          scoresByPasto[s.visita_pasto_id] = { ...(scoresByPasto[s.visita_pasto_id] || {}), [s.tipo]: s.nota };
        });
      }
      setPastos(pastosData.map(p => ({ ...p, scores: scoresByPasto[p.id] || {} })));
    }
    setLoading(false);
  }

  const nextLetra = useMemo(() => proximaLetra(pastos), [pastos]);
  const nextOrdem = useMemo(() => (pastos.length > 0 ? Math.max(...pastos.map(p => p.ordem)) + 1 : 0), [pastos]);

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      const { error } = await supabase.from("visitas_tecnicas").update({
        status: "finalizada",
        hora_fim: new Date().toISOString(),
        observacoes_gerais: obsGerais.trim() || null,
        conclusao: conclusao.trim() || null,
      }).eq("id", visitaId!);
      if (error) throw error;
      toast.success("Visita finalizada!");
      setFinalizarOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setFinalizando(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!visita) return <div className="text-center text-muted-foreground py-12">Visita não encontrada</div>;

  if (visita.tipo === "confinamento") {
    return <ConfinamentoVisitaView visitaId={visitaId!} visita={visita as any} fazenda={fazenda} />;
  }


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
          <Badge variant={readOnly ? "default" : "secondary"} className="capitalize shrink-0">
            {visita.status}
          </Badge>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Pastos avaliados ({pastos.length})</h2>
        {!readOnly && (
          <Button size="sm" onClick={() => { setEditingPasto(null); setModalOpen(true); }} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Pasto
          </Button>
        )}
      </div>

      {pastos.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum pasto adicionado ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {pastos.map(p => (
            <Card
              key={p.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => { setEditingPasto(p); setModalOpen(true); }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  {p.letra}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Pasto {p.num_pasto || "—"} · {p.qtd_animais ?? "—"} animais
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.tipo_produto || "—"}{p.consumo_kg_dia ? ` · ${p.consumo_kg_dia} kg/dia` : ""}
                  </div>
                  <div className="flex gap-2 mt-1.5 text-[10px]">
                    <ScorePill label="F" nota={p.scores?.fezes} />
                    <ScorePill label="C" nota={p.scores?.corporal} />
                    <ScorePill label="B" nota={p.scores?.bebedouro} />
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
            disabled={pastos.length === 0}
          >
            {visita.status === "revisao"
              ? <><FileText className="w-4 h-4" /> Continuar Revisão / Gerar PDF</>
              : <><FileCheck className="w-4 h-4" /> Revisar Visita</>}
          </Button>
        </div>
      )}


      {readOnly && visita.pdf_url && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Relatório em PDF disponível
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
              <a href={visita.pdf_url} target="_blank" rel="noreferrer">
                <FileText className="w-4 h-4" /> Ver
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
              <a href={visita.pdf_url} download>
                <Download className="w-4 h-4" /> Baixar
              </a>
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({ title: "Visita técnica Consubov", url: visita.pdf_url! });
                  } else {
                    await navigator.clipboard.writeText(visita.pdf_url!);
                    toast.success("Link copiado!");
                  }
                } catch { /* cancel */ }
              }}
            >
              <Share2 className="w-4 h-4" /> Enviar
            </Button>
          </div>
        </Card>
      )}


      {readOnly && (visita.observacoes_gerais || visita.conclusao) && (
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

      <PastoVisitaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        visitaId={visitaId!}
        pasto={editingPasto}
        proximaLetra={nextLetra}
        proximaOrdem={nextOrdem}
        onSaved={load}
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

function ScorePill({ label, nota }: { label: string; nota?: number }) {
  return (
    <span className={`px-1.5 py-0.5 rounded font-semibold ${nota ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {label}: {nota ?? "—"}
    </span>
  );
}
