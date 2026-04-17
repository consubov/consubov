import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePainelPeriodo } from "@/hooks/usePainelPeriodo";
import { useMapaData } from "@/hooks/useMapaData";
import type { PastoMapaData } from "@/hooks/useMapaData";

import MonthScroller from "@/components/MonthScroller";
import MapaViewer from "@/components/mapa/MapaViewer";
import MapaEditor from "@/components/mapa/MapaEditor";
import PastoInfoModal from "@/components/mapa/PastoInfoModal";
import MapaActionSheet from "@/components/mapa/MapaActionSheet";
import MapaTransferenciaModal from "@/components/mapa/MapaTransferenciaModal";
import MapaAbateModal from "@/components/mapa/MapaAbateModal";
import EditarPesoModal from "@/components/mapa/EditarPesoModal";
import MapaEntradaAnimaisModal from "@/components/mapa/MapaEntradaAnimaisModal";
import SelecionarEventoModal, { type TipoEvento } from "@/components/eventos/SelecionarEventoModal";
import SanitarioFormModal, { type SanitarioFormData } from "@/components/eventos/SanitarioFormModal";
import PesagemFlowModal from "@/components/eventos/PesagemFlowModal";
import ObservacaoLoteModal from "@/components/eventos/ObservacaoLoteModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, Pencil, Map, RefreshCw, Beef } from "lucide-react";

type MapAction = null | "action" | "info" | "transferir" | "abater" | "editarPeso" | "selectDestino" | "entrada";

