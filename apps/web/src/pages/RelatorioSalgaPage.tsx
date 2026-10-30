import { downloadGeneratedPdf, withReportExportDeadline } from "@/lib/reportPdfExport";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, Download, Loader2, ExternalLink, Share2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { gerarPdfSalga, type PastoSalgaRow, type SalgaPdfData } from "@/utils/gerarPdfSalga";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type PeriodoTipo = "ultima_salga" | "semanal" | "mensal";

interface Props {
  onBack: () => void;
  fazendaId: string;
  fazendaNome: string;
  /** If provided, lock to this retiro (capataz mode) */
  retiroId?: string;
  retiroNome?: string;
}

export default function RelatorioSalgaPage({ onBack, fazendaId, fazendaNome, retiroId: fixedRetiroId, retiroNome: fixedRetiroNome }: Props) {
  const [retirosList, setRetirosList] = useState<{ id: string; nome: string }[]>([]);
  const [selectedRetiroId, setSelectedRetiroId] = useState(fixedRetiroId || "");
  const [selectedRetiroNome, setSelectedRetiroNome] = useState(fixedRetiroNome || "");
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mesSel, setMesSel] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.getMonth() + 1;
  });
  const [anoSel, setAnoSel] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.getFullYear();
  });
  const [ultimaSalgaDate, setUltimaSalgaDate] = useState<string | null>(null);
  const [loadingUltima, setLoadingUltima] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const pdfBlobRef = useRef<Blob | null>(null);
  const fileNameRef = useRef<string>("");

  // Load retiros list for gerente/escritorio (when not locked)
  useEffect(() => {
    if (fixedRetiroId || !fazendaId) return;
    supabase
      .from("retiros")
      .select("id, nome")
      .eq("fazenda_id", fazendaId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        const list = data ?? [];
        setRetirosList(list);
        if (list.length > 0 && !selectedRetiroId) {
          setSelectedRetiroId(list[0].id);
          setSelectedRetiroNome(list[0].nome);
        }
      });
  }, [fazendaId, fixedRetiroId]);

  // Fetch ultima salga date
  useEffect(() => {
    if (periodoTipo !== "ultima_salga" || !selectedRetiroId) return;
    setLoadingUltima(true);
    setUltimaSalgaDate(null);
    supabase
      .from("lancamentos")
      .select("created_at")
      .eq("retiro_id", selectedRetiroId)
      .eq("fazenda_id", fazendaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setUltimaSalgaDate(data[0].created_at);
        }
        setLoadingUltima(false);
      });
  }, [periodoTipo, selectedRetiroId, fazendaId]);

  function getDateRange(): { start: Date; end: Date; label: string } | null {
    if (periodoTipo === "ultima_salga") {
      if (!ultimaSalgaDate) return null;
      const d = new Date(ultimaSalgaDate);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return { start, end, label: `ULTIMA_SALGA_${yyyy}-${mm}-${dd}` };
    }
    if (periodoTipo === "semanal") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { start, end, label: `SEMANAL_${fmt(start)}_${fmt(end)}` };
    }
    const start = new Date(anoSel, mesSel - 1, 1);
    const end = new Date(anoSel, mesSel, 0, 23, 59, 59);
    return { start, end, label: `MENSAL_${anoSel}-${String(mesSel).padStart(2, "0")}` };
  }

  function getPeriodoDisplay(): string {
    if (periodoTipo === "ultima_salga") {
      if (!ultimaSalgaDate) return "Carregando…";
      const d = new Date(ultimaSalgaDate);
      return `Última salga: ${d.toLocaleDateString("pt-BR")}`;
    }
    if (periodoTipo === "semanal") return "Últimos 7 dias";
    return `${MESES[mesSel - 1]} ${anoSel}`;
  }

  const canGenerate = selectedRetiroId && (periodoTipo !== "ultima_salga" || (ultimaSalgaDate != null && !loadingUltima));

  async function handleGerarPdf() {
    setGenerating(true);
    setNoData(false);
    setPdfUrl(null);
    setResumo(null);
    pdfBlobRef.current = null;
    toast.info("Gerando PDF…");

    try {
      const range = getDateRange();
      if (!range) {
        toast.error("Nenhuma salga encontrada.");
        setGenerating(false);
        return;
      }

      const { data: lancData, error } = await withReportExportDeadline(supabase
        .from("lancamentos")
        .select("pasto_id, num_sacos, cocho_cheio")
        .eq("retiro_id", selectedRetiroId)
        .eq("fazenda_id", fazendaId)
        .gte("created_at", range.start.toISOString())
        .lte("created_at", range.end.toISOString()), "Lançamentos da salga", Date.now() + 25_000);

      if (error) throw error;
      if (!lancData || lancData.length === 0) {
        setNoData(true);
        setGenerating(false);
        return;
      }

      const pastoMap: Record<string, number> = {};
      const cochoMap: Record<string, number> = {};
      lancData.forEach((l: any) => {
        pastoMap[l.pasto_id] = (pastoMap[l.pasto_id] || 0) + (l.num_sacos || 0);
        if (l.cocho_cheio) cochoMap[l.pasto_id] = (cochoMap[l.pasto_id] || 0) + 1;
      });

      const pastoIds = Object.keys(pastoMap);
      const { data: pastosData } = await withReportExportDeadline(supabase
        .from("pastos")
        .select("id, nome, num_animais, peso_medio_kg")
        .in("id", pastoIds), "Pastos da salga", Date.now() + 25_000);

      const rows: PastoSalgaRow[] = (pastosData || []).map((p) => ({
        nome: p.nome,
        numAnimais: p.num_animais || 0,
        pesoMedioKg: Number(p.peso_medio_kg ?? 0),
        sacosUtilizados: pastoMap[p.id] || 0,
        cochoCheio: cochoMap[p.id] || 0,
      }));

      rows.sort((a, b) => a.nome.localeCompare(b.nome));

      const pdfData: SalgaPdfData = {
        fazendaNome,
        retiroNome: selectedRetiroNome,
        periodoLabel: getPeriodoDisplay(),
        pastos: rows,
      };

      const { blob, fileName } = gerarPdfSalga(pdfData);
      pdfBlobRef.current = blob;
      fileNameRef.current = fileName;

      const storagePath = `salgas/${fazendaId}/${fileName}`;
      try {
        const { error: uploadError } = await withReportExportDeadline(supabase.storage
          .from("relatorios").upload(storagePath, blob, { upsert: true, contentType: "application/pdf" }),
          "Backup do PDF", Date.now() + 25_000);
        if (uploadError) throw uploadError;
      } catch (uploadError) {
        console.warn("[PDF] Backup remoto não confirmado:", uploadError);
        toast.warning("PDF gerado localmente; cópia no servidor não confirmada.");
      }

      const totalSacosReais = rows.reduce((s, r) => s + r.sacosUtilizados, 0);
      const totalCocho = rows.reduce((s, r) => s + (r.cochoCheio ?? 0), 0);
      setResumo(
        totalCocho > 0
          ? `${totalSacosReais} sacos · ${totalCocho} cocho cheio`
          : `${totalSacosReais} sacos`
      );

      const localUrl = URL.createObjectURL(blob);
      setPdfUrl(localUrl);
      toast.success("PDF gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar PDF de salga:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    const blob = pdfBlobRef.current;
    if (!blob) return;

    const shareFileName = `Relatório de Salga - ${fazendaNome}.pdf`;
    const file = new File([blob], shareFileName, { type: "application/pdf" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Relatório de Salga - ${fazendaNome}` });
        return;
      } catch { /* cancelled */ }
    }

    downloadGeneratedPdf(blob, shareFileName);
    toast.success("PDF baixado!");
  }

  const now = new Date();
  const years = Array.from({ length: 2 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="min-h-screen bg-background p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Relatório de Salga
          </h1>
          <p className="text-xs text-muted-foreground">{fazendaNome}{selectedRetiroNome ? ` — ${selectedRetiroNome}` : ""}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Retiro selector for gerente/escritorio */}
          {!fixedRetiroId && retirosList.length > 0 && (
            <div className="space-y-2">
              <Label>Retiro</Label>
              <Select
                value={selectedRetiroId}
                onValueChange={(v) => {
                  setSelectedRetiroId(v);
                  setSelectedRetiroNome(retirosList.find((r) => r.id === v)?.nome || "");
                  setPdfUrl(null);
                  setNoData(false);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o retiro" /></SelectTrigger>
                <SelectContent>
                  {retirosList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodoTipo} onValueChange={(v) => { setPeriodoTipo(v as PeriodoTipo); setPdfUrl(null); setNoData(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ultima_salga">Última Salga</SelectItem>
                <SelectItem value="semanal">Última Semana</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodoTipo === "ultima_salga" && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
              {loadingUltima ? (
                <span className="text-muted-foreground">Buscando última salga…</span>
              ) : ultimaSalgaDate ? (
                `Última salga: ${new Date(ultimaSalgaDate).toLocaleDateString("pt-BR")}`
              ) : (
                <span className="text-muted-foreground">Nenhuma salga encontrada</span>
              )}
            </div>
          )}

          {periodoTipo === "mensal" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={String(mesSel)} onValueChange={(v) => { setMesSel(Number(v)); setPdfUrl(null); setNoData(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(anoSel)} onValueChange={(v) => { setAnoSel(Number(v)); setPdfUrl(null); setNoData(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {noData && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nenhuma salga registrada no período selecionado.
            </div>
          )}
        </CardContent>
      </Card>

      {resumo && (
        <p className="text-sm text-center text-muted-foreground">
          Total do período: <span className="font-semibold text-foreground">{resumo}</span>
        </p>
      )}

      <div className="flex gap-2">
        {!pdfUrl ? (
          <>
            <Button variant="outline" className="flex-1" onClick={onBack}>
              Voltar
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleGerarPdf}
              disabled={generating || !canGenerate || noData}
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Gerar PDF
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(pdfUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir PDF
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
