import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ForcarSyncButton } from "@/components/ForcarSyncButton";
import { formatBytes } from "@/lib/storageProtection";
import type { PendingBackup } from "@/lib/backupMirror";

interface SyncLogRow {
  user_id: string;
  record_count_pending: number;
  last_attempt: string | null;
  last_success: string | null;
  storage_estimate_bytes: number | null;
  storage_quota_bytes: number | null;
  updated_at: string;
}

interface CapatazWithLog {
  id: string;
  nome: string;
  user_id: string | null;
  retiro_nome?: string | null;
  log?: SyncLogRow;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function RecuperarDadosPage() {
  const [rows, setRows] = useState<CapatazWithLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [capatazesRes, logsRes] = await Promise.all([
        supabase
          .from("capatazes")
          .select("id, nome, user_id, retiro_id, retiros(nome)")
          .eq("ativo", true)
          .order("nome"),
        supabase.from("sync_log").select("*"),
      ]);

      const logsByUser = new Map<string, SyncLogRow>(
        (logsRes.data ?? []).map((l: any) => [l.user_id, l]),
      );

      const merged: CapatazWithLog[] = (capatazesRes.data ?? []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        user_id: c.user_id,
        retiro_nome: c.retiros?.nome ?? null,
        log: c.user_id ? logsByUser.get(c.user_id) : undefined,
      }));

      // Sort: pending first, then by name
      merged.sort((a, b) => {
        const ap = a.log?.record_count_pending ?? 0;
        const bp = b.log?.record_count_pending ?? 0;
        if (ap !== bp) return bp - ap;
        return a.nome.localeCompare(b.nome);
      });

      setRows(merged);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + (err?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();

    // Realtime — refresh when any sync_log row updates
    const channel = supabase
      .channel("admin-sync-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_log" }, () => {
        void fetchData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as PendingBackup;
      if (!data || typeof data !== "object") throw new Error("Formato inválido");

      let imported = 0;
      let failed = 0;

      // 1) lancamentos
      for (const l of data.lancamentos ?? []) {
        try {
          // Map offline shape → DB shape (best-effort; skip unknown fields)
          const insertData: any = {
            id: l.id,
            pasto_id: l.pasto_id,
            num_sacos: l.sacos ?? 0,
            cocho_cheio: !!l.cocho_cheio,
            ciclo_id: l.ciclo_id ?? null,
            origem: l.tipo === "falha_qr" ? "manual" : "qr_code",
          };
          // Required columns may be missing — only insert if we have the basics
          if (!insertData.pasto_id) {
            failed++;
            continue;
          }
          const { error } = await supabase.from("lancamentos").upsert(insertData, { onConflict: "id" });
          if (error) failed++;
          else imported++;
        } catch {
          failed++;
        }
      }

      // 2) observacoes
      for (const o of data.observacoes ?? []) {
        try {
          const { error } = await supabase.from("observacoes").upsert({
            id: o.id,
            pasto_id: o.pasto_id,
            retiro_id: o.retiro_id,
            fazenda_id: o.fazenda_id,
            capataz_nome: o.capataz_nome,
            tipo: o.tipo,
            descricao: o.descricao,
            foto_url: o.foto_url,
            criado_em: o.criado_em,
          } as any, { onConflict: "id" });
          if (error) failed++;
          else imported++;
        } catch {
          failed++;
        }
      }

      toast.success(`Importação concluída: ${imported} sucesso(s), ${failed} falha(s)`);
      void fetchData();
    } catch (err: any) {
      toast.error("Falha ao importar JSON: " + (err?.message ?? "desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Recuperar Dados</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild variant="default" size="sm" disabled={importing}>
              <span>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Importar JSON de emergência
              </span>
            </Button>
          </label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de sincronização por capataz</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capataz</TableHead>
                  <TableHead>Retiro</TableHead>
                  <TableHead>Pendentes</TableHead>
                  <TableHead>Último sync</TableHead>
                  <TableHead>Última tentativa</TableHead>
                  <TableHead>Armazenamento</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum capataz cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((c) => {
                    const pending = c.log?.record_count_pending ?? 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.retiro_nome || "—"}</TableCell>
                        <TableCell>
                          {pending > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {pending}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">0</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{formatTime(c.log?.last_success ?? null)}</TableCell>
                        <TableCell className="text-xs">{formatTime(c.log?.last_attempt ?? null)}</TableCell>
                        <TableCell className="text-xs">
                          {c.log?.storage_estimate_bytes != null
                            ? `${formatBytes(c.log.storage_estimate_bytes)} / ${formatBytes(c.log.storage_quota_bytes)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <ForcarSyncButton targetUserId={c.user_id} targetName={c.nome} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Os dados de cada capataz são reportados automaticamente após cada tentativa de sincronização.
        Use "Importar JSON de emergência" se um capataz enviar manualmente o backup exportado pelo PWA.
      </p>
    </div>
  );
}