export default function MapaFazendaPage() {
  const { fazendaId, retiroId } = useParams<{ fazendaId?: string; retiroId?: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const userName = (user?.user_metadata as any)?.nome || user?.email || "";
  const { mes, ano, setPeriodo } = usePainelPeriodo();

  const [resolvedFazendaId, setResolvedFazendaId] = useState<string | null>(fazendaId ?? null);
  const [retiroNome, setRetiroNome] = useState("Retiro");
  const [fazendaNome, setFazendaNome] = useState("Fazenda");
  const [resolving, setResolving] = useState(!fazendaId);

  useEffect(() => {
    if (!retiroId) return;
    async function resolve() {
      setResolving(true);
      const { data: retiro } = await supabase
        .from("retiros")
        .select("fazenda_id, nome")
        .eq("id", retiroId!)
        .maybeSingle();
      if (retiro) {
        setResolvedFazendaId(retiro.fazenda_id);
        setRetiroNome(retiro.nome);
        const { data: faz } = await supabase
          .from("fazendas")
          .select("nome")
          .eq("id", retiro.fazenda_id)
          .maybeSingle();
        if (faz) setFazendaNome(faz.nome);
      }
      setResolving(false);
    }
    resolve();
  }, [retiroId]);

  useEffect(() => {
    if (!fazendaId || !retiroId) return;
    setResolvedFazendaId(fazendaId);
    async function loadNames() {
      const [retRes, fazRes] = await Promise.all([
        supabase.from("retiros").select("nome").eq("id", retiroId!).maybeSingle(),
        supabase.from("fazendas").select("nome").eq("id", fazendaId!).maybeSingle(),
      ]);
      if (retRes.data) setRetiroNome(retRes.data.nome);
      if (fazRes.data) setFazendaNome(fazRes.data.nome);
    }
    loadNames();
  }, [fazendaId, retiroId]);

  const activeFazendaId = fazendaId ?? resolvedFazendaId;
  const activeRetiroId = retiroId ?? "";
  const { loading, mapa, refresh } = useMapaData(activeFazendaId ?? undefined, mes, ano, retiroId);
  const totalAnimaisRetiro = (mapa?.pastos ?? []).reduce((sum, p) => sum + (p.num_animais || 0), 0);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Action state
  const [currentAction, setCurrentAction] = useState<MapAction>(null);
  const [selectedPasto, setSelectedPasto] = useState<PastoMapaData | null>(null);
  const [destinoPasto, setDestinoPasto] = useState<PastoMapaData | null>(null);

  // Evento modals state
  const [eventoSelectorOpen, setEventoSelectorOpen] = useState(false);
  const [sanitarioOpen, setSanitarioOpen] = useState(false);
  const [pesagemOpen, setPesagemOpen] = useState(false);
  const [observacaoLoteOpen, setObservacaoLoteOpen] = useState(false);
  const [combinedMode, setCombinedMode] = useState(false);
  const [pendingSanitarioData, setPendingSanitarioData] = useState<SanitarioFormData | null>(null);

  const isAdmin = role === "administrador";
  const canEditMapa = isAdmin && Boolean(fazendaId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handlePastoClick = (pasto: PastoMapaData) => {
    // If selecting destination for transfer
    if (currentAction === "selectDestino" && selectedPasto && pasto.pasto_id !== selectedPasto.pasto_id) {
      setDestinoPasto(pasto);
      setCurrentAction("transferir");
      return;
    }

    // Normal click → show action sheet
    setSelectedPasto(pasto);
    setDestinoPasto(null);
    setCurrentAction("action");
  };

  const resetAction = () => {
    setCurrentAction(null);
    setSelectedPasto(null);
    setDestinoPasto(null);
  };

  const handleActionDone = async () => {
    resetAction();
    await refresh();
  };

  if (resolving || loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {canEditMapa && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>{fazendaNome}</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}/retiros/${retiroId}`}>{retiroNome}</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Mapa</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          {currentAction === "selectDestino" && (
            <Button size="sm" variant="outline" onClick={resetAction}>Cancelar seleção</Button>
          )}
          {canEditMapa && mapa && !editing && (
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
        <Map className="w-5 h-5" /> Mapa — {retiroNome}
      </h1>

      <Card className="p-2">
        <MonthScroller selectedMonth={mes} selectedYear={ano} onChange={(m, y) => setPeriodo(m, y)} />
      </Card>

      {editing && canEditMapa ? (
        <MapaEditor
          fazendaId={activeFazendaId!}
          mapaId={mapa?.id}
          imagemUrl={mapa?.imagem_url}
          existingPolygons={mapa?.pastos.map((p) => ({
            id: p.id,
            pasto_id: p.pasto_id,
            coordenadas: p.coordenadas,
            cor: p.cor || "#16a34a",
          }))}
          existingLines={(mapa?.linhas ?? []).map((l) => ({
            id: l.id,
            coordenadas: l.coordenadas,
            cor: l.cor,
            tipo: l.tipo,
            rotulo: l.rotulo || "",
          }))}
          existingElements={(mapa?.elementos ?? []).map((e) => ({
            id: e.id,
            tipo: e.tipo,
            emoji: e.emoji,
            posicao_x: e.posicao_x,
            posicao_y: e.posicao_y,
            rotulo: e.rotulo || "",
          }))}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : mapa ? (
        <MapaViewer
          mapa={mapa}
          onPastoClick={handlePastoClick}
          selectedPastoId={selectedPasto?.pasto_id}
          selectingDestino={currentAction === "selectDestino"}
          highlightDestinos={currentAction === "selectDestino"}
        />
      ) : canEditMapa ? (
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
          <p className="text-muted-foreground text-sm">Este retiro ainda não possui mapa cadastrado.</p>
        </div>
      )}

      {/* Resumo de animais no retiro */}
      {mapa && mapa.pastos.length > 0 && (
        <Card className="p-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
            <Beef className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de animais no retiro</p>
            <p className="text-lg font-bold text-foreground">
              {totalAnimaisRetiro.toLocaleString("pt-BR")} <span className="text-sm font-medium text-muted-foreground">cab</span>
            </p>
          </div>
        </Card>
      )}

      {/* Action Sheet */}
      <MapaActionSheet
        open={currentAction === "action"}
        onClose={resetAction}
        pasto={selectedPasto}
        onVerDetalhes={() => setCurrentAction("info")}
        onTransferir={() => setCurrentAction("transferir")}
        onAbater={() => setCurrentAction("abater")}
        onEditarPeso={() => setCurrentAction("editarPeso")}
        onEntrada={() => setCurrentAction("entrada")}
        onRegistrarEvento={() => {
          setCurrentAction(null);
          setEventoSelectorOpen(true);
        }}
      />

      {/* Info Modal */}
      <PastoInfoModal
        open={currentAction === "info"}
        onOpenChange={(open) => !open && resetAction()}
        pasto={selectedPasto}
      />

      {/* Transferência Modal */}
      <MapaTransferenciaModal
        open={currentAction === "transferir"}
        onClose={resetAction}
        pasto={selectedPasto}
        allPastos={mapa?.pastos ?? []}
        fazendaId={activeFazendaId ?? ""}
        retiroId={activeRetiroId}
        mes={mes}
        ano={ano}
        onDone={handleActionDone}
        selectedDestino={destinoPasto}
        onSelectDestino={() => setCurrentAction("selectDestino")}
      />

      {/* Abate Modal */}
      <MapaAbateModal
        open={currentAction === "abater"}
        onClose={resetAction}
        pasto={selectedPasto}
        fazendaId={activeFazendaId ?? ""}
        retiroId={activeRetiroId}
        mes={mes}
        ano={ano}
        onDone={handleActionDone}
      />

      {/* Editar Peso Modal */}
      <EditarPesoModal
        open={currentAction === "editarPeso"}
        onClose={resetAction}
        pasto={selectedPasto}
        onDone={handleActionDone}
      />

      {/* Entrada Animais Modal */}
      <MapaEntradaAnimaisModal
        open={currentAction === "entrada"}
        onClose={resetAction}
        pasto={selectedPasto}
        fazendaId={activeFazendaId ?? ""}
        retiroId={activeRetiroId}
        mes={mes}
        ano={ano}
        onDone={handleActionDone}
      />

      {/* Evento Modals */}
      {selectedPasto && (
        <>
          <SelecionarEventoModal
            open={eventoSelectorOpen}
            onClose={() => setEventoSelectorOpen(false)}
            pastoNome={selectedPasto.pasto_nome}
            onSelect={(tipo: TipoEvento) => {
              setEventoSelectorOpen(false);
              if (tipo === "pesagem") {
                setCombinedMode(false);
                setPendingSanitarioData(null);
                setPesagemOpen(true);
              } else if (tipo === "sanitario") {
                setCombinedMode(false);
                setSanitarioOpen(true);
              } else if (tipo === "pesagem_sanitario") {
                setCombinedMode(true);
                setSanitarioOpen(true);
              } else if (tipo === "observacao") {
                setObservacaoLoteOpen(true);
              }
            }}
          />

          <SanitarioFormModal
            open={sanitarioOpen}
            onClose={() => { setSanitarioOpen(false); setCombinedMode(false); }}
            pastoId={selectedPasto.pasto_id}
            pastoNome={selectedPasto.pasto_nome}
            numAnimais={selectedPasto.num_animais}
            userId={user?.id || ""}
            userName={userName}
            collectOnly={combinedMode}
            onCollected={(data) => {
              setPendingSanitarioData(data);
              setSanitarioOpen(false);
              setPesagemOpen(true);
            }}
            onSaved={() => refresh()}
          />

          <PesagemFlowModal
            open={pesagemOpen}
            onClose={() => { setPesagemOpen(false); setPendingSanitarioData(null); }}
            pastoId={selectedPasto.pasto_id}
            pastoNome={selectedPasto.pasto_nome}
            numAnimais={selectedPasto.num_animais}
            pesoMedioAtual={(selectedPasto as any).peso_medio_kg ?? null}
            userId={user?.id || ""}
            userName={userName}
            fazendaId={activeFazendaId ?? ""}
            fazendaNome={fazendaNome}
            retiroNome={retiroNome}
            retiroId={activeRetiroId}
            sanitarioData={pendingSanitarioData}
            onSaved={() => refresh()}
          />

          <ObservacaoLoteModal
            open={observacaoLoteOpen}
            onClose={() => setObservacaoLoteOpen(false)}
            pastoId={selectedPasto.pasto_id}
            pastoNome={selectedPasto.pasto_nome}
            userId={user?.id || ""}
            onSaved={() => refresh()}
          />
        </>
      )}
    </div>
  );
}
