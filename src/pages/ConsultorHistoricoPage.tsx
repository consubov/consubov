import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, History, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VisitaItem {
  id: string;
  tipo: string;
  status: string;
  hora_inicio: string;
  fazenda_consultor_id: string;
  pdf_url: string | null;
  fazendas_consultor: { nome_fazenda: string } | null;
}

export default function ConsultorHistoricoPage() {
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (roleData?.consultorId) load(); }, [roleData?.consultorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("visitas_tecnicas")
      .select("id, tipo, status, hora_inicio, fazenda_consultor_id, pdf_url, fazendas_consultor(nome_fazenda)")
      .eq("consultor_id", roleData.consultorId!)
      .order("hora_inicio", { ascending: false });
    setVisitas((data as any as VisitaItem[]) || []);
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <History className="w-5 h-5" /> Histórico de Visitas
      </h1>

      {visitas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma visita registrada ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {visitas.map(v => (
            <Card
              key={v.id}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/consultor/visitas/${v.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{v.fazendas_consultor?.nome_fazenda || "—"}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {v.tipo} · {format(new Date(v.hora_inicio), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}
                </div>
              </div>
              <Badge variant={v.status === "finalizada" ? "default" : "secondary"} className="capitalize shrink-0">
                {v.status}
              </Badge>
              {v.pdf_url && (
                <a
                  href={v.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                  title="Abrir PDF"
                >
                  <FileText className="w-4 h-4" />
                </a>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
