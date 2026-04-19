import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ForcarSyncButton } from "@/components/ForcarSyncButton";

interface SyncLogRow {
  user_id: string;
  record_count_pending: number;
  last_attempt: string | null;
  last_success: string | null;
  storage_estimate_bytes: number | null;
  storage_quota_bytes: number | null;
}

interface CapatazRow {
  id: string;
  nome: string;
  user_id: string | null;
  retiro_id: string | null;
  retiro_nome: string | null;
  fazenda_id: string | null;
  fazenda_nome: string | null;
  log?: SyncLogRow;
}

interface FazendaOpt { id: string; nome: string }
interface RetiroOpt { id: string; nome: string; fazenda_id: string }

interface Props {
  /** Restrict to specific fazendas. If undefined → all (Admin). */
  fazendaIdsScope?: string[];
  /** Optional title override. */
  title?: string;
}

const ALL = "__all__";

function formatTime(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return null;
  }
}

export default function SyncCapatazPanel({ fazendaIdsScope, title = "Sincronização dos Capatazes" }: Props) {
  const [loading, setLoading] = useState(true);
  const [fazendas, setFazendas] = useState<FazendaOpt[]>([]);
  const [retiros, setRetiros] = useState<RetiroOpt[]>([]);
  const [capatazes, setCapatazes] = useState<CapatazRow[]>([]);
  const [logs, setLogs] = useState<Map<string, SyncLogRow>>(new Map());

  const [fazendaId, setFazendaId] = useState<string>(ALL);
  const [retiroId, setRetiroId] = useState<string>(ALL);
  const [capatazId, setCapatazId] = useState<string>(ALL);
  const [bulkSending, setBulkSending] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let fazQuery = supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome");
      if (fazendaIdsScope && fazendaIdsScope.length > 0) fazQuery = fazQuery.in("id", fazendaIdsScope);
      const [fazRes, retRes, capRes, logRes] = await Promise.all([
        fazQuery,
        supabase.from("retiros").select("id, nome, fazenda_id").eq("ativo", true).order("nome"),
        supabase
          .from("capatazes")
          .select("id, nome, user_id, retiro_id, retiros(id, nome, fazenda_id, fazendas(id, nome))")
          .eq("ativo", true)
          .order("nome"),
        supabase.from("sync_log").select("*"),
      ]);

      if (fazRes.error) throw fazRes.error;
      const fazList = (fazRes.data ?? []) as FazendaOpt[];
      const allowedFaz = new Set(fazList.map((f) => f.id));

      const retList = ((retRes.data ?? []) as RetiroOpt[]).filter((r) => allowedFaz.has(r.fazenda_id));

      const capList: CapatazRow[] = ((capRes.data ?? []) as any[])
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          user_id: c.user_id,
          retiro_id: c.retiro_id,
          retiro_nome: c.retiros?.nome ?? null,
          fazenda_id: c.retiros?.fazenda_id ?? null,
          fazenda_nome: c.retiros?.fazendas?.nome ?? null,
        }))
        .filter((c) => c.fazenda_id && allowedFaz.has(c.fazenda_id));

      const logMap = new Map<string, SyncLogRow>(
        ((logRes.data ?? []) as SyncLogRow[]).map((l) => [l.user_id, l]),
      );

      setFazendas(fazList);
      setRetiros(retList);
      setCapatazes(capList);
      setLogs(logMap);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + (err?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [fazendaIdsScope]);

  useEffect(() => {
    void fetchAll();
    const channel = supabase
      .channel("sync-capataz-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_log" }, () => void fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Cascading reset
  const handleFazendaChange = (v: string) => {
    setFazendaId(v);
    setRetiroId(ALL);
    setCapatazId(ALL);
  };
  const handleRetiroChange = (v: string) => {
    setRetiroId(v);
    setCapatazId(ALL);
  };

  // Filtered options
  const retirosFiltered = useMemo(
    () => (fazendaId === ALL ? retiros : retiros.filter((r) => r.fazenda_id === fazendaId)),
    [retiros, fazendaId],
  );

  const capatazesByFilter = useMemo(() => {
    return capatazes.filter((c) => {
      if (fazendaId !== ALL && c.fazenda_id !== fazendaId) return false;
      if (retiroId !== ALL && c.retiro_id !== retiroId) return false;
      if (capatazId !== ALL && c.id !== capatazId) return false;
      return true;
    });
  }, [capatazes, fazendaId, retiroId, capatazId]);

  const capatazOptions = useMemo(() => {
    return capatazes.filter((c) => {
      if (fazendaId !== ALL && c.fazenda_id !== fazendaId) return false;
      if (retiroId !== ALL && c.retiro_id !== retiroId) return false;
      return true;
    });
  }, [capatazes, fazendaId, retiroId]);

  const handleBulkSync = async () => {
    const targets = capatazesByFilter.filter((c) => !!c.user_id);
    if (targets.length === 0) {
      toast.error("Nenhum capataz com conta vinculada na seleção atual");
      return;
    }
    setBulkSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const senderId = sessionData?.session?.user?.id ?? null;
      const rows = targets.map((c) => ({
        target_user_id: c.user_id!,
        sender_user_id: senderId,
        command: "sync",
      }));
      const { error } = await supabase.from("sync_commands").insert(rows);
      if (error) throw error;
      toast.success(`Sinal enviado para ${targets.length} capataz(es)`);
    } catch (err: any) {
      toast.error("Erro ao enviar em lote: " + (err?.message ?? "desconhecido"));
    } finally {
      setBulkSending(false);
    }
  };

  const showBulkButton = capatazId === ALL && capatazesByFilter.length > 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fazenda</label>
            <Select value={fazendaId} onValueChange={handleFazendaChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as fazendas</SelectItem>
                {fazendas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Retiro</label>
            <Select value={retiroId} onValueChange={handleRetiroChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os retiros</SelectItem>
                {retirosFiltered.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Capataz</label>
            <Select value={capatazId} onValueChange={setCapatazId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os capatazes</SelectItem>
                {capatazOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showBulkButton && (
          <div className="flex justify-end">
            <Button onClick={handleBulkSync} disabled={bulkSending} variant="default" size="sm">
              {bulkSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Forçar Sync em Todos ({capatazesByFilter.length})
            </Button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : capatazesByFilter.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhum capataz encontrado com os filtros selecionados.
          </p>
        ) : (
          <div className="space-y-2">
            {capatazesByFilter.map((c) => {
              const log = c.user_id ? logs.get(c.user_id) : undefined;
              const pending = log?.record_count_pending ?? 0;
              const lastSync = log?.last_success ?? null;
              const lastSyncFormatted = formatTime(lastSync);
              const neverSynced = !lastSync;

              return (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="w-full sm:flex-1 min-w-0">
                    <div className="font-medium text-foreground break-words whitespace-normal">{c.nome}</div>
                    <div className="text-xs text-muted-foreground break-words whitespace-normal">
                      {c.retiro_nome ?? "—"}
                      {c.fazenda_nome ? ` · ${c.fazenda_nome}` : ""}
                    </div>
                    {!neverSynced && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Último sync: {lastSyncFormatted}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    {neverSynced ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Nunca sincronizou
                      </Badge>
                    ) : pending > 0 ? (
                      <Badge className="gap-1 bg-yellow-500/15 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/20 dark:text-yellow-400">
                        <AlertTriangle className="w-3 h-3" />
                        {pending} pendente{pending > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Em dia
                      </Badge>
                    )}
                    <ForcarSyncButton
                      targetUserId={c.user_id}
                      targetName={c.nome}
                      size="sm"
                      variant="outline"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
