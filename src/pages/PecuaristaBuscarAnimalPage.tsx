import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Historico {
  peso_kg: number;
  gmd_individual: number | null;
  data: string;
  lote_nome: string;
  lote_codigo: string;
}

export default function PecuaristaBuscarAnimalPage() {
  const { fazendaId, loteId } = useParams<{ fazendaId: string; loteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pecuaristaId, setPecuaristaId] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [historico, setHistorico] = useState<Historico[] | null>(null);
  const [animalFound, setAnimalFound] = useState<boolean | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("pecuaristas").select("id").eq("user_id", user.id).maybeSingle();
      setPecuaristaId((data as any)?.id ?? null);
    })();
  }, [user]);

  async function buscar() {
    if (!pecuaristaId || !numero.trim()) return;
    setBuscando(true);
    setHistorico(null); setAnimalFound(null);
    const { data: an } = await supabase
      .from("animais_pecuarista")
      .select("id")
      .eq("pecuarista_id", pecuaristaId)
      .eq("numero", numero.trim())
      .maybeSingle();
    if (!an) {
      setAnimalFound(false);
      setBuscando(false);
      return;
    }
    setAnimalFound(true);
    const { data: rows, error } = await supabase
      .from("pesos_animais_pecuarista")
      .select("peso_kg, gmd_individual, created_at, pesagens_lote_pecuarista!inner(data_pesagem, lotes_pecuarista!inner(nome_lote, codigo))")
      .eq("animal_id", (an as any).id)
      .order("created_at", { ascending: true });
    setBuscando(false);
    if (error) return toast.error("Erro: " + error.message);
    const list: Historico[] = ((rows as any[]) ?? []).map((r) => ({
      peso_kg: Number(r.peso_kg),
      gmd_individual: r.gmd_individual != null ? Number(r.gmd_individual) : null,
      data: r.pesagens_lote_pecuarista?.data_pesagem ?? r.created_at,
      lote_nome: r.pesagens_lote_pecuarista?.lotes_pecuarista?.nome_lote ?? "—",
      lote_codigo: r.pesagens_lote_pecuarista?.lotes_pecuarista?.codigo ?? "",
    }));
    setHistorico(list);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`)}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold flex-1">Buscar por animal</h1>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="Número do animal"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscar(); } }}
          className="h-12 text-lg"
          autoFocus
        />
        <Button onClick={() => void buscar()} disabled={!numero.trim() || buscando} className="h-12">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {animalFound === false && (
        <Card className="p-6 text-center text-muted-foreground">Animal não encontrado.</Card>
      )}

      {historico && historico.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">Animal cadastrado, mas sem pesagens registradas.</Card>
      )}

      {historico && historico.length > 0 && (
        <div className="space-y-2">
          {historico.map((h, i) => (
            <Card key={i} className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">{h.peso_kg.toFixed(1)} kg</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.data).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lote: {h.lote_nome} {h.lote_codigo && `(#${h.lote_codigo})`}
                  </div>
                </div>
                <div className="text-right">
                  {h.gmd_individual != null ? (
                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">GMD</div>
                      <div className="font-semibold text-primary">{h.gmd_individual.toFixed(3)} kg/dia</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">1ª pesagem</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
