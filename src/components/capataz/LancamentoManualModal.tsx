import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PastoLite {
  id: string;
  nome: string;
  num_animais: number;
}

interface LancamentoManualPendente {
  id: string;
  pasto_id: string;
  num_sacos: number;
  data_salga_informada: string | null;
  observacao: string | null;
  status_aprovacao: string | null;
  motivo_recusa: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastos: PastoLite[];
  retiroId: string;
  fazendaId: string;
}

export default function LancamentoManualModal({ open, onOpenChange, pastos, retiroId, fazendaId }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"select" | "form" | "list">("select");
  const [selectedPasto, setSelectedPasto] = useState<PastoLite | null>(null);
  const [sacos, setSacos] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [meusLancamentos, setMeusLancamentos] = useState<LancamentoManualPendente[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const pastoMap = useMemo(() => {
    const m = new Map<string, PastoLite>();
    pastos.forEach((p) => m.set(p.id, p));
    return m;
  }, [pastos]);

  const loadMeus = async () => {
    if (!retiroId) return;
    setLoadingList(true);
    try {
      const { data: rows, error } = await supabase
        .from("lancamentos")
        .select("id, pasto_id, num_sacos, data_salga_informada, observacao, status_aprovacao, motivo_recusa, created_at")
        .eq("retiro_id", retiroId)
        .eq("origem", "manual")
        .not("status_aprovacao", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setMeusLancamentos((rows ?? []) as LancamentoManualPendente[]);
    } catch (e: any) {
      console.error("[LancamentoManual] load list", e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep("select");
      setSelectedPasto(null);
      setSacos("");
      setObservacao("");
      setData(new Date().toISOString().slice(0, 10));
      return;
    }
    void loadMeus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retiroId]);

  const handleSelectPasto = (p: PastoLite) => {
    setSelectedPasto(p);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!selectedPasto || !user?.id) return;
    const numSacos = parseInt(sacos, 10);
    if (!Number.isFinite(numSacos) || numSacos <= 0) {
      toast.error("Informe a quantidade de sacos");
      return;
    }
    if (!data) {
      toast.error("Informe a data da salga");
      return;
    }
    setSubmitting(true);
    try {
      const dataIso = new Date(`${data}T12:00:00`).toISOString();
      const now = new Date(dataIso);
      const { error } = await supabase.from("lancamentos").insert({
        pasto_id: selectedPasto.id,
        retiro_id: retiroId,
        fazenda_id: fazendaId,
        num_sacos: numSacos,
        num_animais: selectedPasto.num_animais ?? 0,
        dias_no_pasto: 1,
        origem: "manual",
        status_aprovacao: "pendente_aprovacao",
        data_salga_informada: dataIso,
        observacao: observacao.trim() || null,
        criado_por: user.id,
        mes_referencia: now.getMonth() + 1,
        ano_referencia: now.getFullYear(),
        cocho_cheio: false,
      } as any);
      if (error) throw error;
      toast.success("Solicitação enviada ao gerente");
      setStep("list");
      setSelectedPasto(null);
      setSacos("");
      setObservacao("");
      setData(new Date().toISOString().slice(0, 10));
      void loadMeus();
    } catch (e: any) {
      console.error("[LancamentoManual] insert", e);
      toast.error(e?.message || "Falha ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (status: string | null) => {
    if (status === "aprovado") {
      return <Badge className="bg-primary text-primary-foreground gap-1"><CheckCircle2 className="w-3 h-3" />Aprovado</Badge>;
    }
    if (status === "recusado") {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Recusado</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Aguardando aprovação</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "select" && step !== "list" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep("select")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-base">
              {step === "select" && "Lançamento Manual"}
              {step === "form" && (selectedPasto?.nome ?? "Lançamento")}
              {step === "list" && "Meus Lançamentos"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {step === "select" && "Selecione o pasto para lançar uma salga manual"}
            {step === "form" && "Preencha os dados da salga para enviar ao gerente"}
            {step === "list" && "Solicitações enviadas para aprovação"}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs simples */}
        <div className="px-4 flex gap-2 border-b shrink-0">
          <button
            onClick={() => setStep("select")}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
              step === "select" || step === "form" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Novo
          </button>
          <button
            onClick={() => setStep("list")}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
              step === "list" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Pendentes / Histórico
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          {step === "select" && (
            <div className="space-y-2">
              {pastos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pasto disponível.</p>
              ) : (
                pastos.map((p) => (
                  <Card key={p.id} className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => handleSelectPasto(p)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.num_animais} animais</p>
                      </div>
                      <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {step === "form" && selectedPasto && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="sacos" className="text-xs">Quantidade de sacos *</Label>
                <Input
                  id="sacos"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={sacos}
                  onChange={(e) => setSacos(e.target.value)}
                  placeholder="Ex: 5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="data" className="text-xs">Data da salga *</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="obs" className="text-xs">Observação (opcional)</Label>
                <Textarea
                  id="obs"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Motivo do lançamento manual..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar para aprovação
              </Button>
            </div>
          )}

          {step === "list" && (
            <div className="space-y-2">
              {loadingList ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : meusLancamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento manual ainda.</p>
              ) : (
                meusLancamentos.map((l) => {
                  const pasto = pastoMap.get(l.pasto_id);
                  const dataSalga = l.data_salga_informada ? new Date(l.data_salga_informada).toLocaleDateString("pt-BR") : "—";
                  return (
                    <Card key={l.id}>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{pasto?.nome ?? "Pasto"}</p>
                          {renderStatus(l.status_aprovacao)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span><strong className="text-foreground">{l.num_sacos}</strong> sacos</span>
                          <span>Data: {dataSalga}</span>
                        </div>
                        {l.observacao && (
                          <p className="text-xs text-muted-foreground italic">"{l.observacao}"</p>
                        )}
                        {l.status_aprovacao === "recusado" && l.motivo_recusa && (
                          <div className="mt-1 p-2 rounded bg-destructive/10 border border-destructive/20">
                            <p className="text-[10px] font-semibold text-destructive uppercase">Motivo da recusa</p>
                            <p className="text-xs text-destructive">{l.motivo_recusa}</p>
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
      </DialogContent>
    </Dialog>
  );
}
