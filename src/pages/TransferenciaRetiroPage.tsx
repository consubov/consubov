import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, ArrowRightLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Retiro {
  id: string;
  nome: string;
  fazenda_id: string;
}

interface TransferenciaRetiro {
  id: string;
  fazenda_id: string;
  retiro_origem_id: string;
  retiro_destino_id: string;
  quantidade: number;
  peso_medio: number | null;
  data_solicitacao: string;
  data_aceite: string | null;
  status: string;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export default function TransferenciaRetiroPage() {
  const { roleData, user } = useAuth();
  const navigate = useNavigate();

  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [fazendaId, setFazendaId] = useState("");
  const [meuRetiroId, setMeuRetiroId] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [observacao, setObservacao] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lists
  const [pendentes, setPendentes] = useState<TransferenciaRetiro[]>([]);
  const [historico, setHistorico] = useState<TransferenciaRetiro[]>([]);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ type: 'aceitar' | 'cancelar'; transferencia: TransferenciaRetiro } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!roleData.retiroId) return;
    setLoading(true);
    try {
      // Get my retiro + fazenda
      const { data: meuRetiro } = await supabase
        .from("retiros")
        .select("id, nome, fazenda_id")
        .eq("id", roleData.retiroId)
        .maybeSingle();

      if (!meuRetiro) return;
      setFazendaId(meuRetiro.fazenda_id);
      setMeuRetiroId(meuRetiro.id);

      // Get all retiros of this fazenda
      const { data: retirosFazenda } = await supabase
        .from("retiros")
        .select("id, nome, fazenda_id")
        .eq("fazenda_id", meuRetiro.fazenda_id)
        .eq("ativo", true)
        .order("nome");

      if (retirosFazenda) setRetiros(retirosFazenda);

      // Default origin to my retiro
      setOrigemId(meuRetiro.id);

      // Load peso_medio from pastos of my retiro (average)
      const { data: pastosData } = await supabase
        .from("pastos")
        .select("peso_medio_kg, num_animais")
        .eq("retiro_id", meuRetiro.id)
        .eq("ativo", true);

      if (pastosData && pastosData.length > 0) {
        const totalAnimais = pastosData.reduce((s, p) => s + (p.num_animais || 0), 0);
        const pesoTotal = pastosData.reduce((s, p) => s + ((p.peso_medio_kg || 0) * (p.num_animais || 0)), 0);
        if (totalAnimais > 0) {
          setPesoMedio(Math.round(pesoTotal / totalAnimais).toString());
        }
      }

      // Load transferências
      await loadTransferencias(meuRetiro.fazenda_id);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [roleData.retiroId]);

  const loadTransferencias = async (fId: string) => {
    const { data, error } = await supabase
      .from("transferencias_retiros" as any)
      .select("*")
      .eq("fazenda_id", fId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar transferências:", error);
      return;
    }

    const all = (data || []) as unknown as TransferenciaRetiro[];
    setPendentes(all.filter(t => t.status === "PENDENTE"));
    setHistorico(all.filter(t => t.status !== "PENDENTE"));
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update peso_medio when origin changes
  useEffect(() => {
    if (!origemId) return;
    (async () => {
      const { data: pastosData } = await supabase
        .from("pastos")
        .select("peso_medio_kg, num_animais")
        .eq("retiro_id", origemId)
        .eq("ativo", true);

      if (pastosData && pastosData.length > 0) {
        const totalAnimais = pastosData.reduce((s, p) => s + (p.num_animais || 0), 0);
        const pesoTotal = pastosData.reduce((s, p) => s + ((p.peso_medio_kg || 0) * (p.num_animais || 0)), 0);
        if (totalAnimais > 0) {
          setPesoMedio(Math.round(pesoTotal / totalAnimais).toString());
        }
      }
    })();
  }, [origemId]);

  const handleSolicitar = async () => {
    const qtd = parseInt(quantidade) || 0;
    const peso = parseFloat(pesoMedio) || null;

    if (qtd <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    if (!origemId || !destinoId) {
      toast.error("Selecione origem e destino");
      return;
    }
    if (origemId === destinoId) {
      toast.error("Origem e destino devem ser diferentes");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("transferencias_retiros" as any).insert({
        fazenda_id: fazendaId,
        retiro_origem_id: origemId,
        retiro_destino_id: destinoId,
        quantidade: qtd,
        peso_medio: peso,
        observacao: observacao.trim() || null,
        criado_por: user?.id || null,
      });

      if (error) throw error;

      toast.success("Transferência solicitada com sucesso!");
      setQuantidade("");
      setObservacao("");
      setDestinoId("");
      await loadTransferencias(fazendaId);
    } catch (err: any) {
      console.error("Erro ao solicitar:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAceitar = async (t: TransferenciaRetiro) => {
    setActionLoading(true);
    try {
      // Validate: check total animals in origin retiro's pastos
      const { data: pastosOrigem } = await supabase
        .from("pastos")
        .select("id, num_animais, peso_medio_kg")
        .eq("retiro_id", t.retiro_origem_id)
        .eq("ativo", true);

      const totalOrigem = (pastosOrigem || []).reduce((s, p) => s + (p.num_animais || 0), 0);

      if (totalOrigem < t.quantidade) {
        toast.error(`Saldo insuficiente no retiro de origem. Disponível: ${totalOrigem} animais.`);
        setConfirmAction(null);
        setActionLoading(false);
        return;
      }

      // Distribute subtraction across origin pastos (largest first)
      const sortedOrigem = [...(pastosOrigem || [])].sort((a, b) => (b.num_animais || 0) - (a.num_animais || 0));
      let restante = t.quantidade;

      for (const pasto of sortedOrigem) {
        if (restante <= 0) break;
        const subtract = Math.min(restante, pasto.num_animais || 0);
        if (subtract > 0) {
          const { error } = await supabase
            .from("pastos")
            .update({ num_animais: (pasto.num_animais || 0) - subtract })
            .eq("id", pasto.id);
          if (error) throw error;
          restante -= subtract;
        }
      }

      // Add animals to destination retiro - first pasto
      const { data: pastosDestino } = await supabase
        .from("pastos")
        .select("id, num_animais, peso_medio_kg")
        .eq("retiro_id", t.retiro_destino_id)
        .eq("ativo", true)
        .order("nome")
        .limit(1);

      if (pastosDestino && pastosDestino.length > 0) {
        const destPasto = pastosDestino[0];
        const updates: any = {
          num_animais: (destPasto.num_animais || 0) + t.quantidade,
        };
        // Update peso_medio if provided
        if (t.peso_medio && t.peso_medio > 0) {
          const currentTotal = (destPasto.num_animais || 0) * (destPasto.peso_medio_kg || 0);
          const addedTotal = t.quantidade * t.peso_medio;
          const newTotal = (destPasto.num_animais || 0) + t.quantidade;
          if (newTotal > 0) {
            updates.peso_medio_kg = Math.round(((currentTotal + addedTotal) / newTotal) * 100) / 100;
          }
        }
        const { error } = await supabase.from("pastos").update(updates).eq("id", destPasto.id);
        if (error) throw error;
      } else {
        toast.error("Retiro de destino não possui pastos ativos");
        setConfirmAction(null);
        setActionLoading(false);
        return;
      }

      // Update transfer status
      const { error: updateErr } = await supabase
        .from("transferencias_retiros" as any)
        .update({ status: "ACEITA", data_aceite: new Date().toISOString() })
        .eq("id", t.id);

      if (updateErr) throw updateErr;

      toast.success("Transferência aceita! Animais movimentados.");
      setConfirmAction(null);
      await loadTransferencias(fazendaId);
    } catch (err: any) {
      console.error("Erro ao aceitar:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelar = async (t: TransferenciaRetiro) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("transferencias_retiros" as any)
        .update({ status: "CANCELADA" })
        .eq("id", t.id);

      if (error) throw error;

      toast.success("Transferência cancelada.");
      setConfirmAction(null);
      await loadTransferencias(fazendaId);
    } catch (err: any) {
      console.error("Erro ao cancelar:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getRetiroNome = (id: string) => retiros.find(r => r.id === id)?.nome || "—";

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDENTE":
        return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "ACEITA":
        return <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50"><CheckCircle2 className="w-3 h-3" /> Aceita</Badge>;
      case "CANCELADA":
        return <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3" /> Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-auto">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/capataz")} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          <h1 className="text-lg font-bold">Transferência entre Retiros</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-8 overflow-auto">
        <Tabs defaultValue="nova" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="nova">Nova</TabsTrigger>
            <TabsTrigger value="pendentes" className="relative">
              Pendentes
              {pendentes.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                  {pendentes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* NOVA SOLICITAÇÃO */}
          <TabsContent value="nova" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Retiro de origem</Label>
                <Select value={origemId} onValueChange={setOrigemId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o retiro" /></SelectTrigger>
                  <SelectContent>
                    {retiros.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Retiro de destino</Label>
                <Select value={destinoId} onValueChange={setDestinoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o retiro" /></SelectTrigger>
                  <SelectContent>
                    {retiros.filter(r => r.id !== origemId).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade de animais</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso médio (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={pesoMedio}
                    onChange={e => setPesoMedio(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Motivo da transferência..."
                  rows={2}
                />
              </div>

              {origemId && destinoId && parseInt(quantidade) > 0 && (
                <Card className="bg-muted border-muted">
                  <CardContent className="p-3 text-sm">
                    <strong>{parseInt(quantidade)}</strong> animais de{" "}
                    <strong>{getRetiroNome(origemId)}</strong> → <strong>{getRetiroNome(destinoId)}</strong>
                    {pesoMedio && <span> • Peso médio: {pesoMedio} kg</span>}
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handleSolicitar}
                disabled={submitting || !origemId || !destinoId || !(parseInt(quantidade) > 0)}
                className="w-full h-12 gap-2 text-base"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-5 h-5" />}
                Solicitar Transferência
              </Button>
            </div>
          </TabsContent>

          {/* PENDENTES */}
          <TabsContent value="pendentes" className="space-y-3 mt-4">
            {pendentes.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma transferência pendente</p>
                </CardContent>
              </Card>
            ) : (
              pendentes.map(t => (
                <Card key={t.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-foreground">
                          {getRetiroNome(t.retiro_origem_id)} → {getRetiroNome(t.retiro_destino_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.quantidade} animais
                          {t.peso_medio ? ` • ${t.peso_medio} kg` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.data_solicitacao).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(t.data_solicitacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {t.observacao && (
                          <p className="text-xs text-muted-foreground italic">"{t.observacao}"</p>
                        )}
                      </div>
                      {statusBadge(t.status)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => setConfirmAction({ type: 'aceitar', transferencia: t })}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmAction({ type: 'cancelar', transferencia: t })}
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="space-y-3 mt-4">
            {historico.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma transferência no histórico</p>
                </CardContent>
              </Card>
            ) : (
              historico.map(t => (
                <Card key={t.id} className={t.status === "CANCELADA" ? "opacity-60" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-foreground">
                          {getRetiroNome(t.retiro_origem_id)} → {getRetiroNome(t.retiro_destino_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.quantidade} animais
                          {t.peso_medio ? ` • ${t.peso_medio} kg` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solicitado: {new Date(t.data_solicitacao).toLocaleDateString("pt-BR")}
                          {t.data_aceite && ` • Aceito: ${new Date(t.data_aceite).toLocaleDateString("pt-BR")}`}
                        </p>
                        {t.observacao && (
                          <p className="text-xs text-muted-foreground italic">"{t.observacao}"</p>
                        )}
                      </div>
                      {statusBadge(t.status)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'aceitar' ? 'Aceitar transferência?' : 'Cancelar transferência?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'aceitar'
                ? `Serão transferidos ${confirmAction.transferencia.quantidade} animais de ${getRetiroNome(confirmAction.transferencia.retiro_origem_id)} para ${getRetiroNome(confirmAction.transferencia.retiro_destino_id)}. Esta ação não pode ser desfeita.`
                : "A solicitação será cancelada. Nenhum animal será movimentado."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className={confirmAction?.type === 'cancelar' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === 'aceitar') {
                  handleAceitar(confirmAction.transferencia);
                } else {
                  handleCancelar(confirmAction.transferencia);
                }
              }}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmAction?.type === 'aceitar' ? 'Confirmar Aceite' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
