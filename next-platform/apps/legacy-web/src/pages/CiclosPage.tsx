import { useTranslation } from "@/hooks/useTranslation";
import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2, CalendarDays } from "lucide-react";
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
const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CiclosPage() {
  const uiText = useStaticUiText();
  const { language } = useTranslation();
  const { user } = useAuth();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ type: "reabrir" | "excluir"; ciclo: Ciclo } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    const [ciclosRes, fazendasRes] = await Promise.all([
      supabase.from("ciclos").select("id, mes, ano, fechado, fechado_em, fazenda_id, data_inicio, data_fim, duracao_dias").order("ano", { ascending: false }).order("mes", { ascending: false }),
      supabase.from("fazendas").select("id, nome").eq("ativo", true),
    ]);
    setCiclos(ciclosRes.data ?? []);
    setFazendas(fazendasRes.data ?? []);
    setLoading(false);
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
    await supabase.from("ciclos_auditoria" as any).insert({
      ciclo_id: ciclo.id,
      fazenda_id: ciclo.fazenda_id,
      acao,
      usuario_id: user?.id,
      usuario_email: user?.email,
      detalhes: { mes: ciclo.mes, ano: ciclo.ano, fazenda: fazendaMap[ciclo.fazenda_id] },
    });
  }

  async function handleReabrir(ciclo: Ciclo) {
    setActionLoading(true);
    const { error } = await supabase.from("ciclos").update({ fechado: false, fechado_em: null }).eq("id", ciclo.id);
    if (error) {
      toast.error(uiText("Erro ao reabrir ciclo"));
    } else {
      await logAuditoria(ciclo, "reabertura");
      toast.success(uiText("Ciclo reaberto com sucesso"));
      load();
    }
    setActionLoading(false);
    setConfirmAction(null);
  }

  async function handleExcluir(ciclo: Ciclo) {
    setActionLoading(true);
    // Delete linked lancamentos by fazenda + mes/ano
    await supabase.from("lancamentos").delete().eq("fazenda_id", ciclo.fazenda_id).eq("mes_referencia", ciclo.mes).eq("ano_referencia", ciclo.ano);
    const { error } = await supabase.from("ciclos").delete().eq("id", ciclo.id);
    if (error) {
      toast.error(uiText("Erro ao excluir ciclo"));
    } else {
      await logAuditoria(ciclo, "exclusao");
      toast.success(uiText("Ciclo excluído com sucesso"));
      load();
    }
    setActionLoading(false);
    setConfirmAction(null);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground"><LocalizedText source={"Ciclos"} /></h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg"><LocalizedText source={"Todos os Ciclos"} /></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : ciclos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8"><LocalizedText source={"Nenhum ciclo encontrado."} /></p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><LocalizedText source={"Fazenda"} /></TableHead>
                     <TableHead><LocalizedText source={"Período"} /></TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead><LocalizedText source={"Início"} /></TableHead>
                     <TableHead><LocalizedText source={"Fechamento"} /></TableHead>
                     <TableHead><LocalizedText source={"Duração"} /></TableHead>
                    <TableHead className="text-right"><LocalizedText source={"Ações"} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ciclos.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{fazendaMap[c.fazenda_id] ?? "—"}</TableCell>
                      <TableCell>{(language === "en-US" ? monthsEn : meses)[c.mes - 1]}/{c.ano}</TableCell>
                      <TableCell>
                        {c.fechado ? (
                          <Badge variant="secondary"><LocalizedText source={"Fechado"} /></Badge>
                        ) : (
                          <Badge className="bg-primary/20 text-primary border-primary/30"><LocalizedText source={"Aberto"} /></Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString(language) : "—"}
                      </TableCell>
                      <TableCell>
                        {c.fechado_em ? new Date(c.fechado_em).toLocaleDateString(language) : "—"}
                      </TableCell>
                      <TableCell>
                        {c.duracao_dias ? `${c.duracao_dias} ${uiText(c.duracao_dias === 1 ? "dia" : "dias")}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {c.fechado && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmAction({ type: "reabrir", ciclo: c })}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              <LocalizedText source={"Reabrir"} /></Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmAction({ type: "excluir", ciclo: c })}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            <LocalizedText source={"Excluir"} /></Button>
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
            <AlertDialogTitle>
              {uiText(confirmAction?.type === "reabrir" ? "Reabrir Ciclo" : "Excluir Ciclo")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "reabrir"
                ? uiText("Deseja reabrir este ciclo? Ele voltará para edição.")
                : uiText("Tem certeza que deseja excluir este ciclo? Essa ação não poderá ser desfeita.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}><LocalizedText source={"Cancelar"} /></AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className={confirmAction?.type === "excluir" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction?.type === "reabrir") handleReabrir(confirmAction.ciclo);
                else if (confirmAction?.type === "excluir") handleExcluir(confirmAction.ciclo);
              }}
            >
              {uiText(actionLoading ? "Processando..." : confirmAction?.type === "reabrir" ? "Reabrir" : "Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
