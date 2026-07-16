import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Clock, FileText, Download, Share2, Factory } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import VisitaTopicosSection, { type Topico } from "@/components/consultor/VisitaTopicosSection";
import { computeFabricaPhotoNumbering } from "@/lib/photoNumbering";
import { generateFabricaPdf, uploadVisitaPdf } from "@/lib/visitaPdf";
import { getScoreDescription, SCORE_SCALE_HINT } from "@/lib/scoreLegends";
import SyncBadge from "./SyncBadge";
import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";

interface Visita {
  id: string; tipo: string; status: string;
  hora_inicio: string; hora_fim: string | null;
  fazenda_consultor_id: string; pdf_url: string | null;
  consultor_id: string;
}
interface Fazenda {
  id: string; nome_fazenda: string;
  proprietario?: string | null;
  responsavel?: string | null;
  municipio?: string | null; uf?: string | null;
}
interface Consultor { id: string; nome: string; }

const QUESITOS: { key: string; label: string }[] = [
  { key: "organizacao_geral", label: "Organização geral da fábrica" },
  { key: "armazenamento_insumos", label: "Armazenamento dos insumos" },
  { key: "controle_pragas", label: "Controle de pragas" },
  { key: "equipamentos_manutencao", label: "Equipamentos e manutenção" },
  { key: "precisao_dosagem", label: "Precisão de dosagem" },
  { key: "seguranca_epi", label: "Segurança e EPIs" },
  { key: "rotulagem_identificacao", label: "Rotulagem e identificação" },
];

