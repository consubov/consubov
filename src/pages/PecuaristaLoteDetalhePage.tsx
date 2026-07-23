import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Scale, Search, Split } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo", vaca_gorda: "Vaca Gorda", vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro", garrote: "Garrote", novilha: "Novilha",
  bezerro: "Bezerro", bezerra: "Bezerra",
};

interface Lote {
  id: string; codigo: string; nome_lote: string; categoria: string;
  categoria_customizada_id: string | null; identificado: boolean; status: string;
}

interface UltimaPesagem {
  id: string; data_pesagem: string; peso_medio: number; quantidade_animais: number; gmd: number | null;
}

export default function PecuaristaLoteDetalhePage() {
  const { fazendaId, loteId } = useParams<{ fazendaId: string; loteId: string }>();
  const navigate = useNavigate();
  const [lote, setLote] = useState<Lote | null>(null);
  const [catNome, setCatNome] = useState<string>("");
  const [ultima, setUltima] = useState<UltimaPesagem | null>(null);
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);

  useEffect(() => {
    if (!loteId) return;
    (async () => {
      const { data: l } = await supabase
        .from("lotes_pecuarista")
        .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, status")
        .eq("id", loteId).maybeSingle();
      setLote(l as Lote);
      if ((l as any)?.categoria === "customizada" && (l as any)?.categoria_customizada_id) {
        const { data: c } = await supabase.from("categorias_pecuarista").select("nome").eq("id", (l as any).categoria_customizada_id).maybeSingle();
        setCatNome((c as any)?.nome ?? "Personalizada");
      }
      const { data: p } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("id, data_pesagem, peso_medio, quantidade_animais, gmd")
        .eq("lote_id", loteId)
        .gt("quantidade_animais", 0)
        .order("data_pesagem", { ascending: false })
        .limit(1);
      setUltima(((p as any[]) ?? [])[0] ?? null);
      setLoading(false);
    })();
  }, [loteId]);

  async function iniciarPesagem() {
    if (!loteId) return;
    setIniciando(true);
    const { data, error } = await supabase
      .from("pesagens_lote_pecuarista")
      .insert({
        lote_id: loteId,
        data_pesagem: new Date().toISOString(),
        peso_total: 0, quantidade_animais: 0, peso_medio: 0,
      })
      .select("id")
      .single();
    setIniciando(false);
    if (error || !data) return toast.error("Erro: " + (error?.message ?? "desconhecido"));
    navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/pesagem/${(data as any).id}`);
  }

  if (loading || !lote) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const categoriaLabel = lote.categoria === "customizada" ? catNome : (CATEGORIAS_LABELS[lote.categoria] ?? lote.categoria);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}`)}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold flex-1">{lote.nome_lote}</h1>
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono">#{lote.codigo}</Badge>
          <Badge variant={lote.status === "ativo" ? "default" : "secondary"}>{lote.status === "ativo" ? "Ativo" : "Encerrado"}</Badge>
          <Badge variant="outline">{lote.identificado ? "Identificado" : "Sem identificação"}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">Categoria: {categoriaLabel}</div>
        {ultima && (
          <div className="mt-2 text-sm border-t pt-2">
            <div>Última pesagem: <strong>{new Date(ultima.data_pesagem).toLocaleDateString("pt-BR")}</strong></div>
            <div>Peso médio: <strong>{Number(ultima.peso_medio).toFixed(1)} kg</strong> — {ultima.quantidade_animais} animais</div>
            {ultima.gmd != null && <div>GMD do lote: <strong>{Number(ultima.gmd).toFixed(3)} kg/dia</strong></div>}
          </div>
        )}
      </Card>

      <div className="grid gap-2">
        <Button size="lg" className="h-14 bg-primary hover:bg-primary/90" disabled={iniciando || lote.status !== "ativo"} onClick={() => setChoiceOpen(true)}>
          <Scale className="w-5 h-5 mr-2" />
          Iniciar Pesagem
        </Button>
        {lote.identificado && (
          <Button size="lg" variant="outline" className="h-14" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/buscar`)}>
            <Search className="w-5 h-5 mr-2" /> Buscar por animal
          </Button>
        )}
      </div>

      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tipo de pesagem</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Button
              size="lg"
              className="h-16 justify-start bg-primary hover:bg-primary/90"
              disabled={iniciando}
              onClick={() => { setChoiceOpen(false); void iniciarPesagem(); }}
            >
              {iniciando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Scale className="w-5 h-5 mr-2" />}
              <div className="text-left">
                <div className="font-semibold">Pesagem simples</div>
                <div className="text-xs opacity-90 font-normal">Só pesa o lote atual.</div>
              </div>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 justify-start"
              onClick={() => { setChoiceOpen(false); navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/apartacao`); }}
            >
              <Split className="w-5 h-5 mr-2" />
              <div className="text-left">
                <div className="font-semibold">Pesagem + Apartação</div>
                <div className="text-xs text-muted-foreground font-normal">Pesa e distribui em 2 ou 3 lotes de destino.</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
