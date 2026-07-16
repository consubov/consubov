import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Play, ArrowLeft, ChevronRight, Landmark } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fazenda {
  id: string;
  nome_fazenda: string;
  proprietario: string | null;
  responsavel: string | null;
  municipio: string | null;
  uf: string | null;
}

interface Visita {
  id: string;
  tipo: string;
  status: string;
  hora_inicio: string;
  hora_fim: string | null;
}

export default function ConsultorFazendaDetalhePage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoModal, setTipoModal] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (fazendaId) load(); }, [fazendaId]);

  async function load() {
    setLoading(true);
    const [fRes, vRes] = await Promise.all([
      supabase.from("fazendas_consultor").select("*").eq("id", fazendaId!).maybeSingle(),
      supabase.from("visitas_tecnicas").select("id, tipo, status, hora_inicio, hora_fim")
        .eq("fazenda_consultor_id", fazendaId!)
        .order("hora_inicio", { ascending: false }),
    ]);
    setFazenda(fRes.data as Fazenda | null);
    setVisitas((vRes.data as Visita[]) || []);
    setLoading(false);
  }

  async function prepararOffline() {
    setPreparing(true);
    try {
      // Pré-carrega dados do consultor (logo, preferências) para uso offline
      if (roleData?.consultorId) {
        await supabase.from("consultores").select("*").eq("id", roleData.consultorId).maybeSingle();
      }
      // Pré-carrega detalhes da fazenda
      if (fazendaId) {
        await supabase.from("fazendas_consultor").select("*").eq("id", fazendaId).maybeSingle();
      }
      // Pequena espera para dar feedback visual mesmo em conexões rápidas
      await new Promise((r) => setTimeout(r, 700));
    } catch {
      /* segue mesmo se offline */
    } finally {
      setPreparing(false);
      setTipoModal(true);
    }
  }

  async function iniciarVisita(tipo: "rotina" | "confinamento" | "fabrica") {
    if (!roleData?.consultorId || !fazendaId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("visitas_tecnicas").insert({
        consultor_id: roleData.consultorId,
        fazenda_consultor_id: fazendaId,
        tipo,
        status: "rascunho",
        hora_inicio: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      setTipoModal(false);
      navigate(`/consultor/visitas/${data.id}`);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setCreating(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!fazenda) return <div className="text-center text-muted-foreground py-12">Fazenda não encontrada</div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/consultor")} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Landmark className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">{fazenda.nome_fazenda}</h1>
            {fazenda.proprietario && <div className="text-sm text-muted-foreground">{fazenda.proprietario}</div>}
            {fazenda.responsavel && <div className="text-xs text-muted-foreground">Responsável: {fazenda.responsavel}</div>}
            {(fazenda.municipio || fazenda.uf) && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {[fazenda.municipio, fazenda.uf].filter(Boolean).join("/")}
              </div>
            )}
          </div>
        </div>
        <Button onClick={prepararOffline} disabled={preparing} className="w-full gap-2 bg-primary hover:bg-primary/90 mt-2">
          {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {preparing ? "Preparando para uso off-line..." : "Iniciar Visita"}
        </Button>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Visitas anteriores</h2>
        {visitas.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma visita registrada.</Card>
        ) : (
          <div className="space-y-2">
            {visitas.map(v => (
              <Card
                key={v.id}
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/consultor/visitas/${v.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground capitalize">{v.tipo}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(v.hora_inicio), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Badge variant={v.status === "finalizada" ? "default" : "secondary"} className="capitalize">
                  {v.status}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={tipoModal} onOpenChange={setTipoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tipo de Visita</DialogTitle>
            <DialogDescription>Escolha o tipo de visita que deseja iniciar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 justify-start flex-col items-start"
              onClick={() => iniciarVisita("rotina")}
              disabled={creating}
            >
              <div className="font-semibold text-base">Rotina</div>
              <div className="text-xs text-muted-foreground font-normal">Avaliação de pastos, cocho, escore corporal</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start flex-col items-start"
              onClick={() => iniciarVisita("confinamento")}
              disabled={creating}
            >
              <div className="font-semibold text-base">Confinamento</div>
              <div className="text-xs text-muted-foreground font-normal">Avaliação sequencial de currais</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start flex-col items-start"
              onClick={() => iniciarVisita("fabrica")}
              disabled={creating}
            >
              <div className="font-semibold text-base">Fábrica</div>
              <div className="text-xs text-muted-foreground font-normal">Avaliação da fábrica/insumos com tópicos livres</div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
