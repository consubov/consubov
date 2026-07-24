import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, FileDown, Share2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfFromUrl } from "@/lib/downloadPdf";
import type { PecuaristaPesoIdentificado, PecuaristaPesoSemId } from "@/lib/pecuaristaPdf";

type NavState = {
  pdfUrl?: string;
  identificado: boolean;
  quantidade: number;
  peso_total: number;
  peso_medio: number;
  peso_medio_anterior?: number | null;
  data_anterior?: string | null;
  dias?: number | null;
  gmd?: number | null;
  identificados?: PecuaristaPesoIdentificado[];
  semId?: PecuaristaPesoSemId[];
  loteNome?: string;
  dataFim?: string | null;
  horaInicio?: string | null;
};

const fmt = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtHora = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
const fmtDataLinha = (fim?: string | null) => {
  if (!fim) return null;
  return new Date(fim).toLocaleDateString("pt-BR");
};
const fmtHorarioLinha = (fim?: string | null, ini?: string | null) => {
  if (!fim) return null;
  const hFim = fmtHora(fim);
  const hIni = ini ? fmtHora(ini) : "";
  if (hIni && hFim) return `Início da pesagem: ${hIni}h - Término da pesagem: ${hFim}h`;
  return null;
};

export default function PecuaristaPesagemResumoPage() {
  const { fazendaId, loteId, pesagemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = (location.state as NavState) || null;

  const [loading, setLoading] = useState(!stateData);
  const [data, setData] = useState<NavState | null>(stateData);
  const [pdfUrl, setPdfUrl] = useState<string | null>(stateData?.pdfUrl ?? null);
  const [sharing, setSharing] = useState(false);
  const [leiturasBalancao, setLeiturasBalancao] = useState<Array<{ ordem: number; peso_total: number; quantidade_animais: number; peso_individual: number }>>([]);

  useEffect(() => {
    if (!pesagemId) return;
    (async () => {
      const { data: ls } = await supabase
        .from("leituras_balancao_pecuarista")
        .select("ordem, peso_total, quantidade_animais, peso_individual")
        .eq("pesagem_lote_id", pesagemId)
        .order("ordem", { ascending: true });
      setLeiturasBalancao(((ls as any[]) ?? []).map((l) => ({
        ordem: Number(l.ordem), peso_total: Number(l.peso_total),
        quantidade_animais: Number(l.quantidade_animais), peso_individual: Number(l.peso_individual),
      })));
    })();
  }, [pesagemId]);

  useEffect(() => {
    if (data) return;
    (async () => {
      if (!pesagemId) return;
      const { data: p } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("quantidade_animais, peso_total, peso_medio, gmd, pdf_url, lote_id, data_pesagem, hora_inicio")
        .eq("id", pesagemId)
        .maybeSingle();
      if (!p) { setLoading(false); return; }
      const { data: lote } = await supabase
        .from("lotes_pecuarista").select("nome_lote, identificado").eq("id", (p as any).lote_id).maybeSingle();
      setPdfUrl((p as any).pdf_url ?? null);
      setData({
        identificado: !!(lote as any)?.identificado,
        loteNome: (lote as any)?.nome_lote,
        quantidade: Number((p as any).quantidade_animais ?? 0),
        peso_total: Number((p as any).peso_total ?? 0),
        peso_medio: Number((p as any).peso_medio ?? 0),
        gmd: (p as any).gmd != null ? Number((p as any).gmd) : null,
        pdfUrl: (p as any).pdf_url ?? undefined,
        dataFim: (p as any).data_pesagem ?? null,
        horaInicio: (p as any).hora_inicio ?? null,
      });
      setLoading(false);
    })();
  }, [pesagemId, data]);

  async function handleShare() {
    if (!pdfUrl) return;
    setSharing(true);
    try {
      const resp = await fetch(pdfUrl);
      const blob = await resp.blob();
      const file = new File([blob], `pesagem-${pesagemId}.pdf`, { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Relatório de Pesagem" });
      } else if (nav.share) {
        await nav.share({ title: "Relatório de Pesagem", url: pdfUrl });
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
        <div className="text-xs uppercase text-muted-foreground">Pesagem finalizada</div>
        <div className="text-lg font-semibold">{data.loteNome ?? "Lote"}</div>
        <div className="text-xs text-muted-foreground">
          {data.identificado ? "Lote identificado" : "Sem identificação"}
        </div>
        {fmtDataLinha(data.dataFim) && (
          <div className="text-xs text-muted-foreground mt-1">{fmtDataLinha(data.dataFim)}</div>
        )}
        {fmtHorarioLinha(data.dataFim, data.horaInicio) && (
          <div className="text-xs text-muted-foreground">{fmtHorarioLinha(data.dataFim, data.horaInicio)}</div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">Animais</div>
          <div className="text-xl font-bold">{data.quantidade}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso total</div>
          <div className="text-xl font-bold">{fmt(data.peso_total, 1)} kg</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso médio (kg)</div>
          <div className="text-xl font-bold">{fmt(data.peso_medio, 1)} kg</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso médio (@)</div>
          <div className="text-xl font-bold">{fmt(data.peso_medio / 30, 2)} @</div>
        </Card>
        {data.gmd != null && (
          <Card className="p-3 text-center col-span-2 bg-primary/10 border-primary/30">
            <div className="text-xs text-muted-foreground">GMD do lote</div>
            <div className="text-2xl font-bold text-primary">{fmt(data.gmd, 3)} kg/dia</div>
            {data.dias != null && <div className="text-xs text-muted-foreground mt-1">{data.dias} dias desde pesagem anterior</div>}
          </Card>
        )}
      </div>


      {data.identificado && data.identificados && data.identificados.length > 0 && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Pesos por animal</div>
          <div className="max-h-72 overflow-y-auto text-xs">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 font-semibold border-b py-1">
              <span>Nº</span><span className="text-right">Peso</span><span className="text-right">GMD</span>
            </div>
            {data.identificados.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/40 py-1">
                <span>{r.numero}</span>
                <span className="text-right">{fmt(r.peso_kg, 1)} kg</span>
                <span className="text-right">{r.gmd_individual != null ? `${fmt(r.gmd_individual, 3)}` : "—"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!data.identificado && data.semId && data.semId.length > 0 && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Pesos registrados</div>
          <div className="max-h-72 overflow-y-auto text-xs grid grid-cols-3 gap-1">
            {data.semId.map(p => (
              <div key={p.ordem} className="border-b border-border/40 py-1">
                {p.ordem} - {fmt(p.peso_kg, 1)} kg
              </div>
            ))}
          </div>
        </Card>
      )}

      {leiturasBalancao.length > 0 && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Leituras em Balanção</div>
          <div className="max-h-60 overflow-y-auto text-xs">
            <div className="grid grid-cols-4 gap-2 font-semibold border-b py-1">
              <span>Ordem</span>
              <span className="text-right">Peso total</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Individual</span>
            </div>
            {leiturasBalancao.map((l) => (
              <div key={l.ordem} className="grid grid-cols-4 gap-2 border-b border-border/40 py-1">
                <span>#{l.ordem}</span>
                <span className="text-right">{fmt(l.peso_total, 1)} kg</span>
                <span className="text-right">{l.quantidade_animais}</span>
                <span className="text-right">{fmt(l.peso_individual, 1)} kg</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div
        className="fixed left-0 right-0 px-4 pt-3 bg-background/95 backdrop-blur border-t space-y-2 z-50 shadow-lg"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "1rem" }}
      >
        {pdfUrl ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => void downloadPdfFromUrl(pdfUrl!, `pesagem-${pesagemId}.pdf`)}>
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
