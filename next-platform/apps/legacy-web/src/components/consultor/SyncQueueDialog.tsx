import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getPendingVisitaDebugInfos, type PendingVisitaDebugInfo } from "@/lib/consultorOffline/useSyncStatus";
import { getErrorMessage } from "@/lib/consultorOffline/network";
import { forceFullSync } from "@/lib/consultorOffline/photoQueue";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: number;
  mutPending: number;
  photoPending: number;
}

export default function SyncQueueDialog({ open, onOpenChange, pending, mutPending, photoPending }: Props) {
  const uiText = useStaticUiText();
  const { language } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<PendingVisitaDebugInfo[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getPendingVisitaDebugInfos({ includeDeleted: true }));
    } catch (err) {
      toast.error(`${uiText("Erro ao ler fila local: ")}${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const forcarSync = async () => {
    setSyncing(true);
    try {
      await forceFullSync();
      toast.success(uiText("Sincronização forçada concluída. Confira os itens restantes abaixo."));
    } catch (err) {
      toast.error(`${uiText("Falha ao forçar sincronização: ")}${getErrorMessage(err)}`);
    } finally {
      setSyncing(false);
      await load();
    }
  };

  const descartarIrrecuperaveis = async (visitaId: string) => {
    setSyncing(true);
    try {
      const { discardUnrecoverableForVisita } = await import("@/lib/consultorOffline/discardOrphans");
      const res = await discardUnrecoverableForVisita(visitaId);
      if (res.descartados.length === 0) {
        toast.info(uiText("Nenhum item irrecuperável encontrado nesta visita."));
      } else {
        const nomes = res.descartados.map((d) => `${d.kind} ${d.parentId.slice(0, 8)}…`).join(", ");
        toast.success(`${uiText("Descartados ")}${res.mutations}${uiText(" dado(s) e ")}${res.fotos}${uiText(" foto(s) de: ")}${nomes}${uiText(". Esses registros precisam ser refeitos presencialmente.")}`);
      }
    } catch (err) {
      toast.error(`${uiText("Falha ao descartar itens: ")}${getErrorMessage(err)}`);
    } finally {
      setSyncing(false);
      await load();
    }
  };


  useEffect(() => {
    if (open) void load();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle><LocalizedText source={"Fila de sincronização"} /></DialogTitle>
          <DialogDescription>
            <LocalizedText source={"Itens locais detectados no Consultor. Registros excluídos são mostrados para diagnóstico, mas não entram na contagem do badge."} /></DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{pending} <LocalizedText source={"visita(s) contada(s) ·"} />{" "}{mutPending} <LocalizedText source={"alteração(ões) ·"} />{" "}{photoPending} <LocalizedText source={"foto(s)"} /></span>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void forcarSync()} disabled={syncing || loading}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocalizedText source={"Forçar sincronização"} />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || syncing}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocalizedText source={"Atualizar"} />}
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto space-y-2 pr-1">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> <LocalizedText source={"Lendo fila local…"} /></div>
          ) : items.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground"><LocalizedText source={"Nenhum item na fila local."} /></div>
          ) : items.map((item) => (
            <div key={item.visitaId} className="rounded-md border p-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{item.fazenda}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.tipo} · {item.data ? new Date(item.data).toLocaleString(language) : uiText("data não identificada")}
                  </div>
                </div>
                <Badge variant={item.deleted ? "destructive" : "secondary"} className="shrink-0">
                  {uiText(item.deleted ? "Excluída · ignorada" : "Contada")}
                </Badge>
              </div>
              {item.deletedAt && <div className="text-xs text-destructive"><LocalizedText source={"deleted_at:"} />{" "}{item.deletedAt}</div>}
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div>ID: <span className="font-mono break-all">{item.visitaId}</span></div>
                <div><LocalizedText source={"Alterações:"} />{" "}{item.mutationTables.length ? item.mutationTables.join(", ") : uiText("nenhuma")}</div>
                <div><LocalizedText source={"Fotos:"} />{" "}{item.photoParents.length ? item.photoParents.join(", ") : uiText("nenhuma")}</div>
                {item.oldestCreatedAt && <div><LocalizedText source={"Na fila desde:"} />{" "}{new Date(item.oldestCreatedAt).toLocaleString(language)}</div>}
                {item.mutationErrors.length > 0 && <div className="text-destructive"><LocalizedText source={"Motivo (dados):"} />{" "}{item.mutationErrors.join("; ")}</div>}
                {item.photoErrors.length > 0 && <div className="text-destructive"><LocalizedText source={"Motivo (fotos):"} />{" "}{item.photoErrors.join("; ")}</div>}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={syncing || loading}
                  onClick={() => void descartarIrrecuperaveis(item.visitaId)}
                >
                  <LocalizedText source={"Descartar itens irrecuperáveis"} /></Button>
              </div>
            </div>
          ))}

        </div>
      </DialogContent>
    </Dialog>
  );
}
