import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import RelatorioPDF, { type RelatorioPDFData, type RetiroReportData, type PastoReportData } from "./RelatorioPDF";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type PeriodoTipo = "mensal" | "ultimos15" | "anual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fazendaId: string;
  fazendaNome: string;
  geradoPor: string;
}

const CONSUMO_META = 50;

export default function ExportarRelatorioModal({ open, onOpenChange, fazendaId, fazendaNome, geradoPor }: Props) {
  const now = new Date();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [retiroFiltro, setRetiroFiltro] = useState("todos");
  const [retirosList, setRetirosList] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fazendaId) return;
    supabase.from("retiros").select("id, nome").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome")
      .then(({ data }) => setRetirosList(data ?? []));
  }, [open, fazendaId]);

  function getDateRange(): { start: Date; end: Date; label: string } {
    if (periodoTipo === "ultimos15") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 15);
      return { start, end, label: "Últimos 15 dias" };
    }
    if (periodoTipo === "anual") {
      return {
        start: new Date(ano, 0, 1),
        end: new Date(ano, 11, 31, 23, 59, 59),
        label: `Ano ${ano}`,
      };
    }
    // mensal
    return {
      start: new Date(ano, mes - 1, 1),
      end: new Date(ano, mes, 0, 23, 59, 59),
      label: `${MESES[mes - 1]} ${ano}`,
    };
  }

  async function handleExportar() {
    setLoading(true);
    try {
      const { start, end, label } = getDateRange();
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      // Fetch retiros
      let retQuery = supabase.from("retiros")
        .select("id, nome, capataz, produto_id, ultima_salga_em")
        .eq("fazenda_id", fazendaId).eq("ativo", true);
      if (retiroFiltro !== "todos") {
        retQuery = retQuery.eq("id", retiroFiltro);
      }
      const { data: retirosData } = await retQuery;
      if (!retirosData || retirosData.length === 0) {
        toast.error("Nenhum retiro encontrado.");
        setLoading(false);
        return;
      }

      const retiroIds = retirosData.map(r => r.id);

      // Fetch pastos
      const { data: pastosData } = await supabase.from("pastos")
        .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id")
        .in("retiro_id", retiroIds).eq("ativo", true);
      const pastos = pastosData ?? [];
      const pastoIds = pastos.map(p => p.id);

      // Fetch lancamentos in period
      let lancamentos: any[] = [];
      if (pastoIds.length > 0) {
        const { data: lancData } = await supabase.from("lancamentos")
          .select("id, pasto_id, num_sacos, num_animais, consumo_g_cab_dia, custo_total, gmd_kg_dia, capataz_nome, lancado_em, status_consumo, indice_consumo, dias_intervalo")
          .in("pasto_id", pastoIds)
          .gte("lancado_em", startIso)
          .lte("lancado_em", endIso);
        lancamentos = lancData ?? [];
      }

      // Fetch lancamentos manuais for the period (only mensal/anual)
      let lancManuais: any[] = [];
      if (pastoIds.length > 0) {
        let mQuery = supabase.from("lancamentos_manuais")
          .select("*")
          .in("pasto_id", pastoIds) as any;
        if (periodoTipo === "mensal") {
          mQuery = mQuery.eq("mes_referencia", mes).eq("ano_referencia", ano);
        } else if (periodoTipo === "anual") {
          mQuery = mQuery.eq("ano_referencia", ano);
        } else {
          // ultimos15 - get current month
          mQuery = mQuery.eq("mes_referencia", now.getMonth() + 1).eq("ano_referencia", now.getFullYear());
        }
        const { data: mData } = await mQuery;
        lancManuais = mData ?? [];
      }

      // Set of pasto_ids that have automatic lancamentos
      const pastosComLancAuto = new Set(lancamentos.map(l => l.pasto_id));

      // Fetch produtos
      const produtoIds = [...new Set([
        ...retirosData.map(r => r.produto_id).filter(Boolean),
        ...pastos.map(p => p.produto_id).filter(Boolean),
      ])] as string[];
      let produtosMap: Record<string, { nome: string; peso_saco_kg: number; preco_por_kg: number }> = {};
      if (produtoIds.length > 0) {
        const { data: prodData } = await supabase.from("produtos")
          .select("id, nome, peso_saco_kg, preco_por_kg")
          .in("id", produtoIds);
        for (const p of (prodData ?? [])) {
          produtosMap[p.id] = { nome: p.nome, peso_saco_kg: Number(p.peso_saco_kg), preco_por_kg: Number(p.preco_por_kg ?? 0) };
        }
      }

      // Build report data
      const numDias = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

      const retiroReportData: RetiroReportData[] = retirosData.map(ret => {
        const rPastos = pastos.filter(p => p.retiro_id === ret.id);
        const rPastoIds = new Set(rPastos.map(p => p.id));
        const rLanc = lancamentos.filter(l => rPastoIds.has(l.pasto_id));
        const totalAnimais = rPastos.reduce((s, p) => s + (p.num_animais || 0), 0);
        const sacosUtilizados = rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);

        const cVals = rLanc.filter(l => l.consumo_g_cab_dia != null).map(l => Number(l.consumo_g_cab_dia));
        const consumoMedio = cVals.length > 0 ? cVals.reduce((a, b) => a + b, 0) / cVals.length : 0;

        const gVals = rPastos.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
        const gmd = gVals.length > 0 ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;

        const prod = ret.produto_id ? produtosMap[ret.produto_id] : null;
        const pesoSacoKg = prod?.peso_saco_kg ?? 25;
        const precoKg = prod?.preco_por_kg ?? 0;

        const custoTotal = rLanc.reduce((s, l) => s + (Number(l.custo_total) || 0), 0);
        const custoDiario = totalAnimais > 0 && numDias > 0 ? custoTotal / numDias / totalAnimais : 0;

        // Eficiência: % de pastos com status IDEAL
        const latestByPasto = new Map<string, any>();
        const sortedRLanc = [...rLanc].sort((a, b) => new Date(b.lancado_em ?? 0).getTime() - new Date(a.lancado_em ?? 0).getTime());
        for (const l of sortedRLanc) {
          if (!latestByPasto.has(l.pasto_id) && l.status_consumo) latestByPasto.set(l.pasto_id, l);
        }
        let naMeta = 0;
        latestByPasto.forEach(l => { if (l.status_consumo === 'IDEAL') naMeta++; });
        const eficiencia = rPastos.length > 0 ? (naMeta / rPastos.length) * 100 : 0;

        // Score calculation (same as useGerenteData)
        const avgC = consumoMedio;
        const consumoScore = avgC > 0 ? Math.max(0, 1 - Math.abs(avgC - CONSUMO_META) / CONSUMO_META) * 5 : 0;
        const expected = rPastos.length * (numDias / 3);
        const regScore = expected > 0 ? Math.min(1, rLanc.length / expected) * 2.5 : 0;
        const dates = rLanc.filter(l => l.lancado_em).map(l => new Date(l.lancado_em!).getTime()).sort((a, b) => a - b);
        let intScore = 0;
        if (dates.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 86400000);
          const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          intScore = avg <= 4 ? 2.5 : Math.max(0, 2.5 - (avg - 4) * 0.25);
        }
        const score = Math.min(10, consumoScore + regScore + intScore);

        // Build pasto data
        const pastoReport: PastoReportData[] = rPastos.map(p => {
          const pLanc = rLanc.filter(l => l.pasto_id === p.id);
          const pSacos = pLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);
          const pcVals = pLanc.filter(l => l.consumo_g_cab_dia != null).map(l => Number(l.consumo_g_cab_dia));
          const pConsumo = pcVals.length > 0 ? pcVals.reduce((a, b) => a + b, 0) / pcVals.length : 0;
          const pStatus = pConsumo < 70 ? "Baixo" : pConsumo <= 80 ? "Atenção" : pConsumo <= 120 ? "Ideal" : "Alto";
          return {
            nome: p.nome,
            numAnimais: p.num_animais || 0,
            numSacos: pSacos,
            consumoGCabDia: pConsumo,
            status: pStatus,
            pesoMedioKg: Number(p.peso_medio_kg ?? 0),
            gmdKgDia: Number(p.gmd_kg_dia ?? 0),
            pesoAbateMetaKg: Number(p.peso_abate_meta_kg ?? 500),
          };
        });

        const lastLanc = sortedRLanc.length > 0 ? sortedRLanc[0] : null;
        const dataStr = lastLanc?.lancado_em ? new Date(lastLanc.lancado_em).toLocaleDateString("pt-BR") : "—";

        return {
          nome: ret.nome,
          capataz: ret.capataz,
          totalAnimais,
          sacosUtilizados,
          consumoMedio,
          gmd,
          data: dataStr,
          produtoNome: prod?.nome ?? "—",
          precoKg,
          eficiencia,
          custoDiario,
          score: Number(score.toFixed(1)),
          scoreMeta: Number(consumoScore.toFixed(1)),
          scoreCocho: Number(regScore.toFixed(1)),
          scoreSalga: Number(intScore.toFixed(1)),
          pastos: pastoReport,
        };
      });

      const reportData: RelatorioPDFData = {
        fazendaNome,
        periodo: label,
        dataGeracao: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        geradoPor,
        retiros: retiroReportData,
      };

      // Generate PDF
      const blob = await pdf(<RelatorioPDF data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = fazendaNome.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const safeLabel = label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `relatorio_${safeName}_${safeLabel}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado com sucesso!");
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      toast.error("Erro ao gerar o relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Exportar Relatório PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="ultimos15">Últimos 15 dias</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mês + Ano (when mensal) */}
          {periodoTipo === "mensal" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Ano (when anual) */}
          {periodoTipo === "anual" && (
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Escopo */}
          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={retiroFiltro} onValueChange={setRetiroFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os retiros</SelectItem>
                {retirosList.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExportar} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