export default function FabricaVisitaView({
  visitaId, visita: initialVisita, fazenda,
}: { visitaId: string; visita: Visita; fazenda: Fazenda | null }) {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita>(initialVisita);
  const [consultor, setConsultor] = useState<Consultor | null>(null);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const { pending: pendingUploads } = useSyncStatus();


  useEffect(() => { loadAvaliacoes(); loadConsultor(); }, [visitaId]);

  async function loadConsultor() {
    const { data } = await supabase.from("consultores").select("*").eq("id", visita.consultor_id).maybeSingle();
    setConsultor(data as Consultor | null);
  }

  async function loadAvaliacoes() {
    const { data } = await (supabase as any).from("avaliacoes_fabrica_quesito")
      .select("quesito, nota").eq("visita_id", visitaId);
    const map: Record<string, number> = {};
    (data as any[] || []).forEach(r => { map[r.quesito] = r.nota; });
    setNotas(map);
  }

  async function saveNota(quesito: string, nota: number) {
    if (readOnly) return;
    setNotas(prev => ({ ...prev, [quesito]: nota }));
    await (supabase as any).from("avaliacoes_fabrica_quesito")
      .upsert({ visita_id: visitaId, quesito, nota }, { onConflict: "visita_id,quesito" });
    if (visita.status === "finalizada") {
      await supabase.from("visitas_tecnicas").update({ pdf_url: null, status: "revisao" }).eq("id", visitaId);
      setVisita(prev => ({ ...prev, pdf_url: null, status: "revisao" }));
    }
  }

  const readOnly = false; // Fábrica sempre editável (assim como Rotina no Round 2)
  const numeroMap = computeFabricaPhotoNumbering(topicos.map(t => ({ id: t.id, ordem: t.ordem, fotos: t.fotos })));

  async function gerarPdf() {
    if (!fazenda || !consultor) { toast.error("Dados insuficientes"); return; }
    setGerandoPdf(true);
    const t = toast.loading("Gerando PDF...");
    try {
      const { blob, fileName } = await generateFabricaPdf({
        visitaId,
        fazenda: {
          nome_fazenda: fazenda.nome_fazenda,
          proprietario: fazenda.proprietario,
          municipio: fazenda.municipio,
          uf: fazenda.uf,
        },
        consultor: { nome: consultor.nome },
        hora_inicio: visita.hora_inicio,
        hora_fim: visita.hora_fim || new Date().toISOString(),
        quesitos: QUESITOS.map(q => ({ chave: q.key, rotulo: q.label, nota: notas[q.key] ?? null })),
        topicos: topicos.map(t => ({
          id: t.id, titulo: t.titulo, texto: t.texto, ordem: t.ordem,
          fotos: t.fotos.map(f => ({ id: f.id, url: f.url, ordem: f.ordem })),
        })),
        numeroMap,
        logoOverride: {
          esquerdaPath: (consultor as any)?.logo_esquerda_url || null,
          direitaPath: (consultor as any)?.logo_direita_url || null,
        },
      });
      const pdfUrl = await uploadVisitaPdf(blob, fileName, visita.consultor_id, visitaId);
      const { error } = await supabase.from("visitas_tecnicas").update({
        pdf_url: pdfUrl, status: "finalizada",
        hora_fim: visita.hora_fim || new Date().toISOString(),
      }).eq("id", visitaId);
      if (error) throw error;
      toast.dismiss(t);
      toast.success("PDF gerado e visita finalizada!");
      navigate("/consultor/historico");
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + (err?.message || "desconhecido"));
    } finally { setGerandoPdf(false); }
  }

  const totalNotas = QUESITOS.reduce((s, q) => s + (notas[q.key] || 0), 0);
  const quantidadeAvaliadas = QUESITOS.filter(q => notas[q.key]).length;
  const mediaGeral = quantidadeAvaliadas > 0 ? (totalNotas / quantidadeAvaliadas) : 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="p-3 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Factory className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-foreground truncate">
                Fábrica · {fazenda?.nome_fazenda || "—"}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Início: {format(new Date(visita.hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>
          <Badge variant={visita.status === "finalizada" ? "default" : "secondary"} className="capitalize shrink-0">
            {visita.status}
          </Badge>
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-foreground">Avaliação da Fábrica</div>
          {quantidadeAvaliadas > 0 && (
            <div className="text-xs text-muted-foreground">
              Média: <span className="font-bold text-primary">{mediaGeral.toFixed(1)}/5</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {QUESITOS.map(q => {
            const nota = notas[q.key];
            const legend = getScoreDescription(q.key);
            return (
              <div key={q.key} className="flex items-start justify-between gap-3 pb-2 border-b border-border/60 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{q.label}</div>
                  {legend && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {legend}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nota ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-bold text-primary tabular-nums">{nota}/5</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem nota</span>
                  )}
                  {!readOnly && (
                    <select
                      value={nota ?? ""}
                      onChange={e => saveNota(q.key, Number(e.target.value))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-label={`Nota — ${q.label}`}
                    >
                      <option value="" disabled>—</option>
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/40">
          {SCORE_SCALE_HINT}
        </div>
      </Card>

      <VisitaTopicosSection
        visitaId={visitaId}
        mode="fabrica"
        onChange={setTopicos}
        numeroMap={numeroMap}
      />

      <div className="sticky bottom-16 pt-2 space-y-2">
        <SyncBadge compact />
        <Button
          onClick={gerarPdf}
          disabled={gerandoPdf || quantidadeAvaliadas === 0 || pendingUploads > 0}
          className="w-full gap-2 bg-primary hover:bg-primary/90"
          title={pendingUploads > 0 ? "Sincronize as fotos antes de gerar o PDF" : undefined}
        >
          {gerandoPdf
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            : pendingUploads > 0
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Aguardando {pendingUploads} foto{pendingUploads === 1 ? "" : "s"}…</>
              : <><FileText className="w-4 h-4" /> {visita.status === "finalizada" ? "Gerar Novo PDF" : "Gerar PDF e Finalizar"}</>}
        </Button>
      </div>

      {visita.status === "finalizada" && visita.pdf_url && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Relatório em PDF
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
              <a href={visita.pdf_url} target="_blank" rel="noreferrer"><FileText className="w-4 h-4" /> Ver</a>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
              <a href={visita.pdf_url} download><Download className="w-4 h-4" /> Baixar</a>
            </Button>
            <Button
              size="sm" className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ title: "Visita técnica Consubov", url: visita.pdf_url! });
                  else { await navigator.clipboard.writeText(visita.pdf_url!); toast.success("Link copiado!"); }
                } catch { /* cancel */ }
              }}
            >
              <Share2 className="w-4 h-4" /> Enviar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
