import { useEffect, useState } from "react";
import { CloudOff, Download, Loader2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useMaisArrobasSync } from "@/hooks/useMaisArrobasSync";
import { getMaSnapshot } from "@/lib/maisArrobasQueue";
import {
  baixarDadosOffline, getMaOfflineState, sincronizarOffline, subscribeMaOffline, type MaPerfil,
} from "@/lib/maOffline";

export function useMaOffline() {
  const [s, setS] = useState(getMaOfflineState);
  useEffect(() => subscribeMaOffline(() => setS(getMaOfflineState())), []);
  return s;
}

export function ModoOfflinePanel({ perfil }: { perfil: MaPerfil }) {
  const off = useMaOffline();
  const { pendingCount } = useMaisArrobasSync();
  const [busy, setBusy] = useState<"baixar" | "sync" | null>(null);

  async function ativar() {
    setBusy("baixar");
    try {
      await baixarDadosOffline(perfil);
      toast.success("App pronto para uso offline");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível baixar os dados.");
    }
    setBusy(null);
  }

  async function sincronizar() {
    setBusy("sync");
    try {
      const restantes = await sincronizarOffline();
      if (restantes > 0) {
        const detail = getMaSnapshot().lastError;
        toast.error(detail ? `Não foi possível enviar: ${detail}` : `${restantes} envio(s) ainda pendente(s).`);
      }
      else {
        toast.success("Tudo sincronizado. Modo Offline desativado.");
        window.location.reload();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sincronizar.");
    }
    setBusy(null);
  }

  return (
    <Card className={off.active ? "border-secondary" : ""}>
      <CardContent className="py-3 px-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {off.active ? <CloudOff className="w-4 h-4 text-secondary" /> : <Wifi className="w-4 h-4 text-primary" />}
          <span className="font-semibold text-foreground">{off.active ? "Modo Offline ativo" : "Modo online"}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}` : "Nada pendente"}
          </span>
        </div>
        {off.active && (
          <p className="text-xs text-muted-foreground">
            Tudo funciona sem internet. O PDF fica disponível depois de sincronizar.
          </p>
        )}
        <div className="flex gap-2">
          {!off.active && (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => void ativar()} disabled={!!busy}>
              {busy === "baixar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Modo Offline
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={() => void sincronizar()} disabled={!!busy || (!off.active && pendingCount === 0)}>
            {busy === "sync" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
