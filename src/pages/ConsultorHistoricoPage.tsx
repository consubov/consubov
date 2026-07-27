import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ChevronRight, History, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { listPendingVisitaIds } from "@/lib/consultorOffline/db";
import { isVisitaDeleted, loadAllSnapshots, softDeleteVisita } from "@/lib/consultorOffline/snapshotStore";

interface VisitaItem {
  id: string;
  tipo: string;
  status: string;
  hora_inicio: string;
  consultor_id: string;
  fazenda_consultor_id: string;
  pdf_url: string | null;
  deleted_at?: string | null;
  fazendas_consultor: { nome_fazenda: string } | null;
  _pendingLocal?: boolean;
  _localOnly?: boolean;
}

export default function ConsultorHistoricoPage() {
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<VisitaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (roleData?.consultorId) load(); }, [roleData?.consultorId]);

  async function load() {
    setLoading(true);
    const consultorId = roleData?.consultorId;
    if (!consultorId) { setVisitas([]); setLoading(false); return; }
    try {
      const online = typeof navigator === "undefined" || navigator.onLine;
      const [{ data }, snapshots, pendingIds] = await Promise.all([
        online
          ? supabase
              .from("visitas_tecnicas")
              .select("id, tipo, status, hora_inicio, consultor_id, fazenda_consultor_id, pdf_url, deleted_at, fazendas_consultor(nome_fazenda)")
              .eq("consultor_id", consultorId)
              .is("deleted_at", null)
              .order("hora_inicio", { ascending: false })
          : Promise.resolve({ data: [] }),
        loadAllSnapshots(),
        listPendingVisitaIds(),
      ]);
      const pending = new Set(pendingIds);
      const map = new Map<string, VisitaItem>();
      ((data as any as VisitaItem[]) || []).forEach((row) => {
        map.set(row.id, { ...row, _pendingLocal: pending.has(row.id) });
      });
      snapshots.forEach(({ visitaId, data: snap }) => {
        const visita = snap.visita as any;
        if (!visita) return;
        if (isVisitaDeleted(visita)) {
          map.delete(visitaId);
          return;
        }
        if (visita.consultor_id !== consultorId) return;
        const isPending = pending.has(visitaId);
        const existing = map.get(visitaId);
        if (!isPending && existing) return;
        if (!isPending && visita.status === "finalizada") return;
        const localItem: VisitaItem = {
          id: visitaId,
          tipo: visita.tipo || existing?.tipo || "rotina",
          status: visita.status || existing?.status || "rascunho",
          hora_inicio: visita.hora_inicio || existing?.hora_inicio || new Date().toISOString(),
          consultor_id: visita.consultor_id || existing?.consultor_id || consultorId,
          fazenda_consultor_id: visita.fazenda_consultor_id || existing?.fazenda_consultor_id || "",
          pdf_url: visita.pdf_url || existing?.pdf_url || null,
          fazendas_consultor: {
            nome_fazenda: snap.fazenda?.nome_fazenda || existing?.fazendas_consultor?.nome_fazenda || "Visita salva off-line",
          },
          _pendingLocal: isPending,
          _localOnly: !existing,
        };
        map.set(visitaId, localItem);
      });
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.hora_inicio).getTime() - new Date(a.hora_inicio).getTime());
      if (import.meta.env.DEV) {
        console.debug("[consultor-sync] histórico mesclado", merged.map((v) => ({
          visitaId: v.id,
          status: v.status,
          pending: !!v._pendingLocal,
          localOnly: !!v._localOnly,
        })));
      }
      setVisitas(merged);
    } catch (err: any) {
      toast.error("Erro ao carregar histórico: " + (err?.message || "desconhecido"));
      setVisitas([]);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const result = await softDeleteVisita({ visitaId: toDelete.id, visita: toDelete as any });
      removeVisitFromCachedFarmLists(toDelete.id);
      setVisitas(prev => prev.filter(v => v.id !== toDelete.id));
      toast.success(result.queued ? "Visita excluída off-line. A exclusão será sincronizada." : "Visita excluída.");
      setToDelete(null);
      await load();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err?.message || "desconhecido"));
    } finally { setDeleting(false); }
  }

  function removeVisitFromCachedFarmLists(visitaId: string) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith("consultor_offline_fazenda_")) continue;
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const cached = JSON.parse(raw);
        if (!Array.isArray(cached?.visitas)) continue;
        const visitas = cached.visitas.filter((v: any) => v?.id !== visitaId);
        window.localStorage.setItem(key, JSON.stringify({ ...cached, visitas }));
      }
    } catch {
      /* cache local é best effort; IndexedDB permanece como fonte de verdade */
    }
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
            <Card key={v.id} className="p-3 space-y-2">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/consultor/visitas/${v.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{v.fazendas_consultor?.nome_fazenda || "—"}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {v.tipo} · {format(new Date(v.hora_inicio), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Badge variant={v.status === "finalizada" && !v._pendingLocal ? "default" : "secondary"} className="capitalize shrink-0">
                  {v._pendingLocal ? "rascunho" : v.status}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="flex gap-2">
                {v.status === "finalizada" && v.pdf_url && (
                  <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
                    <a href={v.pdf_url} target="_blank" rel="noreferrer">
                      <Download className="w-4 h-4" /> Baixar PDF
                    </a>
                  </Button>
                )}
                {v._pendingLocal && (
                  <Badge variant="outline" className="shrink-0">
                    Sincronização pendente
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setToDelete(v)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? A visita será ocultada do histórico e a exclusão será sincronizada entre este aparelho e o servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
