import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, Check, WifiOff, GitFork } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOfflinePesagem";
import { savePesagemPendente, type PesagemPendente } from "@/lib/offlineDb";
import type { SanitarioFormData } from "./SanitarioFormModal";
import ExportarPesagemModal from "@/components/pesagem/ExportarPesagemModal";
import type { AnimalPesagem } from "@/utils/gerarPdfPesagem";
import ApartacaoFlowModal from "./ApartacaoFlowModal";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimais: number;
  pesoMedioAtual: number | null;
  userId: string;
  userName: string;
  fazendaId: string;
  fazendaNome: string;
  retiroNome: string;
  retiroId?: string;
  sanitarioData?: SanitarioFormData | null;
  onSaved?: () => void;
}

type Step = "inicio" | "digitacao" | "finalizando";

export default function PesagemFlowModal({ open, onClose, pastoId, pastoNome, numAnimais, pesoMedioAtual, userId, userName, fazendaId, fazendaNome, retiroNome, retiroId, sanitarioData, onSaved }: Props) {
  const [step, setStep] = useState<Step>("inicio");
  const [pesos, setPesos] = useState<number[]>([]);
  const [currentPeso, setCurrentPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const [apartacaoOpen, setApartacaoOpen] = useState(false);
  const [exportData, setExportData] = useState<{ pesagemId: string; animais: AnimalPesagem[]; dataPesagem: string; hora: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (step === "digitacao" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, pesos.length]);

  const mediaParcial = pesos.length > 0 ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (pesos.length >= numAnimais) return;
      const val = parseFloat(currentPeso.replace(",", "."));
      if (!val || val <= 0) return;
      setPesos((prev) => [...prev, val]);
      setCurrentPeso("");
    }
  }

  function removerUltimo() {
    setPesos((prev) => prev.slice(0, -1));
  }

  const calcNovoPesoMedio = useCallback(() => {
    if (pesos.length === 0) return pesoMedioAtual;
    const mp = pesos.reduce((a, b) => a + b, 0) / pesos.length;
    if (pesos.length >= numAnimais || pesoMedioAtual == null || pesoMedioAtual <= 0) {
      return Math.round(mp * 10) / 10;
    }
    const novo = (pesoMedioAtual * numAnimais + mp * pesos.length) / numAnimais;
    return Math.round(novo * 10) / 10;
  }, [pesos, numAnimais, pesoMedioAtual]);

  async function finalizar() {
    if (pesos.length === 0) {
      toast.error("Nenhum peso registrado.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const mp = pesos.reduce((a, b) => a + b, 0) / pesos.length;
      const pesoAplicado = calcNovoPesoMedio();

      if (!isOnline) {
        // OFFLINE: save to IndexedDB
        const pendente: PesagemPendente = {
          id: crypto.randomUUID(),
          lote_id: pastoId,
          pesos: [...pesos],
          total_pesado: pesos.length,
          media_calculada: Math.round(mp * 10) / 10,
          peso_medio_aplicado: pesoAplicado,
          data_pesagem: now,
          usuario_id: userId,
          usuario_nome: userName,
          pasto_nome: pastoNome,
          num_animais: numAnimais,
          peso_medio_atual: pesoMedioAtual,
          sincronizado: false,
          criado_em: now,
          sanitario_data: sanitarioData || null,
        };
        await savePesagemPendente(pendente);
        toast.success("Pesagem salva localmente. Sincronização pendente.", { icon: "📴" });
        const animais = buildAnimaisArray(pesos);
        const hora = new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setExportData({ pesagemId: pendente.id, animais, dataPesagem: now, hora });
        setStep("inicio");
        onSaved?.();
        return;
      }

      // ONLINE: save directly to Supabase (existing behavior)
      const tipo = sanitarioData ? "pesagem_sanitario" : "pesagem";

      const { data: evento, error: evErr } = await (supabase.from("eventos_lote") as any)
        .insert({
          lote_id: pastoId,
          tipo,
          usuario_id: userId,
          data_evento: now,
          dados: {
            pesos,
            total_pesado: pesos.length,
            media: Math.round(mp * 10) / 10,
            peso_aplicado: pesoAplicado,
            aplicador: userName,
            ...(sanitarioData ? { sanitario: sanitarioData } : {}),
          },
        })
        .select("id")
        .single();

      if (evErr) throw evErr;

      const { error: pesErr } = await (supabase.from("pesagens") as any).insert({
        evento_id: evento.id,
        lote_id: pastoId,
        total_pesado: pesos.length,
        pesos: pesos as any,
        media_calculada: Math.round(mp * 10) / 10,
        peso_medio_aplicado: pesoAplicado,
        data_pesagem: now,
        usuario_id: userId,
      });

      if (pesErr) throw pesErr;

      const pastoUpdate: any = {
        peso_medio_kg: pesoAplicado,
        ultima_pesagem_em: now,
      };

      if (sanitarioData) {
        const dataFimCarencia = sanitarioData.tem_carencia && sanitarioData.dias_carencia > 0
          ? new Date(Date.now() + sanitarioData.dias_carencia * 86400000).toISOString().slice(0, 10)
          : null;

        const { data: sanEvento, error: sanErr } = await (supabase.from("eventos_sanitarios") as any)
          .insert({
            evento_id: evento.id,
            lote_id: pastoId,
            categoria: sanitarioData.categoria,
            medicamento: sanitarioData.medicamento,
            dose: sanitarioData.dose,
            lote_completo: sanitarioData.lote_completo,
            quantidade_tratada: sanitarioData.quantidade_tratada,
            tem_carencia: sanitarioData.tem_carencia,
            dias_carencia: sanitarioData.dias_carencia,
            data_fim_carencia: dataFimCarencia,
            aplicador_id: userId,
            data_aplicacao: now,
          })
          .select("id")
          .single();

        if (sanErr) throw sanErr;
        pastoUpdate.ultimo_evento_sanitario_id = sanEvento.id;
        if (dataFimCarencia) pastoUpdate.data_fim_carencia = dataFimCarencia;
      }

      await supabase.from("pastos").update(pastoUpdate).eq("id", pastoId);
      toast.success(`Pesagem finalizada! ${pesos.length} animais, média ${Math.round(mp * 10) / 10} kg`);
      const animais = buildAnimaisArray(pesos);
      const hora = new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setExportData({ pesagemId: evento.id, animais, dataPesagem: now, hora });
      setStep("inicio");
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function buildAnimaisArray(pesosArr: number[]): AnimalPesagem[] {
    return pesosArr.map((p, i) => ({
      id: crypto.randomUUID(),
      numero: i + 1,
      pesoKg: p,
    }));
  }

  function resetAndClose() {
    setStep("inicio");
    setPesos([]);
    setCurrentPeso("");
    setExportData(null);
    onClose();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Pesagem
            {!isOnline && (
              <Badge variant="destructive" className="ml-auto text-xs flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Offline
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{pastoNome} — {numAnimais} animais</DialogDescription>
        </DialogHeader>

        {!isOnline && step === "inicio" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-700 dark:text-yellow-300">
            Você está offline. Os dados serão salvos localmente e sincronizados quando a conexão for restaurada.
          </div>
        )}

        {step === "inicio" && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Peso médio atual: <strong>{pesoMedioAtual != null ? `${pesoMedioAtual} kg` : "—"}</strong>
              </p>
              {sanitarioData && (
                <Badge variant="secondary">
                  + Sanitário: {sanitarioData.categoria} — {sanitarioData.medicamento}
                </Badge>
              )}
            </div>
            <Button className="w-full h-12" onClick={() => setStep("digitacao")}>
              <Scale className="w-5 h-5 mr-2" />
              Iniciar Pesagem
            </Button>
            {retiroId && !sanitarioData && (
              <Button
                variant="outline"
                className="w-full h-12 border-primary text-primary hover:bg-primary/10 bg-transparent"
                onClick={() => setApartacaoOpen(true)}
              >
                <GitFork className="w-5 h-5 mr-2" />
                Pesagem + Apartação
              </Button>
            )}
          </div>
        )}

        {step === "digitacao" && (() => {
          const todospesados = pesos.length >= numAnimais;
          return (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">{pesos.length}/{numAnimais}</p>
                <p className="text-xs text-muted-foreground">pesados</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">
                  {mediaParcial > 0 ? mediaParcial.toFixed(1).replace(".", ",") : "—"}
                </p>
                <p className="text-xs text-muted-foreground">média (kg)</p>
              </div>
            </div>

            {todospesados && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 text-center font-medium">
                ✅ Todos os animais foram pesados. Clique em Finalizar.
              </div>
            )}

            <div className="space-y-2">
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="Peso (kg)"
                value={currentPeso}
                onChange={(e) => setCurrentPeso(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-lg h-12 text-center"
                autoFocus
                disabled={todospesados}
              />
              <Button
                type="button"
                className="w-full h-12 text-base"
                variant="secondary"
                disabled={todospesados || !currentPeso || parseFloat(currentPeso.replace(",", ".")) <= 0}
                onClick={() => {
                  const val = parseFloat(currentPeso.replace(",", "."));
                  if (!val || val <= 0) return;
                  setPesos((prev) => [...prev, val]);
                  setCurrentPeso("");
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                Próximo ➜
              </Button>
            </div>

            {pesos.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                {pesos.map((p, i) => (
                  <span key={i} className="inline-block bg-muted px-2 py-0.5 rounded mr-1 mb-1">
                    {i + 1}: {p} kg
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {pesos.length > 0 && (
                <Button variant="outline" size="sm" onClick={removerUltimo}>
                  Desfazer último
                </Button>
              )}
              <Button className={`flex-1 ${todospesados ? "animate-pulse" : ""}`} onClick={() => setStep("finalizando")} disabled={pesos.length === 0}>
                <Check className="w-4 h-4 mr-2" />
                Finalizar ({pesos.length})
              </Button>
            </div>
          </div>
          );
        })()}

        {step === "finalizando" && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-bold">{pesos.length} animais pesados</p>
              <p className="text-sm">Média: <strong>{mediaParcial.toFixed(1).replace(".", ",")} kg</strong></p>
              <p className="text-sm">
                Novo peso médio do lote: <strong>{calcNovoPesoMedio()?.toFixed(1).replace(".", ",")} kg</strong>
              </p>
              {!isOnline && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  📴 Será salvo localmente (offline)
                </p>
              )}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("digitacao")}>Voltar</Button>
              <Button onClick={finalizar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <ExportarPesagemModal
      open={!!exportData}
      onClose={() => { setExportData(null); resetAndClose(); }}
      pesagemId={exportData?.pesagemId || ""}
      fazendaId={fazendaId}
      fazendaNome={fazendaNome}
      retiroNome={retiroNome}
      pastoNome={pastoNome}
      dataPesagem={exportData?.dataPesagem || ""}
      horaFinalizacao={exportData?.hora || ""}
      responsavelNome={userName}
      animais={exportData?.animais || []}
    />

    {retiroId && (
      <ApartacaoFlowModal
        open={apartacaoOpen}
        onClose={() => setApartacaoOpen(false)}
        pastoId={pastoId}
        pastoNome={pastoNome}
        numAnimais={numAnimais}
        retiroId={retiroId}
        userId={userId}
        userName={userName}
        onSaved={() => {
          setApartacaoOpen(false);
          onSaved?.();
          resetAndClose();
        }}
      />
    )}
    </>
  );
}
