import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import { useMapaData } from "@/hooks/useMapaData";
import type { PastoMapaData } from "@/hooks/useMapaData";
import MonthScroller from "@/components/MonthScroller";
import MapaViewer from "@/components/mapa/MapaViewer";
import MapaEditor from "@/components/mapa/MapaEditor";
import PastoInfoModal from "@/components/mapa/PastoInfoModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, Pencil, Map, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MapaFazendaPage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { mes, ano, setPeriodo } = usePainelPeriodo();
  const { loading, mapa, refresh } = useMapaData(fazendaId, mes, ano);
  const [editing, setEditing] = useState(false);
  const [selectedPasto, setSelectedPasto] = useState<PastoMapaData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === "administrador";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>Fazenda</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Mapa</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          {isAdmin && mapa && !editing && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4" /> Editar Mapa
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Map className="w-5 h-5" /> Mapa da Fazenda
      </h1>

      <Card className="p-2">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(m, y) => setPeriodo(m, y)} />
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
          <span>Na meta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ca8a04]" />
          <span>Atenção</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#dc2626]" />
          <span>Fora da meta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#64748b]" />
          <span>Sem dados</span>
        </div>
      </div>

      {editing && isAdmin ? (
        <MapaEditor
          fazendaId={fazendaId!}
          mapaId={mapa?.id}
          imagemUrl={mapa?.imagem_url}
          existingPolygons={mapa?.pastos.map((p) => ({
            id: p.id,
            pasto_id: p.pasto_id,
            coordenadas: p.coordenadas,
          }))}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : mapa ? (
        <MapaViewer mapa={mapa} onPastoClick={(p) => setSelectedPasto(p)} />
      ) : isAdmin ? (
        <div className="text-center py-12 space-y-3">
          <Map className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Nenhum mapa cadastrado para esta fazenda.</p>
          <Button onClick={() => setEditing(true)} className="gap-1.5">
            <Map className="w-4 h-4" /> Adicionar Mapa
          </Button>
        </div>
      ) : (
        <div className="text-center py-12">
          <Map className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum mapa disponível.</p>
        </div>
      )}

      <PastoInfoModal
        open={!!selectedPasto}
        onOpenChange={(open) => !open && setSelectedPasto(null)}
        pasto={selectedPasto}
      />
    </div>
  );
}
