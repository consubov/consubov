import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Send, Clock, CheckCircle2, XCircle, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNomeUsuario } from "@/hooks/useNomeUsuario";
import { toast } from "sonner";
import { sendPush } from "@/lib/pushService";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PastoLite {
  id: string;
  nome: string;
  num_animais: number;
}

interface SolicitacaoRow {
  id: string;
  data_salga_geral: string;
  total_sacos: number;
  status: string;
  motivo_recusa: string | null;
  created_at: string;
  itens: { id: string; pasto_id: string; num_sacos: number; data_salga: string; cocho_cheio?: boolean | null; motivo?: string | null }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastos: PastoLite[];
  retiroId: string;
  fazendaId: string;
}

type PastoEntry = { sacos: string; data: Date; cocho: boolean; motivo: string };

const MOTIVO_MIN = 5;

export default function LancamentoManualModal({ open, onOpenChange, pastos, retiroId, fazendaId }: Props) {
  const { user } = useAuth();
  const nomeCapataz = useNomeUsuario(["capatazes"], "Capataz");
  const [tab, setTab] = useState<"novo" | "historico">("novo");
  const [dataGeral, setDataGeral] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<Record<string, PastoEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [historico, setHistorico] = useState<SolicitacaoRow[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);
  const [generalDateOpen, setGeneralDateOpen] = useState(false);

  const pastoMap = useMemo(() => {
    const m = new Map<string, PastoLite>();
    pastos.forEach((p) => m.set(p.id, p));
    return m;
  }, [pastos]);

  // Reset on close / open
  useEffect(() => {
    if (!open) return;
    const today = new Date();
    setDataGeral(today);
    setEntries({});
    setTab("novo");
    void loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retiroId]);

  // Quando muda a data geral, propaga para pastos que ainda usam a data padrão (sem custom)
  const handleDataGeralChange = (d: Date | undefined) => {
    if (!d) return;
    setDataGeral(d);
    setEntries((prev) => {
      const next: Record<string, PastoEntry> = {};
      Object.entries(prev).forEach(([pid, e]) => {
        next[pid] = { ...e, data: e.data.getTime() === dataGeral.getTime() ? d : e.data };
      });
      return next;
    });
    setGeneralDateOpen(false);
  };

  const isVazio = (e: PastoEntry) => !e.cocho && (!e.sacos || e.sacos === "0") && !e.motivo.trim();

  const patchEntry = (pastoId: string, patch: Partial<PastoEntry>) => {
    setEntries((prev) => {
      const cur: PastoEntry = prev[pastoId] ?? { sacos: "", data: dataGeral, cocho: false, motivo: "" };
      const next = { ...cur, ...patch };
      if (next.cocho) next.sacos = "";
      if (isVazio(next)) {
        const { [pastoId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [pastoId]: next };
    });
  };

  const updateSacos = (pastoId: string, sacos: string) => patchEntry(pastoId, { sacos });

  const updateData = (pastoId: string, d: Date | undefined) => {
    if (!d) return;
    setEntries((prev) => {
      const cur = prev[pastoId];
      if (!cur) return prev;
      return { ...prev, [pastoId]: { ...cur, data: d } };
    });
    setDatePickerOpen(null);
  };

  const loadHistorico = async () => {
    if (!retiroId) return;
    setLoadingHist(true);
    try {
      const { data: sols, error } = await supabase
        .from("solicitacoes_lancamento_manual" as any)
        .select("id, data_salga_geral, total_sacos, status, motivo_recusa, created_at")
        .eq("retiro_id", retiroId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const sList = (sols ?? []) as any[];
      if (sList.length === 0) {
        setHistorico([]);
        return;
      }
      const ids = sList.map((s) => s.id);
      const { data: itens } = await supabase
        .from("solicitacoes_lancamento_itens" as any)
        .select("id, solicitacao_id, pasto_id, num_sacos, data_salga, cocho_cheio, motivo")
        .in("solicitacao_id", ids);
      const grouped: SolicitacaoRow[] = sList.map((s: any) => ({
        ...s,
        itens: ((itens as any[]) ?? []).filter((i) => i.solicitacao_id === s.id),
      }));
      setHistorico(grouped);
    } catch (e: any) {
      console.error("[LancManual] historico", e);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    const filled = Object.entries(entries)
      .map(([pid, e]) => ({ pid, cocho: e.cocho, sacos: e.cocho ? 0 : parseInt(e.sacos, 10), data: e.data, motivo: e.motivo.trim() }))
      .filter((e) => e.cocho || (Number.isFinite(e.sacos) && e.sacos > 0));

    if (filled.length === 0) {
      toast.error("Preencha os sacos ou marque \"Cocho cheio\" em pelo menos um pasto");
      return;
    }
    const semMotivo = filled.find((e) => e.motivo.length < MOTIVO_MIN);
    if (semMotivo) {
      toast.error(`Informe o motivo do lançamento manual (mín. ${MOTIVO_MIN} caracteres) em ${pastoMap.get(semMotivo.pid)?.nome ?? "pasto"}`);
      return;
    }

    setSubmitting(true);
    try {
      const totalSacos = filled.reduce((s, e) => s + e.sacos, 0);
      const capatazNome = nomeCapataz;

      const { data: solIns, error: solErr } = await (supabase as any)
        .from("solicitacoes_lancamento_manual")
        .insert({
          fazenda_id: fazendaId,
          retiro_id: retiroId,
          capataz_user_id: user.id,
          capataz_nome: capatazNome,
          data_salga_geral: dataGeral.toISOString(),
          total_sacos: totalSacos,
          status: "pendente",
        })
        .select("id")
        .single();
      if (solErr) throw solErr;

      const itensPayload = filled.map((e) => ({
        solicitacao_id: solIns.id,
        pasto_id: e.pid,
        num_sacos: e.sacos,
        data_salga: e.data.toISOString(),
        cocho_cheio: e.cocho,
        motivo: e.motivo,
      }));

      const { error: itErr } = await (supabase as any)
        .from("solicitacoes_lancamento_itens")
        .insert(itensPayload);
      if (itErr) {
        // Evita pedido sem pastos: apaga o cabeçalho recém-criado
        await (supabase as any).from("solicitacoes_lancamento_manual").delete().eq("id", solIns.id);
        throw itErr;
      }

      toast.success(`Solicitação enviada (${filled.length} pasto${filled.length > 1 ? "s" : ""})`);
      void sendPush(
        "📝 Lançamento Manual pendente",
        capatazNome,
        "/gerente",
        { fazendaId },
      );
      setEntries({});
      setTab("historico");
      void loadHistorico();
    } catch (e: any) {
      console.error("[LancManual] submit", e);
      const msg: string = e?.message || "";
      const isNetwork = e?.name === "TypeError" || /failed to fetch|network|networkerror|fetch failed|load failed/i.test(msg);
      toast.error(isNetwork ? "Sem internet — verifique a conexão e tente de novo" : (msg || "Falha ao enviar solicitação"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (status: string) => {
    if (status === "aprovada") {
      return <Badge className="bg-primary text-primary-foreground gap-1"><CheckCircle2 className="w-3 h-3" />Aprovada</Badge>;
    }
    if (status === "recusada") {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Recusada</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Pendente</Badge>;
  };

  const totalPreenchido = Object.values(entries).reduce((s, e) => s + (e.cocho ? 0 : parseInt(e.sacos, 10) || 0), 0);
  const countPreenchido = Object.values(entries).filter((e) => e.cocho || parseInt(e.sacos, 10) > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-base">Lançamento Manual</DialogTitle>
          <DialogDescription className="text-xs">
            {tab === "novo"
              ? "Preencha os pastos com salga e envie ao gerente"
              : "Histórico de solicitações enviadas"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 flex gap-2 border-b shrink-0">
          <button
            onClick={() => setTab("novo")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              tab === "novo" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            Nova solicitação
          </button>
          <button
            onClick={() => setTab("historico")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              tab === "historico" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            Histórico
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          {tab === "novo" && (
            <div className="space-y-3">
              {/* Data geral */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <Label className="text-xs font-semibold">Data da salga (geral)</Label>
                <Popover open={generalDateOpen} onOpenChange={setGeneralDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(dataGeral, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataGeral}
                      onSelect={handleDataGeralChange}
                      disabled={(d) => d > new Date()}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-muted-foreground">
                  Aplicada por padrão a todos os pastos. Você pode alterar individualmente abaixo.
                </p>
              </div>

              {/* Lista de pastos */}
              {pastos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pasto disponível.</p>
              ) : (
                <div className="space-y-2">
                  {pastos.map((p) => {
                    const entry = entries[p.id];
                    const dataPasto = entry?.data ?? dataGeral;
                    const isCustom = entry && entry.data.toDateString() !== dataGeral.toDateString();
                    return (
                      <Card key={p.id} className={cn("transition-colors", entry && "border-primary/40 bg-primary/5")}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{p.nome}</p>
                              <p className="text-[11px] text-muted-foreground">{p.num_animais} animais</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              placeholder="Sacos"
                              value={entry?.cocho ? "0" : entry?.sacos ?? ""}
                              onChange={(e) => updateSacos(p.id, e.target.value)}
                              disabled={!!entry?.cocho}
                              className="h-9 text-sm"
                            />
                            <Popover
                              open={datePickerOpen === p.id}
                              onOpenChange={(o) => setDatePickerOpen(o ? p.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className={cn("h-9 w-9 shrink-0", isCustom && "border-primary text-primary")}
                                  title={isCustom ? `Data: ${format(dataPasto, "dd/MM/yyyy")}` : "Alterar data"}
                                >
                                  <CalendarIcon className="w-4 h-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                  mode="single"
                                  selected={dataPasto}
                                  onSelect={(d) => {
                                    if (!entry) {
                                      // se ainda não tem entry, cria com sacos vazio? Melhor exigir sacos primeiro
                                      if (d) patchEntry(p.id, { data: d });
                                    } else {
                                      updateData(p.id, d);
                                    }
                                    setDatePickerOpen(null);
                                  }}
                                  disabled={(d) => d > new Date()}
                                  initialFocus
                                  locale={ptBR}
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`cc-${p.id}`} className="text-xs">Cocho cheio</Label>
                            <Switch
                              id={`cc-${p.id}`}
                              checked={!!entry?.cocho}
                              onCheckedChange={(v) => patchEntry(p.id, { cocho: v })}
                            />
                          </div>
                          {entry && (
                            <div className="space-y-1">
                              <Label className="text-[11px]">Motivo do lançamento manual *</Label>
                              <Input
                                value={entry.motivo}
                                onChange={(e) => patchEntry(p.id, { motivo: e.target.value })}
                                placeholder="Ex.: Celular sem bateria, QR danificado"
                                className="h-9 text-sm"
                              />
                              {entry.motivo.trim().length < MOTIVO_MIN && (
                                <p className="text-[10px] text-destructive">Obrigatório (mín. {MOTIVO_MIN} caracteres)</p>
                              )}
                            </div>
                          )}
                          {isCustom && (
                            <p className="text-[11px] text-primary">
                              Data específica: {format(dataPasto, "dd/MM/yyyy")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "historico" && (
            <div className="space-y-2">
              {loadingHist ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação ainda.</p>
              ) : (
                historico.map((s) => {
                  const dataGer = new Date(s.data_salga_geral).toLocaleDateString("pt-BR");
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">Solicitação de {dataGer}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.itens.length} pasto{s.itens.length !== 1 ? "s" : ""} · {s.total_sacos} sacos
                            </p>
                          </div>
                          {renderStatus(s.status)}
                        </div>
                        <div className="space-y-0.5 pl-2 border-l-2 border-muted">
                          {s.itens.map((it) => {
                            const pasto = pastoMap.get(it.pasto_id);
                            const dItem = new Date(it.data_salga).toLocaleDateString("pt-BR");
                            return (
                              <p key={it.id} className="text-[11px] text-muted-foreground">
                                <span className="text-foreground font-medium">{pasto?.nome ?? "Pasto"}</span>
                                {" — "}{it.cocho_cheio ? "Cocho cheio" : `${it.num_sacos} sacos`} · {dItem}
                                {it.motivo ? <span className="block italic">Motivo: {it.motivo}</span> : null}
                              </p>
                            );
                          })}
                        </div>
                        {s.status === "recusada" && s.motivo_recusa && (
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                            <p className="text-[10px] font-semibold text-destructive uppercase">Motivo da recusa</p>
                            <p className="text-xs text-destructive">{s.motivo_recusa}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>

        {tab === "novo" && pastos.length > 0 && (
          <div className="border-t bg-background p-3 shrink-0 space-y-2">
            {countPreenchido > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                <span className="text-foreground font-semibold">{countPreenchido}</span> pasto{countPreenchido > 1 ? "s" : ""} ·{" "}
                <span className="text-foreground font-semibold">{totalPreenchido}</span> sacos no total
              </p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || countPreenchido === 0}
              className="w-full gap-2"
              size="lg"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Solicitação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
