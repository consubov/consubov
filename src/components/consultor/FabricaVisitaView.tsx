import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Clock, FileText, Download, Share2, Factory, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import VisitaTopicosSection, { type Topico } from "@/components/consultor/VisitaTopicosSection";
import AssinaturasSection, { fetchAssinantes, type Assinante } from "@/components/consultor/AssinaturasSection";
import VisitaDateTimeEditor from "@/components/consultor/VisitaDateTimeEditor";
import { computeFabricaPhotoNumbering } from "@/lib/photoNumbering";
import { generateFabricaPdf, uploadVisitaPdf } from "@/lib/visitaPdf";
import { getScoreDescription, SCORE_SCALE_HINT } from "@/lib/scoreLegends";

import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { hasPendingLocalChanges, isVisitaDeleted, loadSnapshot, saveSnapshot, offlineUpdate, offlineUpsert } from "@/lib/consultorOffline/snapshotStore";
import { getErrorMessage, withConsultorTimeout } from "@/lib/consultorOffline/network";

interface Visita {
  id: string; tipo: string; status: string;
  hora_inicio: string; hora_fim: string | null;
  fazenda_consultor_id: string; pdf_url: string | null;
  consultor_id: string;
  deleted_at?: string | null;
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
  const [fazendaAtual, setFazendaAtual] = useState<Fazenda | null>(fazenda);
  const [consultor, setConsultor] = useState<Consultor | null>(null);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [notaIds, setNotaIds] = useState<Record<string, string>>({});
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  void assinantes;
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const { pending: pendingUploads } = useSyncStatus();
  const [pendingThisVisit, setPendingThisVisit] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [salvandoOffline, setSalvandoOffline] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);


  useEffect(() => { loadDados(); }, [visitaId]);

  async function loadDados() {
    const snap = await loadSnapshot(visitaId);
    if (isVisitaDeleted(snap?.visita as any)) return;
    setFazendaAtual(fazenda || (snap?.fazenda as Fazenda | undefined) || null);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const preferLocal = !!snap?.visita && await hasPendingLocalChanges(visitaId);
    const [{ data: consultorData }, { data }] = online && !preferLocal
      ? await Promise.all([
          supabase.from("consultores").select("*").eq("id", visita.consultor_id).maybeSingle(),
          (supabase as any).from("avaliacoes_fabrica_quesito").select("id, quesito, nota").eq("visita_id", visitaId),
        ])
      : [{ data: null }, { data: null }];
    const consultorRow = (consultorData as Consultor | null) || (snap?.consultor as Consultor | undefined) || null;
    setConsultor(consultorRow);
    const rows = ((data as any[])?.length ? data as any[] : (snap?.avaliacoes_fabrica as any[]) || []);
    const map: Record<string, number> = {};
    const ids: Record<string, string> = {};
    rows.forEach(r => { map[r.quesito] = r.nota; if (r.id) ids[r.quesito] = r.id; });
    setNotas(map);
    setNotaIds(ids);
    setPendingThisVisit(await hasPendingLocalChanges(visitaId));
    if (!preferLocal) {
      void saveSnapshot(visitaId, {
        ...(snap || {}),
        visita,
        fazenda: fazenda || snap?.fazenda,
        consultor: consultorRow,
        avaliacoes_fabrica: rows,
      }).catch(() => {});
    }
  }

  async function saveNota(quesito: string, nota: number) {
    if (readOnly) return;
    setNotas(prev => ({ ...prev, [quesito]: nota }));
    const rowId = notaIds[quesito] || crypto.randomUUID();
    setNotaIds(prev => ({ ...prev, [quesito]: rowId }));
    await offlineUpsert({
      visitaId,
      table: "avaliacoes_fabrica_quesito",
      rowId,
      payload: { visita_id: visitaId, quesito, nota },
      onConflict: "visita_id,quesito",
      applyToSnapshot: (curr, payload) => {
        const rows = [...((curr.avaliacoes_fabrica as any[]) || [])];
        const idx = rows.findIndex(r => r.quesito === quesito);
        if (idx >= 0) rows[idx] = { ...rows[idx], id: rowId, ...payload };
        else rows.push({ id: rowId, ...payload });
        return { ...curr, avaliacoes_fabrica: rows };
      },
    });
    if (visita.status === "finalizada") {
      await offlineUpdate({ visitaId, table: "visitas_tecnicas", rowId: visitaId, patch: { pdf_url: null, status: "revisao" } });
      setVisita(prev => ({ ...prev, pdf_url: null, status: "revisao" }));
    }
  }

  const readOnly = false; // Fábrica sempre editável (assim como Rotina no Round 2)
  const numeroMap = computeFabricaPhotoNumbering(topicos.map(t => ({ id: t.id, ordem: t.ordem, fotos: t.fotos })));

  async function gerarPdf() {
    if (!fazendaAtual || !consultor) { toast.error("Dados insuficientes"); return; }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Conecte à internet e sincronize antes de gerar o PDF.");
      return;
    }
    if (await hasPendingLocalChanges(visitaId)) {
      const tSync = toast.loading("Sincronizando dados desta visita…");
      const { syncVisitaWithRetries } = await import("@/lib/consultorOffline/snapshotStore");
      const result = await syncVisitaWithRetries(visitaId, { attempts: 3, totalTimeoutMs: 90000 });
      toast.dismiss(tSync);
      if (!result.ok) {
        setPendingThisVisit(true);
        const motivo = result.reason || "Ainda há itens pendentes.";
        toast.error(`Não foi possível sincronizar. ${motivo}. Tentar novamente?`, {
          action: { label: "Tentar novamente", onClick: () => void gerarPdf() },
        });
        return;
      }
      setPendingThisVisit(false);
    }
    setGerandoPdf(true);
    const t = toast.loading("Gerando PDF...");
    try {
      // Refetch fresh photos from Supabase (queued: URLs from local state won't resolve)
      const topicosFresh = await Promise.all(topicos.map(async t => {
        const { data: fresh } = await withConsultorTimeout<any>((supabase as any)
          .from("visita_topico_fotos")
          .select("*").eq("visita_topico_id", t.id).order("ordem"), "busca de fotos dos tópicos");
        const list = ((fresh as any[]) || []).map(f => ({ id: f.id, url: f.url, ordem: f.ordem }));
        return { id: t.id, titulo: t.titulo, texto: t.texto, ordem: t.ordem, zona: (t as any).zona, fotos: list };
      }));
      const numeroMapFresh = computeFabricaPhotoNumbering(
        topicosFresh.map(t => ({ id: t.id, ordem: t.ordem, fotos: t.fotos }))
      );
      const { blob, fileName } = await generateFabricaPdf({
        visitaId,
        fazenda: {
          nome_fazenda: fazendaAtual.nome_fazenda,
          proprietario: fazendaAtual.proprietario,
          responsavel: fazendaAtual.responsavel ?? null,
          municipio: fazendaAtual.municipio,
          uf: fazendaAtual.uf,
        },
        consultor: { nome: consultor.nome },
        hora_inicio: visita.hora_inicio,
        hora_fim: visita.hora_fim || new Date().toISOString(),
        quesitos: QUESITOS.map(q => ({ chave: q.key, rotulo: q.label, nota: notas[q.key] ?? null })),
        topicos: topicosFresh,
        numeroMap: numeroMapFresh,
        assinantes: (await fetchAssinantes(visita.id)).map(a => ({ nome: a.nome, cargo_funcao: a.cargo_funcao })),
        logoOverride: {
          esquerdaPath: (consultor as any)?.logo_esquerda_url || null,
          direitaPath: (consultor as any)?.logo_direita_url || null,
        },
      });
      const pdfUrl = await withConsultorTimeout(
        uploadVisitaPdf(blob, fileName, visita.consultor_id, visitaId),
        "upload do PDF",
      );
      const { error } = await withConsultorTimeout(supabase.from("visitas_tecnicas").update({
        pdf_url: pdfUrl, status: "finalizada",
        hora_fim: visita.hora_fim || new Date().toISOString(),
      }).eq("id", visitaId), "finalização da visita");
      if (error) throw error;
      toast.dismiss(t);
      toast.success("PDF gerado e visita finalizada!");
      navigate("/consultor/historico");
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + getErrorMessage(err));
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
                Fábrica · {fazendaAtual?.nome_fazenda || "—"}
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
        onChange={setTopicos}
        numeroMap={numeroMap}
      />

      {/* Data e horário editáveis */}
      <VisitaDateTimeEditor
        horaInicio={visita.hora_inicio}
        horaFim={visita.hora_fim}
        onChange={async (patch) => {
          setVisita(prev => ({ ...prev, ...patch } as Visita));
          await offlineUpdate({
            visitaId,
            table: "visitas_tecnicas",
            rowId: visitaId,
            patch: patch as any,
          });
        }}
      />

      {/* Assinaturas — múltiplos consultores */}
      <AssinaturasSection
        visitaId={visitaId}
        onChange={setAssinantes}
      />

      <div className="sticky bottom-16 pt-2 space-y-2">
        {!online ? (
          <Button
            onClick={async () => {
              setSalvandoOffline(true);
              try {
                await offlineUpdate({ visitaId, table: "visitas_tecnicas", rowId: visitaId, patch: {} });
                toast.success("Visita salva off-line. Sincronize quando tiver internet para gerar o PDF.");
                navigate("/consultor/historico");
              } finally { setSalvandoOffline(false); }
            }}
            disabled={salvandoOffline}
            className="w-full gap-2 bg-[#1F7A4D] hover:bg-[#166A42] text-white"
          >
            {salvandoOffline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar off-line
          </Button>
        ) : (
          <Button
            onClick={gerarPdf}
            disabled={gerandoPdf || quantidadeAvaliadas === 0}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            {gerandoPdf
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><FileText className="w-4 h-4" /> {visita.status === "finalizada" ? "Gerar Novo PDF" : "Salvar e Gerar PDF"}</>}
          </Button>
        )}
      </div>

      {visita.status === "finalizada" && visita.pdf_url && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Relatório em PDF
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5"
              onClick={() => import("@/lib/openPdfBlob").then(m => m.openPdfBlobUrl(visita.pdf_url!))}>
              <FileText className="w-4 h-4" /> Ver
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
