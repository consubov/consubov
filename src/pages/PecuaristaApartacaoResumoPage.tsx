import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, FileDown, Share2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfFromUrl } from "@/lib/downloadPdf";
import type { ApartacaoDestinoSection } from "@/lib/pecuaristaPdf";

type NavState = {
  pdfUrl?: string;
  totalGeral: { quantidade: number; peso_total: number };
  destinos: ApartacaoDestinoSection[];
  dataFim?: string | null;
  horaInicio?: string | null;
};

const fmt = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtHora = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
const fmtDataLinha = (fim?: string | null, ini?: string | null) => {
  if (!fim) return null;
  const dia = new Date(fim).toLocaleDateString("pt-BR");
  const hFim = fmtHora(fim);
  const hIni = ini ? fmtHora(ini) : "";
  if (hIni && hFim) return `${dia} · Início ${hIni} — Fim ${hFim}`;
  return hFim ? `${dia} · ${hFim}` : dia;
};

export default function PecuaristaApartacaoResumoPage() {
  const { fazendaId, loteId, apartacaoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = (location.state as NavState) || null;

  const [loading, setLoading] = useState(!stateData);
  const [data, setData] = useState<NavState | null>(stateData);
  const [pdfUrl, setPdfUrl] = useState<string | null>(stateData?.pdfUrl ?? null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (data) return;
    (async () => {
      if (!apartacaoId) return;
      const { data: ap } = await supabase.from("apartacoes_pecuarista")
        .select("pdf_url, data_apartacao, hora_inicio").eq("id", apartacaoId).maybeSingle();
      setPdfUrl((ap as any)?.pdf_url ?? null);
      const { data: pesagens } = await supabase.from("pesagens_lote_pecuarista")
        .select("lote_id, quantidade_animais, peso_total, peso_medio, gmd")
        .eq("apartacao_id", apartacaoId);
      const destinos: ApartacaoDestinoSection[] = [];
      let totQ = 0, totP = 0;
      for (const p of (pesagens ?? []) as any[]) {
        const { data: lote } = await supabase.from("lotes_pecuarista")
          .select("nome_lote, codigo, identificado").eq("id", p.lote_id).maybeSingle();
        destinos.push({
          nome_lote: (lote as any)?.nome_lote ?? "—",
          codigo: (lote as any)?.codigo ?? null,
          identificado: !!(lote as any)?.identificado,
          quantidade: Number(p.quantidade_animais),
          peso_total: Number(p.peso_total),
          peso_medio: Number(p.peso_medio),
          gmd: p.gmd != null ? Number(p.gmd) : null,
        });
        totQ += Number(p.quantidade_animais);
        totP += Number(p.peso_total);
      }
      setData({ totalGeral: { quantidade: totQ, peso_total: totP }, destinos, pdfUrl: (ap as any)?.pdf_url ?? undefined, dataFim: (ap as any)?.data_apartacao ?? null, horaInicio: (ap as any)?.hora_inicio ?? null });
      setLoading(false);
    })();
  }, [apartacaoId, data]);

  async function handleShare() {
    if (!pdfUrl) return;
    setSharing(true);
    try {
      const resp = await fetch(pdfUrl);
      const blob = await resp.blob();
      const file = new File([blob], `apartacao-${apartacaoId}.pdf`, { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Relatório de Apartação" });
      } else if (nav.share) {
        await nav.share({ title: "Relatório de Apartação", url: pdfUrl });
      } else {
        await navigator.clipboard.writeText(pdfUrl);
        toast.success("Link copiado");
      }
    } catch {/* ignore */} finally { setSharing(false); }
  }

  if (loading || !data) return (
    <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-40 px-2">
      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground">Apartação finalizada</div>
        {fmtDataLinha(data.dataFim, data.horaInicio) && (
          <div className="text-xs text-muted-foreground mt-1">{fmtDataLinha(data.dataFim, data.horaInicio)}</div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <div className="text-xs text-muted-foreground">Total animais</div>
            <div className="text-xl font-bold">{data.totalGeral.quantidade}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Peso total</div>
            <div className="text-xl font-bold">{fmt(data.totalGeral.peso_total, 1)} kg</div>
          </div>
        </div>
      </Card>

      {data.destinos.map((d, i) => (
        <Card key={i} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{d.nome_lote}</div>
              <div className="text-xs text-muted-foreground">{d.identificado ? "Identificado" : "Sem identificação"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Animais</div>
              <div className="font-bold">{d.quantidade}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-muted p-2">
              <div className="text-muted-foreground">Peso total</div>
              <div className="font-semibold">{fmt(d.peso_total, 1)} kg</div>
            </div>
            <div className="rounded bg-muted p-2">
              <div className="text-muted-foreground">Peso médio</div>
              <div className="font-semibold">{fmt(d.peso_medio, 1)} kg</div>
            </div>
            <div className="rounded bg-muted p-2">
              <div className="text-muted-foreground">GMD</div>
              <div className="font-semibold">{d.gmd != null ? `${fmt(d.gmd, 3)}` : "—"}</div>
            </div>
          </div>
          {d.identificado && d.identificados && d.identificados.length > 0 && (
            <div className="max-h-48 overflow-y-auto text-xs mt-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 font-semibold border-b py-1">
                <span>Nº</span><span className="text-right">Peso</span><span className="text-right">GMD</span>
              </div>
              {d.identificados.map((r, j) => (
                <div key={j} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/40 py-1">
                  <span>{r.numero}</span>
                  <span className="text-right">{fmt(r.peso_kg, 1)} kg</span>
                  <span className="text-right">{r.gmd_individual != null ? fmt(r.gmd_individual, 3) : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <div
        className="fixed left-0 right-0 px-4 pt-3 bg-background/95 backdrop-blur border-t space-y-2 z-50 shadow-lg"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "1rem" }}
      >
        {pdfUrl ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => void downloadPdfFromUrl(pdfUrl!, `apartacao-${apartacaoId}.pdf`)}>
                <FileDown className="w-4 h-4 mr-2" /> Baixar
              </Button>
              <Button variant="outline" className="h-11" onClick={handleShare} disabled={sharing}>
                {sharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />} Compartilhar
              </Button>
            </div>
            <Button className="w-full h-11" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`)}>
              Concluir <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        ) : (
          <Button className="w-full h-11" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`)}>
            Voltar ao lote
          </Button>
        )}
      </div>
    </div>
  );
}
