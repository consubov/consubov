import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Loader2, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { dataLocalSP } from "@/lib/diasCalendario";

/** Data informada → meio-dia em America/Sao_Paulo (ISO). */
function meioDiaSP(iso: string): string {
  return `${dataLocalSP(iso)}T12:00:00-03:00`;
}
function ddmm(iso: string): string {
  const [, m, d] = dataLocalSP(iso).split("-");
  return `${d}/${m}`;
}

interface ItemView {
  id: string;
  pasto_id: string;
  num_sacos: number;
  data_salga: string;
  cocho_cheio: boolean;
  motivo: string | null;
  pasto_nome?: string;
  num_animais?: number;
}

interface SolicitacaoView {
  id: string;
  retiro_id: string;
  fazenda_id: string;
  capataz_user_id: string | null;
  capataz_nome: string | null;
  data_salga_geral: string;
  total_sacos: number;
  created_at: string;
  retiro_nome?: string;
  itens: ItemView[];
}

interface Props {
  fazendaId: string;
}

export default function LancamentosManuaisPendentes({ fazendaId }: Props) {
  const { user } = useAuth();
  const [pendentes, setPendentes] = useState<SolicitacaoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [recusarTarget, setRecusarTarget] = useState<SolicitacaoView | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [dupPrompt, setDupPrompt] = useState<{ s: SolicitacaoView; msgs: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const { data: sols, error } = await (supabase as any)
        .from("solicitacoes_lancamento_manual")
        .select("id, retiro_id, fazenda_id, capataz_user_id, capataz_nome, data_salga_geral, total_sacos, created_at")
        .eq("fazenda_id", fazendaId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const sList = (sols ?? []) as any[];
      if (sList.length === 0) {
        setPendentes([]);
        return;
      }

      const solIds = sList.map((s) => s.id);
      const retiroIds = Array.from(new Set(sList.map((s) => s.retiro_id)));

      const [itensRes, retirosRes] = await Promise.all([
        (supabase as any)
          .from("solicitacoes_lancamento_itens")
          .select("id, solicitacao_id, pasto_id, num_sacos, data_salga, cocho_cheio, motivo")
          .in("solicitacao_id", solIds),
        supabase.from("retiros").select("id, nome").in("id", retiroIds),
      ]);

      const itens = ((itensRes.data as any[]) ?? []);
      const pastoIds = Array.from(new Set(itens.map((i) => i.pasto_id)));
      const pastosRes = pastoIds.length
        ? await supabase.from("pastos").select("id, nome, num_animais").in("id", pastoIds)
        : { data: [] as any[] };

      const pastoMap = new Map((pastosRes.data ?? []).map((p: any) => [p.id, p]));
      const retiroMap = new Map((retirosRes.data ?? []).map((r: any) => [r.id, r.nome]));

      const grouped: SolicitacaoView[] = sList.map((s: any) => ({
        ...s,
        retiro_nome: retiroMap.get(s.retiro_id) ?? "Retiro",
        itens: itens
          .filter((i) => i.solicitacao_id === s.id)
          .map((i) => ({
            id: i.id,
            pasto_id: i.pasto_id,
            num_sacos: i.num_sacos,
            data_salga: i.data_salga,
            cocho_cheio: i.cocho_cheio === true,
            motivo: i.motivo ?? null,
            pasto_nome: pastoMap.get(i.pasto_id)?.nome ?? "Pasto",
            num_animais: pastoMap.get(i.pasto_id)?.num_animais ?? 0,
          })),
      }));
      setPendentes(grouped);
    } catch (e: any) {
      console.error("[LancManuaisPendentes] load", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime nas duas tabelas
  useEffect(() => {
    if (!fazendaId) return;
    const channel = supabase
      .channel(`gerente-solic-manual-${fazendaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_lancamento_manual", filter: `fazenda_id=eq.${fazendaId}` },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_lancamento_itens" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fazendaId, load]);

  // Aviso (não bloqueia) de lançamento já existente no mesmo pasto e data (SP)
  const handleAprovar = async (s: SolicitacaoView) => {
    if (!user?.id) return;
    setActionId(s.id);
    try {
      const pastoIds = Array.from(new Set(s.itens.map((i) => i.pasto_id)));
      const { data: exist } = await supabase
        .from("lancamentos")
        .select("pasto_id, data_salga_informada, created_at")
        .in("pasto_id", pastoIds);
      const msgs: string[] = [];
      for (const it of s.itens) {
        const dia = dataLocalSP(it.data_salga);
        const hit = (exist ?? []).some(
          (l: any) => l.pasto_id === it.pasto_id && dataLocalSP(l.data_salga_informada ?? l.created_at) === dia
        );
        if (hit) msgs.push(`${it.pasto_nome}: Já existe lançamento neste pasto em ${ddmm(it.data_salga)}`);
      }
      if (msgs.length > 0) {
        setDupPrompt({ s, msgs });
        setActionId(null);
        return;
      }
    } catch (e) {
      console.warn("[Aprovar] checagem de duplicidade falhou", e);
    }
    setActionId(null);
    await aprovarConfirmado(s);
  };

  const aprovarConfirmado = async (s: SolicitacaoView) => {
    if (!user?.id) return;
    setDupPrompt(null);
    setActionId(s.id);
    try {
      // 1) Verifica estoque por (mes, ano) — soma sacos por bucket
      const buckets = new Map<string, number>(); // key: `${mes}-${ano}` -> sacos
      for (const it of s.itens) {
        if (it.cocho_cheio) continue; // cocho cheio não baixa estoque
        const d = new Date(it.data_salga);
        const key = `${d.getMonth() + 1}-${d.getFullYear()}`;
        buckets.set(key, (buckets.get(key) || 0) + it.num_sacos);
      }

      // Carrega estoques relevantes
      const checks = await Promise.all(
        Array.from(buckets.entries()).map(async ([key, sacos]) => {
          const [mes, ano] = key.split("-").map(Number);
          const { data: est } = await supabase
            .from("estoque_retiro")
            .select("id, quantidade_atual")
            .eq("retiro_id", s.retiro_id)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();
          const disponivel = est?.quantidade_atual ?? 0;
          return { key, mes, ano, sacos, disponivel, estoqueId: est?.id ?? null };
        })
      );

      const insuficiente = checks.find((c) => c.disponivel < c.sacos);
      if (insuficiente) {
        toast.error(
          `Estoque insuficiente em ${String(insuficiente.mes).padStart(2, "0")}/${insuficiente.ano}: ${insuficiente.disponivel} disponível, ${insuficiente.sacos} necessário`
        );
        setActionId(null);
        return;
      }

      // 2) Cria um lancamento por item (origem manual + aprovado)
      const lancPayloads = s.itens.map((it) => {
        const d = new Date(it.data_salga);
        const dataSP = meioDiaSP(it.data_salga);
        return {
          pasto_id: it.pasto_id,
          retiro_id: s.retiro_id,
          fazenda_id: s.fazenda_id,
          num_sacos: it.cocho_cheio ? 0 : it.num_sacos,
          cocho_cheio: it.cocho_cheio,
          observacao: it.motivo,
          created_at: dataSP,
          num_animais: it.num_animais ?? 0,
          dias_no_pasto: 1,
          origem: "manual",
          status_aprovacao: "aprovado",
          data_salga_informada: dataSP,
          criado_por: s.capataz_user_id,
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          mes_referencia: d.getMonth() + 1,
          ano_referencia: d.getFullYear(),
        } as any;
      });

      const { data: lancRows, error: lancErr } = await supabase
        .from("lancamentos")
        .insert(lancPayloads)
        .select("id, pasto_id, data_salga_informada");
      if (lancErr) throw lancErr;

      // 3) Vincula lancamento_id em cada item (best-effort, por ordem)
      try {
        const updates = s.itens.map((it, idx) => {
          const lancId = (lancRows as any[])?.[idx]?.id;
          if (!lancId) return null;
          return (supabase as any)
            .from("solicitacoes_lancamento_itens")
            .update({ lancamento_id: lancId })
            .eq("id", it.id);
        });
        await Promise.all(updates.filter(Boolean));
      } catch (e) {
        console.warn("[Aprovar] vincular lancamento_id falhou", e);
      }

      // 4) Desconta estoque por bucket
      for (const c of checks) {
        if (c.estoqueId) {
          await supabase
            .from("estoque_retiro")
            .update({ quantidade_atual: Math.max(0, c.disponivel - c.sacos) })
            .eq("id", c.estoqueId);
        }
        await supabase.from("movimentacoes_estoque").insert({
          retiro_id: s.retiro_id,
          mes: c.mes,
          ano: c.ano,
          tipo: "saida",
          quantidade: c.sacos,
          origem: "lancamento_manual",
          referencia_id: s.id,
        });
      }

      // 4b) Última salga do retiro: só se a data informada for mais recente
      try {
        const maisRecente = s.itens
          .map((it) => meioDiaSP(it.data_salga))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        const { data: ret } = await supabase.from("retiros").select("ultima_salga_em").eq("id", s.retiro_id).maybeSingle();
        const atual = (ret as any)?.ultima_salga_em as string | null | undefined;
        if (maisRecente && (!atual || new Date(maisRecente).getTime() > new Date(atual).getTime())) {
          await supabase.from("retiros").update({ ultima_salga_em: maisRecente } as any).eq("id", s.retiro_id);
        }
      } catch (e) {
        console.warn("[Aprovar] ultima_salga_em", e);
      }

      // 5) Marca solicitação como aprovada
      const { error: updErr } = await (supabase as any)
        .from("solicitacoes_lancamento_manual")
        .update({
          status: "aprovada",
          decidido_por: user.id,
          decidido_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (updErr) throw updErr;

      toast.success(`Solicitação aprovada: ${s.itens.length} pasto(s), ${s.total_sacos} sacos`);
      void load();
    } catch (e: any) {
      console.error("[Aprovar]", e);
      toast.error(e?.message || "Falha ao aprovar");
    } finally {
      setActionId(null);
    }
  };

  const openRecusar = (s: SolicitacaoView) => {
    setRecusarTarget(s);
    setMotivoRecusa("");
    setRecusarOpen(true);
  };

  const handleRecusar = async () => {
    if (!recusarTarget || !user?.id) return;
    setActionId(recusarTarget.id);
    try {
      const { error } = await (supabase as any)
        .from("solicitacoes_lancamento_manual")
        .update({
          status: "recusada",
          motivo_recusa: motivoRecusa.trim() || null,
          decidido_por: user.id,
          decidido_em: new Date().toISOString(),
        })
        .eq("id", recusarTarget.id);
      if (error) throw error;
      toast.success("Solicitação recusada");
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
          Solicitações de Lançamento Manual
          <Badge variant="destructive" className="text-[10px] h-5">{pendentes.length}</Badge>
        </h2>
        <div className="space-y-3">
          {pendentes.map((s) => {
            const dataGer = new Date(s.data_salga_geral).toLocaleDateString("pt-BR");
            const isLoading = actionId === s.id;
            return (
              <Card key={s.id} className="border-primary/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {s.capataz_nome || "Capataz"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.retiro_nome} · Data geral: {dataGer}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <Clock className="w-3 h-3" />Pendente
                    </Badge>
                  </div>

                  <div className="rounded-md bg-muted/40 p-2 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {s.itens.length} pasto{s.itens.length !== 1 ? "s" : ""} · {s.total_sacos} sacos
                    </p>
                    {s.itens.map((it) => {
                      const dItem = new Date(it.data_salga).toLocaleDateString("pt-BR");
                      const isCustom = dItem !== dataGer;
                      return (
                        <div key={it.id} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="truncate flex items-center gap-1">
                              <strong className="text-foreground">{it.pasto_nome}</strong>
                              {it.cocho_cheio ? (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1">Cocho cheio</Badge>
                              ) : (
                                <span className="text-muted-foreground"> — {it.num_sacos} sacos</span>
                              )}
                            </span>
                            <span className={isCustom ? "text-primary font-medium shrink-0 ml-2" : "text-muted-foreground shrink-0 ml-2"}>
                              {dItem}
                            </span>
                          </div>
                          {it.motivo && <p className="text-[11px] text-muted-foreground italic">Motivo: {it.motivo}</p>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleAprovar(s)}
                      disabled={isLoading}
                      className="flex-1 h-8 gap-1"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRecusar(s)}
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

      <Dialog open={!!dupPrompt} onOpenChange={(o) => { if (!o) setDupPrompt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar aprovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {dupPrompt?.msgs.map((m, i) => (
              <p key={i} className="text-xs text-muted-foreground">{m}</p>
            ))}
            <p className="text-xs pt-1">Deseja aprovar mesmo assim?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDupPrompt(null)}>Cancelar</Button>
            <Button onClick={() => dupPrompt && aprovarConfirmado(dupPrompt.s)}>Aprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recusarOpen} onOpenChange={setRecusarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2 rounded bg-muted/40">
              <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Toda a solicitação será recusada ({recusarTarget?.itens.length} pasto{(recusarTarget?.itens.length ?? 0) !== 1 ? "s" : ""}).
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Motivo (opcional, visível ao capataz):</p>
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
