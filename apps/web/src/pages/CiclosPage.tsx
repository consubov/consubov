import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Ciclo {
  id: string;
  mes: number;
  ano: number;
  fechado: boolean;
  fechado_em: string | null;
  fazenda_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  duracao_dias: number | null;
}

interface Fazenda {
  id: string;
  nome: string;
}

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function CiclosPage() {
  const { user } = useAuth();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<Ciclo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    try {
      const [ciclosRes, fazendasRes] = await Promise.all([
        supabase.from("ciclos").select("id, mes, ano, fechado, fechado_em, fazenda_id, data_inicio, data_fim, duracao_dias").order("ano", { ascending: false }).order("mes", { ascending: false }),
        supabase.from("fazendas").select("id, nome").eq("ativo", true),
      ]);
      if (ciclosRes.error || fazendasRes.error) {
        toast.error("Não foi possível carregar os ciclos. Tente novamente.");
        return;
      }
      setCiclos(ciclosRes.data ?? []);
      setFazendas(fazendasRes.data ?? []);
    } catch {
      toast.error("Não foi possível carregar os ciclos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("ciclos-admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ciclos" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fazendaMap = useMemo(() => {
    const m: Record<string, string> = {};
    fazendas.forEach(f => { m[f.id] = f.nome; });
    return m;
  }, [fazendas]);

  async function logAuditoria(ciclo: Ciclo, acao: string) {
    const { error } = await supabase.from("ciclos_auditoria" as any).insert({
      ciclo_id: ciclo.id,
      fazenda_id: ciclo.fazenda_id,
      acao,
      usuario_id: user?.id,
      usuario_email: user?.email,
      detalhes: { mes: ciclo.mes, ano: ciclo.ano, fazenda: fazendaMap[ciclo.fazenda_id] },
    });
    return error;
  }

  async function handleReabrir(ciclo: Ciclo) {
    setActionLoading(true);
    try {
      if (!user?.id) {
        toast.error("Sessão expirada. Entre novamente antes de reabrir o ciclo.");
        return;
      }
      if (!ciclo.fechado) {
        toast.error("Este ciclo já está aberto. Atualize a lista antes de tentar novamente.");
        return;
      }
      const { data, error } = await supabase.from("ciclos")
        .update({ fechado: false, fechado_em: null })
        .eq("id", ciclo.id)
        .eq("fazenda_id", ciclo.fazenda_id)
        .eq("fechado", true)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        toast.error("Não foi possível confirmar a reabertura do ciclo");
        return;
      }

      try {
        const auditError = await logAuditoria(ciclo, "reabertura");
        if (auditError) {
          toast.error("Ciclo reaberto, mas o registro de auditoria falhou");
        } else {
          toast.success("Ciclo reaberto com sucesso");
        }
      } catch {
        toast.error("Ciclo reaberto, mas a auditoria não pôde ser confirmada");
      }
      await load();
    } catch {
      toast.error("Falha inesperada. Confira o estado do ciclo antes de tentar novamente");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Ciclos</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todos os Ciclos</CardTitle>
          <p className="text-sm text-muted-foreground" role="status">
            A exclusão de ciclos está temporariamente indisponível para proteger lançamentos e o histórico.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : ciclos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum ciclo encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fazenda</TableHead>
                     <TableHead>Período</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Início</TableHead>
                     <TableHead>Fechamento</TableHead>
                     <TableHead>Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ciclos.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{fazendaMap[c.fazenda_id] ?? "—"}</TableCell>
                      <TableCell>{meses[c.mes - 1]}/{c.ano}</TableCell>
                      <TableCell>
                        {c.fechado ? (
                          <Badge variant="secondary">Fechado</Badge>
                        ) : (
                          <Badge className="bg-primary/20 text-primary border-primary/30">Aberto</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        {c.fechado_em ? new Date(c.fechado_em).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        {c.duracao_dias ? `${c.duracao_dias} dias` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {c.fechado && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmAction(c)}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Reabrir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Ciclo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reabrir este ciclo? Ele voltará para edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) void handleReabrir(confirmAction);
              }}
            >
              {actionLoading ? "Processando..." : "Reabrir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
