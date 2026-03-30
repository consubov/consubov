import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, TreePine, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Pasto = Tables<"pastos">;
type Retiro = Tables<"retiros">;
type Fazenda = Tables<"fazendas">;

export default function PastoDetailPage() {
  const { fazendaId, retiroId, pastoId } = useParams<{ fazendaId: string; retiroId: string; pastoId: string }>();
  const navigate = useNavigate();
  const [pasto, setPasto] = useState<Pasto | null>(null);
  const [retiro, setRetiro] = useState<Retiro | null>(null);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!pastoId || !retiroId || !fazendaId) return;
    const [pastoRes, retiroRes, fazendaRes] = await Promise.all([
      supabase.from("pastos").select("*").eq("id", pastoId).single(),
      supabase.from("retiros").select("*").eq("id", retiroId).single(),
      supabase.from("fazendas").select("*").eq("id", fazendaId).single(),
    ]);
    if (pastoRes.error) {
      toast.error("Pasto não encontrado.");
      navigate(`/admin/fazendas/${fazendaId}/retiros/${retiroId}`);
      return;
    }
    setPasto(pastoRes.data);
    setRetiro(retiroRes.data);
    setFazenda(fazendaRes.data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [pastoId]);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!pasto || !retiro || !fazenda) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>{fazenda.nome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}/retiros/${retiroId}`}>{retiro.nome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{pasto.nome}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(`/admin/fazendas/${fazendaId}/retiros/${retiroId}`)}>
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TreePine className="w-5 h-5" /> {pasto.nome}</CardTitle>
            <Badge variant={pasto.ativo ? "default" : "secondary"}>{pasto.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Retiro:</span> {retiro.nome}</div>
            <div><span className="text-muted-foreground">Fazenda:</span> {fazenda.nome}</div>
            <div><span className="text-muted-foreground">Animais:</span> {pasto.num_animais}</div>
            <div><span className="text-muted-foreground">Peso Médio:</span> {pasto.peso_medio_kg ? `${pasto.peso_medio_kg} kg` : "—"}</div>
            <div><span className="text-muted-foreground">Categoria:</span> {pasto.categoria ?? "—"}</div>
            <div><span className="text-muted-foreground">Sexo:</span> {pasto.sexo ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Lançamentos</h2>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Módulo de lançamentos em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}
