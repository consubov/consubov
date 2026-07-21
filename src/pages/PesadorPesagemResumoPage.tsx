import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, FileDown, Share2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  calcularAnimais,
  totalizar,
  type PesagemCompraCfg,
  type PesoAnimal,
} from "@/lib/pesagemCompra";
import { gerarPesagemPdf } from "@/lib/pesagemPdf";

const CATEGORIA_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  aleatoria: "Aleatória",
};

export default function PesadorPesagemResumoPage() {
  const { pesagemId } = useParams<{ pesagemId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<PesagemCompraCfg | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteFazenda, setClienteFazenda] = useState("");
  const [clienteCidade, setClienteCidade] = useState("");
  const [categoria, setCategoria] = useState("");
  const [finalizadaAt, setFinalizadaAt] = useState<string | null>(null);
  const [valorTotalPago, setValorTotalPago] = useState<number | null>(null);
  const [pesos, setPesos] = useState<PesoAnimal[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      if (!pesagemId) return;
      const { data: p } = await supabase
        .from("pesagens_compra")
        .select(
          "cliente_id, categoria, tipo_preco, preco_valor, modo_percentual, percentual_fixo, preco_arroba, preco_kg, preco_fixo_animal, finalizada_at, pdf_url, valor_total_pago"
        )
        .eq("id", pesagemId)
        .maybeSingle();
      if (p) {
        setCfg({
          tipo_preco: p.tipo_preco as any,
          preco_valor: Number(p.preco_valor ?? 0),
          modo_percentual: (p.modo_percentual as any) ?? "na",
          percentual_fixo: p.percentual_fixo != null ? Number(p.percentual_fixo) : null,
          preco_arroba: p.preco_arroba != null ? Number(p.preco_arroba) : null,
          preco_kg: p.preco_kg != null ? Number(p.preco_kg) : null,
          preco_fixo_animal: p.preco_fixo_animal != null ? Number(p.preco_fixo_animal) : null,
        });
        setCategoria(p.categoria);
        setFinalizadaAt(p.finalizada_at);
        setPdfUrl((p as any).pdf_url ?? null);
        const { data: c } = await supabase
          .from("clientes_pesador")
          .select("nome, nome_fazenda, cidade")
          .eq("id", p.cliente_id)
          .maybeSingle();
        setClienteNome((c?.nome as string) ?? "");
        setClienteFazenda((c?.nome_fazenda as string) ?? "");
        setClienteCidade((c?.cidade as string) ?? "");
      }
      const { data: ps } = await supabase
        .from("pesos_pesagem_compra")
        .select("ordem, peso_kg, percentual_individual, tipo_preco_individual, categoria_individual")
        .eq("pesagem_id", pesagemId)
        .order("ordem", { ascending: true });
      setPesos(
        (ps ?? []).map((x: any) => ({
          ordem: x.ordem,
          peso_kg: Number(x.peso_kg),
          percentual_individual:
            x.percentual_individual != null ? Number(x.percentual_individual) : null,
          tipo_preco_individual: x.tipo_preco_individual ?? null,
          categoria_individual: x.categoria_individual ?? null,
        }))
      );
      if (p?.tipo_preco === "misto") {
        const { data: cats } = await supabase
          .from("pesagens_compra_categorias")
          .select("categoria, tipo_preco, preco_valor")
          .eq("pesagem_id", pesagemId);
        const map: Record<string, { tipo_preco: any; preco_valor: number }> = {};
        (cats ?? []).forEach((r: any) => {
          map[r.categoria] = { tipo_preco: r.tipo_preco, preco_valor: Number(r.preco_valor) };
        });
        setCfg((prev) => (prev ? { ...prev, categorias_map: map } : prev));
      }
      setLoading(false);
    })();
  }, [pesagemId]);

  if (loading || !cfg) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  const animais = calcularAnimais(cfg, pesos);
  const tot = totalizar(animais);
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const showArroba = cfg.tipo_preco === "arroba" || cfg.tipo_preco === "misto";

  const cabecalhoPreco =
    cfg.tipo_preco === "arroba"
      ? `@ ${brl(cfg.preco_valor)}`
      : cfg.tipo_preco === "kg"
      ? `kg ${brl(cfg.preco_valor)}`
      : cfg.tipo_preco === "fixo_animal"
      ? `Fixo ${brl(cfg.preco_valor)}/animal`
      : Object.entries(cfg.categorias_map ?? {})
          .map(([cat, m]) => {
            const label = CATEGORIA_LABELS[cat] ?? cat;
            const tp = m.tipo_preco === "arroba" ? "@" : m.tipo_preco === "kg" ? "kg" : "Fixo";
            return `${label}: ${tp} ${brl(m.preco_valor)}`;
          })
          .join(" • ");

  const categoriaLabel = CATEGORIA_LABELS[categoria] ?? categoria;

  // Detalhamento por categoria (apenas para lote misto)
  const breakdownPorCategoria = cfg.tipo_preco === "misto"
    ? Object.entries(
        animais.reduce<Record<string, { count: number; valor: number }>>((acc, a) => {
          const cat = a.categoria_individual ?? "—";
          if (!acc[cat]) acc[cat] = { count: 0, valor: 0 };
          acc[cat].count += 1;
          acc[cat].valor += a.valor;
          return acc;
        }, {})
      ).map(([cat, v]) => ({
        label: CATEGORIA_LABELS[cat] ?? cat,
        count: v.count,
        valor: v.valor,
      }))
    : [];

  async function handleGerarPdf() {
    if (!pesagemId || !cfg) return;
    setGenerating(true);
    try {
      // Fetch pesador logo
      const { data: authUser } = await supabase.auth.getUser();
      let pesadorLogoUrl: string | null = null;
      let pesadorNomeEmpresa: string | null = null;
      let pesadorNome: string | null = null;
      if (authUser.user) {
        const { data: pes } = await supabase
          .from("pesadores")
          .select("logo_url, nome_empresa, nome")
          .eq("user_id", authUser.user.id)
          .maybeSingle();
        pesadorLogoUrl = (pes as any)?.logo_url ?? null;
        pesadorNomeEmpresa = (pes as any)?.nome_empresa ?? null;
        pesadorNome = (pes as any)?.nome ?? null;
      }

      const blob = await gerarPesagemPdf({
        header: {
          produtor: clienteNome,
          fazenda: clienteFazenda,
          cidade: clienteCidade,
          data: finalizadaAt ?? new Date().toISOString(),
          categoriaLabel,
          formaPagamento: cabecalhoPreco,
        },
        cfg,
        animais,
        pesadorLogoUrl,
        pesadorNomeEmpresa,
        pesadorNome,
      });

      const path = `pesagens/${pesagemId}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("relatorios")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
      const url = pub.publicUrl;
      await supabase.from("pesagens_compra").update({ pdf_url: url }).eq("id", pesagemId);
      setPdfUrl(url);
      toast({ title: "PDF gerado com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!pdfUrl) return;
    const title = "Relatório de Pesagem";
    const text = `Pesagem — ${clienteNome}`;
    try {
      const resp = await fetch(pdfUrl);
      const blob = await resp.blob();
      const fileName = `pesagem-${(clienteNome || "relatorio").replace(/\s+/g, "_")}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text });
        return;
      }
      if (nav.share) {
        await nav.share({ title, text, url: pdfUrl });
        return;
      }
      await navigator.clipboard.writeText(pdfUrl);
      toast({ title: "Link copiado" });
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4 pb-40">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase text-muted-foreground">Pesagem finalizada</div>
        <div className="text-lg font-semibold">{clienteNome}</div>
        <div className="text-xs text-muted-foreground">
          {categoriaLabel} • {cabecalhoPreco}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Animais</div>
          <div className="text-xl font-bold">{tot.totalAnimais}</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso médio</div>
          <div className="text-xl font-bold">{tot.mediaPeso.toString().replace(".", ",")} kg</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso total</div>
          <div className="text-xl font-bold">{tot.totalPeso.toString().replace(".", ",")} kg</div>
        </div>
        {showArroba && (
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground">@ pagáveis</div>
            <div className="text-xl font-bold">{tot.totalArroba.toString().replace(".", ",")}</div>
          </div>
        )}
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Média de @ por animal</div>
          <div className="text-xl font-bold">
            {tot.mediaArrobaPorAnimal.toString().replace(".", ",")}
          </div>
        </div>
        <div className="rounded-lg border bg-primary/10 border-primary/30 p-3 text-center col-span-2">
          <div className="text-xs text-muted-foreground">Total a pagar</div>
          <div className="text-2xl font-bold text-primary">{brl(tot.totalValor)}</div>
        </div>
      </div>

      {breakdownPorCategoria.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-2">Por categoria</div>
          <div className="text-xs space-y-1">
            {breakdownPorCategoria.map((b) => (
              <div key={b.label} className="flex justify-between border-b border-border/40 py-1">
                <span>{b.label}</span>
                <span>{b.count} animais — {brl(b.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs text-muted-foreground mb-2">Detalhamento</div>
        <div className="max-h-72 overflow-y-auto text-xs space-y-1">
          {animais.map((a) => (
            <div key={a.ordem} className="flex justify-between border-b border-border/40 py-1">
              <span>{a.ordem}</span>
              <span>{a.peso_kg.toString().replace(".", ",")} kg</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t space-y-2">
        {pdfUrl ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" asChild>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileDown className="w-4 h-4 mr-2" /> Baixar PDF
              </a>
            </Button>
            <Button variant="outline" className="h-11" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" /> Compartilhar
            </Button>
            <Button className="w-full h-11 col-span-2" onClick={() => navigate("/pesador/clientes")}>
              Concluir <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <Button
            className="w-full h-12"
            onClick={handleGerarPdf}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando PDF...</>
            ) : (
              <>Concluir e gerar PDF <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
