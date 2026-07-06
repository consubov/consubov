import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Bell, Check, X, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { sendPush } from "@/lib/pushService";

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  criado_em: string;
  lida: boolean;
  dados: any;
  fazenda_id: string | null;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24); return `${d} d`;
}

export default function GerenteNotificacoesBell({ fazendaId }: { fazendaId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [aprovar, setAprovar] = useState<Notif | null>(null);
  const [qtdReceb, setQtdReceb] = useState("");
  const [obsReceb, setObsReceb] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("notificacoes")
      .select("id, tipo, titulo, mensagem, criado_em, lida, dados, fazenda_id")
      .eq("fazenda_id", fazendaId)
      .order("criado_em", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) || []);
  }

  useEffect(() => {
    if (!fazendaId) return;
    load();
    const ch = supabase.channel(`notif-ger-${fazendaId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `fazenda_id=eq.${fazendaId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fazendaId]);

  const naoLidas = items.filter(n => !n.lida).length;

  async function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o && naoLidas > 0) {
      const ids = items.filter(n => !n.lida).map(n => n.id);
      await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
      setItems(prev => prev.map(n => ({ ...n, lida: true })));
    }
  }

  function abrirAprovar(n: Notif) {
    setAprovar(n);
    setQtdReceb(String(n.dados?.quantidade_sacos || ""));
    setObsReceb("");
    setOpen(false);
  }

  async function confirmarAprovacao() {
    if (!aprovar) return;
    const transferId = aprovar.dados?.transferencia_id;
    if (!transferId) return toast.error("Transferência inválida");
    const q = parseFloat(qtdReceb);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    setSaving(true);
    try {
      const { data: transf } = await supabase.from("transferencias_fabrica")
        .select("*").eq("id", transferId).maybeSingle();
      if (!transf) throw new Error("Transferência não encontrada");
      if (transf.status === "concluida") throw new Error("Já concluída");
      if (transf.status === "recusada") throw new Error("Já recusada");

      const enviadoSc = Number(transf.quantidade_sacos || 0);
      const divergSacos = enviadoSc - q;
      const divergPct = enviadoSc > 0 ? (divergSacos / enviadoSc) * 100 : 0;
      const now = new Date();

      await supabase.from("recebimentos_transferencia").insert({
        transferencia_id: transferId,
        quantidade_recebida: q,
        recebido_por: user?.id ?? null,
        status: "finalizado",
        observacao: obsReceb.trim() || null,
        data_recebimento: now.toISOString().slice(0, 10),
        hora_recebimento: now.toTimeString().slice(0, 8),
        divergencia_sacos: divergSacos,
        divergencia_percentual: Number(divergPct.toFixed(2)),
      });

      await supabase.from("transferencias_fabrica")
        .update({ status: "concluida" }).eq("id", transferId);

      if (transf.retiro_destino_id) {
        const mes = now.getMonth() + 1;
        const ano = now.getFullYear();
        const { data: existing } = await supabase.from("estoque_retiro")
          .select("id, quantidade_atual")
          .eq("retiro_id", transf.retiro_destino_id)
          .eq("mes", mes).eq("ano", ano).maybeSingle();
        if (existing) {
          await supabase.from("estoque_retiro").update({
            quantidade_atual: Number(existing.quantidade_atual || 0) + q,
          }).eq("id", existing.id);
        } else {
          await supabase.from("estoque_retiro").insert({
            retiro_id: transf.retiro_destino_id, mes, ano, quantidade_atual: q,
          });
        }
      }

      // Remove notificações da transferência
      const { data: notifs } = await supabase.from("notificacoes")
        .select("id, dados").eq("tipo", "transferencia_fabrica");
      const ids = (notifs || []).filter((n: any) => n?.dados?.transferencia_id === transferId).map((n: any) => n.id);
      if (ids.length) await supabase.from("notificacoes").delete().in("id", ids);

      toast.success("Recebimento aprovado");
      setAprovar(null);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function recusar(n: Notif) {
    const transferId = n.dados?.transferencia_id;
    if (!transferId) return;
    if (!confirm("Recusar esta transferência? Os sacos voltam para o estoque da fábrica.")) return;
    try {
      const { data: transf } = await supabase.from("transferencias_fabrica")
        .select("*").eq("id", transferId).maybeSingle();
      if (!transf) throw new Error("Transferência não encontrada");
      if (transf.status === "concluida" || transf.status === "recusada") {
        throw new Error("Transferência já processada");
      }

      await supabase.from("transferencias_fabrica")
        .update({ status: "recusada", observacao: (transf.observacao || "") + " [Recusada pelo gerente]" })
        .eq("id", transferId);

      // Devolve estoque da fábrica
      const { data: est } = await supabase.from("estoque_produto_acabado")
        .select("id, quantidade_sacos, quantidade_kg")
        .eq("fabrica_id", transf.fabrica_id)
        .eq("produto_id", transf.produto_id).maybeSingle();
      if (est) {
        await supabase.from("estoque_produto_acabado").update({
          quantidade_sacos: Number(est.quantidade_sacos || 0) + Number(transf.quantidade_sacos || 0),
          quantidade_kg: Number(est.quantidade_kg || 0) + Number(transf.quantidade_kg || 0),
        }).eq("id", est.id);
      }

      // Remove notificações
      const { data: notifs } = await supabase.from("notificacoes")
        .select("id, dados").eq("tipo", "transferencia_fabrica");
      const ids = (notifs || []).filter((x: any) => x?.dados?.transferencia_id === transferId).map((x: any) => x.id);
      if (ids.length) await supabase.from("notificacoes").delete().in("id", ids);

      // Avisa fábrica
      await sendPush(
        "Transferência recusada",
        `Uma transferência de ${transf.quantidade_sacos} sacos foi recusada pelo gerente.`,
        `/admin/fabricas/${transf.fabrica_id}?tab=transferencias&sub=historico`,
        { userIds: transf.registrado_por ? [transf.registrado_por] : [] },
      );

      toast.success("Transferência recusada");
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            aria-label="Notificações"
            className="relative h-8 w-8 rounded-full bg-primary-foreground text-primary flex items-center justify-center border border-border shadow-sm"
          >
            <Bell className="h-3.5 w-3.5" />
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                {naoLidas > 9 ? "9+" : naoLidas}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h4 className="font-semibold text-sm">Notificações</h4>
            {items.length > 0 && <Badge variant="secondary" className="text-xs">{items.length}</Badge>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
            ) : items.map(n => (
              <div key={n.id} className="p-3 border-b last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {n.tipo === "transferencia_fabrica" && <Truck className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                      {n.mensagem && <p className="text-xs text-muted-foreground mt-1">{n.mensagem}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.criado_em)}</span>
                </div>
                {n.tipo === "transferencia_fabrica" && n.dados?.transferencia_id && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 flex-1" onClick={() => abrirAprovar(n)}>
                      <Check className="w-3 h-3 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => recusar(n)}>
                      <X className="w-3 h-3 mr-1" /> Recusar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!aprovar} onOpenChange={o => !o && setAprovar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aprovar Recebimento</DialogTitle>
            <DialogDescription>
              {aprovar?.dados?.produto_nome} — enviados <strong>{aprovar?.dados?.quantidade_sacos} sacos</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantidade Recebida (sacos) *</Label>
              <Input type="number" step="1" min="1" value={qtdReceb} onChange={e => setQtdReceb(e.target.value)} />
              {qtdReceb && aprovar && (
                (() => {
                  const enviado = Number(aprovar.dados?.quantidade_sacos || 0);
                  const d = enviado - parseFloat(qtdReceb);
                  const pct = enviado > 0 ? (d / enviado) * 100 : 0;
                  return (
                    <p className={`text-xs mt-1 ${Math.abs(pct) > 5 ? "text-destructive" : "text-muted-foreground"}`}>
                      Divergência: {d >= 0 ? "-" : "+"}{Math.abs(d)} sc ({Math.abs(pct).toFixed(1)}%)
                    </p>
                  );
                })()
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={obsReceb} onChange={e => setObsReceb(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovar(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmarAprovacao} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
