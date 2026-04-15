import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SanitarioFormData } from "./SanitarioFormModal";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimais: number;
  pesoMedioAtual: number | null;
  userId: string;
  userName: string;
  /** If provided, saves combined pesagem+sanitario event */
  sanitarioData?: SanitarioFormData | null;
  onSaved?: () => void;
}

type Step = "inicio" | "digitacao" | "finalizando";

export default function PesagemFlowModal({ open, onClose, pastoId, pastoNome, numAnimais, pesoMedioAtual, userId, userName, sanitarioData, onSaved }: Props) {
  const [step, setStep] = useState<Step>("inicio");
  const [pesos, setPesos] = useState<number[]>([]);
  const [currentPeso, setCurrentPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "digitacao" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, pesos.length]);

  const mediaParcial = pesos.length > 0 ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
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
    // Weighted average
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
      const tipo = sanitarioData ? "pesagem_sanitario" : "pesagem";

      // 1. Create evento_lote
      const { data: evento, error: evErr } = await (supabase
        .from("eventos_lote") as any)
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
            ...(sanitarioData ? { sanitario: sanitarioData } : {}),
          },
        })
        .select("id")
        .single();

      if (evErr) throw evErr;

      // 2. Insert pesagem
      const { error: pesErr } = await supabase
        .from("pesagens")
        .insert({
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

      // 3. Update pasto
      const pastoUpdate: any = {
        peso_medio_kg: pesoAplicado,
        ultima_pesagem_em: now,
      };

      // 4. If sanitario combined
      if (sanitarioData) {
        const dataFimCarencia = sanitarioData.tem_carencia && sanitarioData.dias_carencia > 0
          ? new Date(Date.now() + sanitarioData.dias_carencia * 86400000).toISOString().slice(0, 10)
          : null;

        const { data: sanEvento, error: sanErr } = await supabase
          .from("eventos_sanitarios")
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
      resetAndClose();
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setStep("inicio");
    setPesos([]);
    setCurrentPeso("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Pesagem
          </DialogTitle>
          <DialogDescription>{pastoNome} — {numAnimais} animais</DialogDescription>
        </DialogHeader>

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
          </div>
        )}

        {step === "digitacao" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">{pesos.length}</p>
                <p className="text-xs text-muted-foreground">pesados</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">
                  {mediaParcial > 0 ? mediaParcial.toFixed(1).replace(".", ",") : "—"}
                </p>
                <p className="text-xs text-muted-foreground">média (kg)</p>
              </div>
            </div>

            <div>
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="Peso (kg) — ENTER para confirmar"
                value={currentPeso}
                onChange={(e) => setCurrentPeso(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-lg h-12 text-center"
                autoFocus
              />
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
              <Button className="flex-1" onClick={() => setStep("finalizando")} disabled={pesos.length === 0}>
                <Check className="w-4 h-4 mr-2" />
                Finalizar ({pesos.length})
              </Button>
            </div>
          </div>
        )}

        {step === "finalizando" && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-bold">{pesos.length} animais pesados</p>
              <p className="text-sm">Média: <strong>{mediaParcial.toFixed(1).replace(".", ",")} kg</strong></p>
              <p className="text-sm">
                Novo peso médio do lote: <strong>{calcNovoPesoMedio()?.toFixed(1).replace(".", ",")} kg</strong>
              </p>
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
  );
}
