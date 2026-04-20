import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Pendente {
  id: string;
  pasto_id: string;
  retiro_id: string;
  num_sacos: number;
  num_animais: number;
  data_salga_informada: string | null;
  observacao: string | null;
  created_at: string;
  pasto_nome?: string;
  retiro_nome?: string;
  capataz_nome?: string;
}

interface Props {
  fazendaId: string;
}

export default function LancamentosManuaisPendentes({ fazendaId }: Props) {
  const { user } = useAuth();
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [recusarTarget, setRecusarTarget] = useState<Pendente | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const load = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("id, pasto_id, retiro_id, num_sacos, num_animais, data_salga_informada, observacao, created_at")
        .eq("fazenda_id", fazendaId)
        .eq("origem", "manual")
        .eq("status_aprovacao", "pendente_aprovacao")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Pendente[];

      // Resolve names
      const pastoIds = Array.from(new Set(rows.map((r) => r.pasto_id)));
      const retiroIds = Array.from(new Set(rows.map((r) => r.retiro_id)));

      const [pastosRes, retirosRes] = await Promise.all([
        pastoIds.length ? supabase.from("pastos").select("id, nome").in("id", pastoIds) : Promise.resolve({ data: [] as any[] }),
        retiroIds.length ? supabase.from("retiros").select("id, nome, capataz").in("id", retiroIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const pastoMap = new Map((pastosRes.data ?? []).map((p: any) => [p.id, p.nome]));
      const retiroMap = new Map((retirosRes.data ?? []).map((r: any) => [r.id, r]));

      setPendentes(
        rows.map((r) => ({
          ...r,
          pasto_nome: pastoMap.get(r.pasto_id) ?? "Pasto",
          retiro_nome: retiroMap.get(r.retiro_id)?.nome ?? "Retiro",
          capataz_nome: retiroMap.get(r.retiro_id)?.capataz ?? "",
        }))
      );
    } catch (e: any) {
      console.error("[LancManuaisPendentes] load", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!fazendaId) return;
    const channel = supabase
      .channel(`gerente-manual-pend-${fazendaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lancamentos", filter: `fazenda_id=eq.${fazendaId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fazendaId, load]);

  const handleAprovar = async (p: Pendente) => {
    if (!user?.id) return;
    setActionId(p.id);
    try {
      const { error } = await supabase
        .from("lancamentos")
        .update({
          status_aprovacao: "aprovado",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq("id", p.id);
      if (error) throw error;

      // Desconta do estoque do retiro (mes/ano da data informada ou atual)
      const ref = p.data_salga_informada ? new Date(p.data_salga_informada) : new Date();
      const mes = ref.getMonth() + 1;
      const ano = ref.getFullYear();

      const { data: estoque } = await supabase
        .from("estoque_retiro")
        .select("id, quantidade_atual")
        .eq("retiro_id", p.retiro_id)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (estoque) {
        await supabase
          .from("estoque_retiro")
          .update({ quantidade_atual: Math.max(0, (estoque.quantidade_atual ?? 0) - p.num_sacos) })
          .eq("id", estoque.id);
      }

      await supabase.from("movimentacoes_estoque").insert({
        retiro_id: p.retiro_id,
        mes,
        ano,
        tipo: "saida",
        quantidade: p.num_sacos,
        origem: "lancamento_manual",
        referencia_id: p.id,
      });

      toast.success("Lançamento aprovado");
      void load();
    } catch (e: any) {
      console.error("[Aprovar]", e);
      toast.error(e?.message || "Falha ao aprovar");
    } finally {
      setActionId(null);
    }
  };

  const openRecusar = (p: Pendente) => {
    setRecusarTarget(p);
    setMotivoRecusa("");
    setRecusarOpen(true);
  };

  const handleRecusar = async () => {
    if (!recusarTarget || !user?.id) return;
    setActionId(recusarTarget.id);
    try {
      const { error } = await supabase
        .from("lancamentos")
        .update({
          status_aprovacao: "recusado",
          motivo_recusa: motivoRecusa.trim() || null,
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq("id", recusarTarget.id);
      if (error) throw error;
      toast.success("Lançamento recusado");
      setRecusarOpen(false);
      setRecusarTarget(null);
      setMotivoRecusa("");
      void load();
    } catch (e: any) {
      console.error("[Recusar]", e);
      toast.error(e?.message || "Falha ao recusar");
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendentes.length === 0) return null;

  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Lançamentos Manuais Pendentes
          <Badge variant="destructive" className="text-[10px] h-5">{pendentes.length}</Badge>
        </h2>
        <div className="space-y-2">
          {pendentes.map((p) => {
            const dataSalga = p.data_salga_informada ? new Date(p.data_salga_informada).toLocaleDateString("pt-BR") : "—";
            const isLoading = actionId === p.id;
            return (
              <Card key={p.id} className="border-primary/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.pasto_nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.retiro_nome} · {p.capataz_nome}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <Clock className="w-3 h-3" />Pendente
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{p.num_sacos}</strong> sacos</span>
                    <span>Data: {dataSalga}</span>
                  </div>
                  {p.observacao && (
                    <p className="text-xs text-muted-foreground italic">"{p.observacao}"</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleAprovar(p)}
                      disabled={isLoading}
                      className="flex-1 h-8 gap-1"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRecusar(p)}
                      disabled={isLoading}
                      className="flex-1 h-8 gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Recusar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={recusarOpen} onOpenChange={setRecusarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recusar lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Informe o motivo (opcional, visível ao capataz):</p>
            <Textarea
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              placeholder="Ex: data incorreta, quantidade divergente..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecusarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRecusar} disabled={actionId !== null}>
              {actionId !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
