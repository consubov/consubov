import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, GitFork, Loader2, Check, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExportarPesagemModal from "@/components/pesagem/ExportarPesagemModal";
import type { AnimalPesagem } from "@/utils/gerarPdfPesagem";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimais: number;
  retiroId: string;
  userId: string;
  userName: string;
  fazendaId: string;
  fazendaNome: string;
  retiroNome: string;
  onSaved?: () => void;
}

type LoteCount = 2 | 3 | 4;
type Ordem = "A" | "B" | "C" | "D";
const ORDENS: Ordem[] = ["A", "B", "C", "D"];

interface LoteConfig {
  ordem: Ordem;
  nome: string;
  limite: number; // peso máximo (último lote ignora)
}

interface PesoLancado {
  peso: number;
  ordem: Ordem;
}

interface PastoOption {
  id: string;
  nome: string;
  num_animais: number;
}

export default function ApartacaoFlowModal({ open, onClose, pastoId, pastoNome, numAnimais, retiroId, userId, userName, fazendaId, fazendaNome, retiroNome, onSaved }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loteCount, setLoteCount] = useState<LoteCount>(2);
  const [lotes, setLotes] = useState<LoteConfig[]>([
    { ordem: "A", nome: "Lote A", limite: 280 },
    { ordem: "B", nome: "Lote B", limite: 0 },
  ]);
  const [pesosLancados, setPesosLancados] = useState<PesoLancado[]>([]);
  const [currentPeso, setCurrentPeso] = useState("");
  const [pastosDisponiveis, setPastosDisponiveis] = useState<PastoOption[]>([]);
  const [destinos, setDestinos] = useState<Record<Ordem, string>>({ A: "", B: "", C: "", D: "" });
  const [destinoIndex, setDestinoIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exportData, setExportData] = useState<{ pesagemId: string; animais: AnimalPesagem[]; dataPesagem: string; hora: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    // Reset on open
    setStep(1);
    setLoteCount(2);
    setLotes([
      { ordem: "A", nome: "Lote A", limite: 280 },
      { ordem: "B", nome: "Lote B", limite: 0 },
    ]);
    setPesosLancados([]);
    setCurrentPeso("");
    setDestinos({ A: "", B: "", C: "", D: "" });
    setDestinoIndex(0);
  }, [open]);

  // Sync lotes array length with loteCount
  useEffect(() => {
    setLotes((prev) => {
      const next: LoteConfig[] = [];
      for (let i = 0; i < loteCount; i++) {
        const ordem = ORDENS[i];
        const existing = prev.find((l) => l.ordem === ordem);
        next.push(existing || { ordem, nome: `Lote ${ordem}`, limite: 0 });
      }
      return next;
    });
  }, [loteCount]);

  // Load pastos for destino
  useEffect(() => {
    if (step !== 4 || !retiroId) return;
    (async () => {
      const { data, error } = await supabase
        .from("pastos")
        .select("id, nome, num_animais")
        .eq("retiro_id", retiroId)
        .eq("ativo", true)
        .order("nome");
      if (error) {
        toast.error("Erro ao carregar pastos: " + error.message);
        return;
      }
      setPastosDisponiveis((data || []) as PastoOption[]);
    })();
  }, [step, retiroId]);

  // ===== Step 1 validation =====
  const step1Valid = useMemo(() => {
    // All lotes except last must have limite > previous limit
    for (let i = 0; i < lotes.length - 1; i++) {
      const lim = lotes[i].limite;
      if (!lim || lim <= 0) return false;
      if (i > 0 && lim <= lotes[i - 1].limite) return false;
      if (!lotes[i].nome.trim()) return false;
    }
    if (!lotes[lotes.length - 1].nome.trim()) return false;
    return true;
  }, [lotes]);

  function classificarPeso(peso: number): Ordem {
    for (let i = 0; i < lotes.length - 1; i++) {
      if (peso <= lotes[i].limite) return lotes[i].ordem;
    }
    return lotes[lotes.length - 1].ordem;
  }

  function lancarPeso() {
    const val = parseFloat(currentPeso.replace(",", "."));
    if (!val || val <= 0) return;
    if (pesosLancados.length >= numAnimais) {
      toast.error("Total de animais do pasto já atingido.");
      return;
    }
    const ordem = classificarPeso(val);
    setPesosLancados((prev) => [...prev, { peso: val, ordem }]);
    setCurrentPeso("");
  }

  function desfazerUltimo() {
    setPesosLancados((prev) => prev.slice(0, -1));
  }

  // ===== Stats per lote =====
  const stats = useMemo(() => {
    const map: Record<Ordem, { qtd: number; total: number; ultimos: number[] }> = {
      A: { qtd: 0, total: 0, ultimos: [] },
      B: { qtd: 0, total: 0, ultimos: [] },
      C: { qtd: 0, total: 0, ultimos: [] },
      D: { qtd: 0, total: 0, ultimos: [] },
    };
    pesosLancados.forEach((p) => {
      map[p.ordem].qtd++;
      map[p.ordem].total += p.peso;
    });
    // Last 3 per lote
    for (const ordem of ORDENS) {
      const ult = pesosLancados.filter((p) => p.ordem === ordem).slice(-3).reverse().map((p) => p.peso);
      map[ordem].ultimos = ult;
    }
    return map;
  }, [pesosLancados]);

  const totalPesado = pesosLancados.length;
  const mediaGeral = totalPesado > 0 ? pesosLancados.reduce((a, b) => a + b.peso, 0) / totalPesado : 0;

  function faixaTexto(idx: number): string {
    const lote = lotes[idx];
    if (idx === lotes.length - 1) {
      const prev = lotes[idx - 1]?.limite || 0;
      return `acima de ${prev} kg`;
    }
    if (idx === 0) return `até ${lote.limite} kg`;
    return `${lotes[idx - 1].limite + 0.1} a ${lote.limite} kg`;
  }

  function faixaCurta(idx: number): string {
    const lote = lotes[idx];
    if (idx === lotes.length - 1) {
      const prev = lotes[idx - 1]?.limite || 0;
      return `acima de ${prev} kg`;
    }
    return `até ${lote.limite} kg`;
  }

  // ===== Salvar =====
  async function finalizarApartacao() {
    setSaving(true);
    try {
      // Validate all destinos chosen
      for (const lote of lotes) {
        if (stats[lote.ordem].qtd > 0 && !destinos[lote.ordem]) {
          toast.error(`Selecione destino para ${lote.nome}`);
          setSaving(false);
          return;
        }
      }

      const nowIso = new Date().toISOString();

      // 1) Insert apartacao
      const { data: apart, error: apartErr } = await (supabase.from("apartacoes") as any)
        .insert({
          pasto_origem_id: pastoId,
          retiro_id: retiroId,
          usuario_id: userId,
          total_animais: totalPesado,
          media_geral_kg: Math.round(mediaGeral * 10) / 10,
          quantidade_lotes: lotes.length,
        })
        .select("id")
        .single();
      if (apartErr) throw apartErr;

      // 2) Insert lotes
      const loteRows = lotes.map((lote, idx) => {
        const s = stats[lote.ordem];
        const min = idx === 0 ? null : lotes[idx - 1].limite;
        const max = idx === lotes.length - 1 ? null : lote.limite;
        return {
          apartacao_id: apart.id,
          pasto_destino_id: destinos[lote.ordem] || null,
          nome_lote: lote.nome,
          ordem: lote.ordem,
          faixa_peso_min: min,
          faixa_peso_max: max,
          quantidade: s.qtd,
          media_kg: s.qtd > 0 ? Math.round((s.total / s.qtd) * 10) / 10 : null,
        };
      });
      const { error: lotesErr } = await (supabase.from("apartacao_lotes") as any).insert(loteRows);
      if (lotesErr) throw lotesErr;

      // Detect if origin pasto is also a destination, and how many animals stay
      const loteFicaOrigem = lotes.find((l) => destinos[l.ordem] === pastoId && stats[l.ordem].qtd > 0);
      const qtdFicaOrigem = loteFicaOrigem ? stats[loteFicaOrigem.ordem].qtd : 0;
      const mediaFicaOrigem = loteFicaOrigem
        ? Math.round((stats[loteFicaOrigem.ordem].total / stats[loteFicaOrigem.ordem].qtd) * 10) / 10
        : null;

      // 3) Fetch origin history once (for copy to other destinations)
      const [pesagensOrig, sanitariosOrig, eventosOrig] = await Promise.all([
        supabase.from("pesagens").select("*").eq("lote_id", pastoId),
        supabase.from("eventos_sanitarios").select("*").eq("lote_id", pastoId),
        supabase.from("eventos_lote").select("*").eq("lote_id", pastoId),
      ]);

      // 4) Update destinos: pasto_origem_id, num_animais, peso_medio + copy history
      const destinosProcessados = new Set<string>();
      for (const lote of lotes) {
        const s = stats[lote.ordem];
        const destId = destinos[lote.ordem];
        if (!destId || s.qtd === 0) continue;

        const isOrigem = destId === pastoId;
        const mediaLote = s.total / s.qtd;

        if (isOrigem) {
          // Lote permanece no pasto de origem: NÃO mexer aqui, será tratado abaixo
          continue;
        }

        const { data: pastoDest } = await (supabase.from("pastos") as any)
          .select("num_animais, peso_medio_kg")
          .eq("id", destId)
          .single();
        const novaQtd = (pastoDest?.num_animais || 0) + s.qtd;
        const pesoAtual = pastoDest?.peso_medio_kg || 0;
        const qtdAtual = pastoDest?.num_animais || 0;
        const novoPesoMedio = novaQtd > 0
          ? Math.round(((pesoAtual * qtdAtual + mediaLote * s.qtd) / novaQtd) * 10) / 10
          : Math.round(mediaLote * 10) / 10;
        await (supabase.from("pastos") as any)
          .update({
            pasto_origem_id: pastoId,
            num_animais: novaQtd,
            peso_medio_kg: novoPesoMedio,
            data_movimentacao: nowIso,
            ultima_pesagem_em: nowIso,
          })
          .eq("id", destId);

        // Copy history once per unique destination (not origin)
        if (!destinosProcessados.has(destId)) {
          destinosProcessados.add(destId);

          if (pesagensOrig.data && pesagensOrig.data.length > 0) {
            const rows = pesagensOrig.data.map((r: any) => {
              const { id, ...rest } = r;
              return { ...rest, lote_id: destId };
            });
            await (supabase.from("pesagens") as any).insert(rows);
          }
          if (sanitariosOrig.data && sanitariosOrig.data.length > 0) {
            const rows = sanitariosOrig.data.map((r: any) => {
              const { id, ...rest } = r;
              return { ...rest, lote_id: destId };
            });
            await (supabase.from("eventos_sanitarios") as any).insert(rows);
          }
          if (eventosOrig.data && eventosOrig.data.length > 0) {
            const rows = eventosOrig.data.map((r: any) => {
              const { id, criado_em, ...rest } = r;
              return { ...rest, lote_id: destId };
            });
            await (supabase.from("eventos_lote") as any).insert(rows);
          }
        }
      }

      // 5) Update pasto origem: se um lote ficou nele, manter qtd e atualizar peso médio; senão zerar
      if (loteFicaOrigem) {
        await (supabase.from("pastos") as any)
          .update({
            num_animais: qtdFicaOrigem,
            peso_medio_kg: mediaFicaOrigem,
            data_movimentacao: nowIso,
            ultima_pesagem_em: nowIso,
          })
          .eq("id", pastoId);
      } else {
        await (supabase.from("pastos") as any)
          .update({ num_animais: 0, data_movimentacao: nowIso })
          .eq("id", pastoId);
      }

      // 6) Insert pesagem record (the apartacao IS a pesagem) — becomes most recent for origin and destinations
      const animaisArr: AnimalPesagem[] = pesosLancados.map((p, i) => ({
        id: crypto.randomUUID(),
        numero: i + 1,
        pesoKg: p.peso,
      }));
      const pesosNumeros = pesosLancados.map((p) => p.peso);
      const mediaCalc = Math.round(mediaGeral * 10) / 10;

      // Create one evento_lote + pesagem for the origin (canonical record of the apartação)
      const { data: evento } = await (supabase.from("eventos_lote") as any)
        .insert({
          lote_id: pastoId,
          tipo: "pesagem_apartacao",
          usuario_id: userId,
          data_evento: nowIso,
          dados: { apartacao_id: apart.id, total_pesado: totalPesado, media: mediaCalc },
        })
        .select("id")
        .single();

      if (evento) {
        await (supabase.from("pesagens") as any).insert({
          evento_id: evento.id,
          lote_id: pastoId,
          total_pesado: totalPesado,
          pesos: pesosNumeros as any,
          media_calculada: mediaCalc,
          peso_medio_aplicado: mediaCalc,
          data_pesagem: nowIso,
          usuario_id: userId,
        });

        // Replicate this pesagem to each destination so it becomes their latest
        for (const destId of destinosProcessados) {
          const { data: evDest } = await (supabase.from("eventos_lote") as any)
            .insert({
              lote_id: destId,
              tipo: "pesagem_apartacao",
              usuario_id: userId,
              data_evento: nowIso,
              dados: { apartacao_id: apart.id, total_pesado: totalPesado, media: mediaCalc },
            })
            .select("id")
            .single();
          if (evDest) {
            await (supabase.from("pesagens") as any).insert({
              evento_id: evDest.id,
              lote_id: destId,
              total_pesado: totalPesado,
              pesos: pesosNumeros as any,
              media_calculada: mediaCalc,
              peso_medio_aplicado: mediaCalc,
              data_pesagem: nowIso,
              usuario_id: userId,
            });
          }
        }
      }

      toast.success("Apartação finalizada!");
      onSaved?.();

      // Open export PDF modal
      const hora = new Date(nowIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setExportData({ pesagemId: evento?.id || apart.id, animais: animaisArr, dataPesagem: nowIso, hora });
    } catch (err: any) {
      toast.error("Erro ao salvar apartação: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function handleVoltar() {
    if (step === 1) onClose();
    else if (step === 4 && destinoIndex > 0) setDestinoIndex((i) => i - 1);
    else setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  const lotesComAnimais = lotes.filter((l) => stats[l.ordem].qtd > 0);
  const loteAtualDestino = lotesComAnimais[destinoIndex];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-primary" />
            Pesagem + Apartação
          </DialogTitle>
          <DialogDescription>
            {pastoNome} — Etapa {step} de 4
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex gap-1 py-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`flex-1 h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* ETAPA 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Quantidade de lotes</Label>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as LoteCount[]).map((n) => (
                  <Button
                    key={n}
                    variant={loteCount === n ? "default" : "outline"}
                    onClick={() => setLoteCount(n)}
                    className="h-10"
                  >
                    {ORDENS.slice(0, n).join("+")}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {lotes.map((lote, idx) => {
                const isLast = idx === lotes.length - 1;
                const prev = idx > 0 ? lotes[idx - 1].limite : 0;
                return (
                  <div key={lote.ordem} className="space-y-2 p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{lote.ordem}</Badge>
                      <Input
                        value={lote.nome}
                        onChange={(e) =>
                          setLotes((prev) => prev.map((l, i) => (i === idx ? { ...l, nome: e.target.value } : l)))
                        }
                        className="h-9 text-sm"
                        placeholder={`Lote ${lote.ordem}`}
                      />
                    </div>
                    {isLast ? (
                      <div className="text-sm text-muted-foreground">
                        Acima de <strong>{prev} kg</strong> (automático)
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs">{lote.nome}: até ___ kg</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={lote.limite || ""}
                          onChange={(e) =>
                            setLotes((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, limite: parseFloat(e.target.value) || 0 } : l)),
                            )
                          }
                          className="h-9"
                          placeholder="kg"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleVoltar} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button disabled={!step1Valid} onClick={() => setStep(2)} className="flex-1">
                Avançar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 2 */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted">
                <p className="text-lg font-bold text-primary">
                  {totalPesado} / {numAnimais}
                </p>
                <p className="text-xs text-muted-foreground">total pesado</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <p className="text-lg font-bold text-primary">
                  {mediaGeral > 0 ? mediaGeral.toFixed(1).replace(".", ",") : "—"}
                </p>
                <p className="text-xs text-muted-foreground">média geral (kg)</p>
              </div>
            </div>

            <div className="space-y-2">
              {lotes.map((lote, idx) => {
                const s = stats[lote.ordem];
                const media = s.qtd > 0 ? s.total / s.qtd : 0;
                return (
                  <Card key={lote.ordem} className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge>{lote.ordem}</Badge>
                        <span className="text-sm font-medium">{lote.nome}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{faixaCurta(idx)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>
                        Qtd: <strong>{s.qtd}</strong>
                      </span>
                      <span>
                        Média: <strong>{s.qtd > 0 ? media.toFixed(1).replace(".", ",") : "—"} kg</strong>
                      </span>
                    </div>
                    {s.ultimos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.ultimos.map((p, i) => (
                          <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {p} kg
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="space-y-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Peso (kg)"
                value={currentPeso}
                onChange={(e) => setCurrentPeso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lancarPeso();
                  }
                }}
                className="text-lg h-12 text-center"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={desfazerUltimo}
                  disabled={pesosLancados.length === 0}
                  size="sm"
                >
                  <Undo2 className="w-4 h-4 mr-1" /> Desfazer última
                </Button>
                <Button onClick={lancarPeso} className="flex-1" disabled={!currentPeso}>
                  Lançar
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleVoltar} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={totalPesado === 0} className="flex-1">
                Finalizar Pesagem <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3 */}
        {step === 3 && (
          <div className="space-y-3">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasto origem:</span>
                  <strong>{pastoNome}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <strong>{new Date().toLocaleDateString("pt-BR")}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuário:</span>
                  <strong>{userName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total pesado:</span>
                  <strong>{totalPesado} animais</strong>
                </div>
              </CardContent>
            </Card>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Lote</th>
                    <th className="text-right p-2">Qtd</th>
                    <th className="text-right p-2">Média</th>
                    <th className="text-right p-2">Faixa</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((lote, idx) => {
                    const s = stats[lote.ordem];
                    return (
                      <tr key={lote.ordem} className="border-t">
                        <td className="p-2">{lote.nome}</td>
                        <td className="p-2 text-right">{s.qtd}</td>
                        <td className="p-2 text-right">
                          {s.qtd > 0 ? (s.total / s.qtd).toFixed(1).replace(".", ",") : "—"} kg
                        </td>
                        <td className="p-2 text-right text-xs">{faixaCurta(idx)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleVoltar} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Confirmar e Definir Destinos <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 4 */}
        {step === 4 && loteAtualDestino && (
          <div className="space-y-3">
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge>{loteAtualDestino.ordem}</Badge>
                  <strong>{loteAtualDestino.nome}</strong>
                </div>
                <div className="text-xs text-muted-foreground">
                  Quantidade: <strong>{stats[loteAtualDestino.ordem].qtd}</strong> · Média:{" "}
                  <strong>
                    {(stats[loteAtualDestino.ordem].total / stats[loteAtualDestino.ordem].qtd)
                      .toFixed(1)
                      .replace(".", ",")}{" "}
                    kg
                  </strong>
                </div>
                <div className="text-xs text-muted-foreground">
                  Destino {destinoIndex + 1} de {lotesComAnimais.length}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              <Label className="text-sm">Selecione o pasto destino:</Label>
              {pastosDisponiveis.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum pasto disponível.</p>
              )}
              {pastosDisponiveis.map((p) => (
                <Button
                  key={p.id}
                  variant={destinos[loteAtualDestino.ordem] === p.id ? "default" : "outline"}
                  className="w-full justify-between h-auto py-2"
                  onClick={() => setDestinos((prev) => ({ ...prev, [loteAtualDestino.ordem]: p.id }))}
                >
                  <span>{p.nome}</span>
                  <span className="text-xs opacity-70">{p.num_animais} animais</span>
                </Button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleVoltar} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              {destinoIndex < lotesComAnimais.length - 1 ? (
                <Button
                  disabled={!destinos[loteAtualDestino.ordem]}
                  onClick={() => setDestinoIndex((i) => i + 1)}
                  className="flex-1"
                >
                  Confirmar Destino <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  disabled={!destinos[loteAtualDestino.ordem] || saving}
                  onClick={finalizarApartacao}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Finalizar Apartação
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
