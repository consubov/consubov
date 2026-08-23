import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PhotoGrid from "./PhotoGrid";
import ScoreSamplesInput, { ScoreSample } from "./ScoreSamplesInput";
import { hasPendingLocalChanges, loadSnapshot, offlineDelete, offlineUpdate, offlineUpsert } from "@/lib/consultorOffline/snapshotStore";

export interface VisitaPastoRow {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  consumo_real_kg: number | null;
  consumo_esperado_kg: number | null;
  peso_medio_kg: number | null;
  categoria: string | null;
  observacao: string | null;
  ordem: number;
  scores?: { fezes?: number; corporal?: number; bebedouro?: number };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  visitaId: string;
  pasto: VisitaPastoRow | null;
  proximaLetra: string;
  proximaOrdem: number;
  onSaved: () => void;
  readOnly?: boolean;
}

const PRODUTOS = [
  { value: "mineral", label: "Mineral" },
  { value: "racao", label: "Ração" },
  { value: "proteinado_0.1", label: "Proteinado 0,1%" },
  { value: "proteinado_0.3", label: "Proteinado 0,3%" },
  { value: "proteinado_0.5", label: "Proteinado 0,5%" },
  { value: "proteinado_1", label: "Proteinado 1%" },
  { value: "outro", label: "Outro" },
];

const CATEGORIAS = ["Vaca", "Bezerro(a)", "Recria 1", "Recria 2", "Terminação"];

type SamplesState = { fezes: ScoreSample[]; corporal: ScoreSample[]; bebedouro: ScoreSample[] };
const EMPTY_SAMPLES: SamplesState = { fezes: [], corporal: [], bebedouro: [] };

/** Extract percent from product code like "proteinado_0.3" -> "0,3%". Returns null when none. */
function extractPercentFromProduto(code: string): string | null {
  const m = /^proteinado_([0-9]+(?:\.[0-9]+)?)/.exec(code);
  if (!m) return null;
  return m[1].replace(".", ",") + "%";
}

/** Parse pt-BR percent string like "0,3%" or "0.3" to number. */
function parsePercent(v: string | null | undefined): number {
  if (!v) return 0;
  const cleaned = String(v).replace("%", "").replace(",", ".").trim();
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function fmt(n: number, dec = 1): string {
  if (!isFinite(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function PastoVisitaModal({
  open, onOpenChange, visitaId, pasto, proximaLetra, proximaOrdem, onSaved, readOnly,
}: Props) {
  const [pastoIdLocal, setPastoIdLocal] = useState<string | null>(null);
  const [letra, setLetra] = useState("");
  const [numPasto, setNumPasto] = useState("");
  const [qtdAnimais, setQtdAnimais] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [tipoProduto, setTipoProduto] = useState("");
  const [percentualPv, setPercentualPv] = useState("");
  const [consumoEsperado, setConsumoEsperado] = useState("");
  const [consumoReal, setConsumoReal] = useState("");
  const [esperadoManual, setEsperadoManual] = useState(false);
  const [metaG100kg, setMetaG100kg] = useState("");
  const [kgConsumidos, setKgConsumidos] = useState("");
  const [diasConsumo, setDiasConsumo] = useState("");


  const [obs, setObs] = useState("");
  const [samples, setSamples] = useState<SamplesState>(EMPTY_SAMPLES);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pasto) {
      setPastoIdLocal(pasto.id);
      setLetra(pasto.letra);
      setNumPasto(pasto.num_pasto || "");
      setQtdAnimais(pasto.qtd_animais?.toString() || "");
      setCategoria(pasto.categoria || "");
      setPesoMedio(pasto.peso_medio_kg?.toString() || "");
      setTipoProduto(pasto.tipo_produto || "");
      setPercentualPv(pasto.percentual_pv || "");
      setConsumoEsperado(pasto.consumo_esperado_kg?.toString() || "");
      {
        // detecta se o valor salvo foi digitado manualmente (difere do cálculo)
        const pv = (Number(pasto.qtd_animais) || 0) * (Number(pasto.peso_medio_kg) || 0);
        const pct = parsePercent(pasto.percentual_pv || "");
        const calc = pv > 0 && pct > 0 ? (pv * pct) / 100 : 0;
        const saved = Number(pasto.consumo_esperado_kg) || 0;
        setEsperadoManual(saved > 0 && Math.abs(saved - calc) > 0.05);
      }

      setConsumoReal((pasto.consumo_real_kg ?? pasto.consumo_kg_dia)?.toString() || "");
      setMetaG100kg((pasto as any).meta_g_100kg?.toString() || "");
      setKgConsumidos((pasto as any).kg_consumidos?.toString() || "");
      setDiasConsumo((pasto as any).dias_consumo?.toString() || "");
      setObs(pasto.observacao || "");

      const online = typeof navigator === "undefined" || navigator.onLine;
      (async () => {
        const snap = await loadSnapshot(visitaId);
        const snapPasto = (snap?.pastos || []).find((p: any) => p.id === pasto.id) as any;
        const preferLocal = !!snapPasto?.samples && await hasPendingLocalChanges(visitaId);
        if (preferLocal || !online) return { data: [], snap, snapPasto };
        const res = await supabase.from("avaliacoes_score")
          .select("id, tipo, nota")
          .eq("visita_pasto_id", pasto.id);
        return { ...res, snap, snapPasto };
      })().then(async ({ data, snap, snapPasto }) => {
          const next: SamplesState = { fezes: [], corporal: [], bebedouro: [] };
          let rows = (data as any[]) || [];
          if (rows.length === 0) {
            if (snapPasto?.samples) {
              setSamples({
                fezes: snapPasto.samples.fezes || [],
                corporal: snapPasto.samples.corporal || [],
                bebedouro: snapPasto.samples.bebedouro || [],
              });
              return;
            }
            rows = ((snap?.avaliacoes_score as any[]) || []).filter((s: any) => s.visita_pasto_id === pasto.id);
          }
          rows.forEach((s: any) => {
            if (s.tipo in next) next[s.tipo as keyof SamplesState].push({ id: s.id, nota: s.nota });
          });
          setSamples(next);
        });
    } else {
      setPastoIdLocal(null);
      setLetra(proximaLetra);
      setNumPasto(""); setQtdAnimais(""); setCategoria(""); setPesoMedio("");
      setTipoProduto(""); setPercentualPv("");
      setConsumoEsperado(""); setConsumoReal(""); setEsperadoManual(false);
      setMetaG100kg(""); setKgConsumidos(""); setDiasConsumo("");
      setObs(""); setSamples(EMPTY_SAMPLES);

    }
  }, [open, pasto, proximaLetra]);

  // Modo de cálculo derivado do tipo de produto
  const modo: "mineral" | "racao" | "outro" | "proteinado" | "" =
    tipoProduto === "mineral" ? "mineral"
    : tipoProduto === "racao" ? "racao"
    : tipoProduto === "outro" ? "outro"
    : tipoProduto.startsWith("proteinado") ? "proteinado"
    : "";

  // Auto-calc peso vivo total & consumo esperado (only suggests; user can override)
  const pesoVivoTotal = useMemo(() => {
    const a = Number(qtdAnimais) || 0;
    const p = Number(pesoMedio) || 0;
    return a * p;
  }, [qtdAnimais, pesoMedio]);

  const consumoEsperadoCalc = useMemo(() => {
    const pct = parsePercent(percentualPv);
    if (pesoVivoTotal <= 0 || pct <= 0) return 0;
    return (pesoVivoTotal * pct) / 100;
  }, [pesoVivoTotal, percentualPv]);

  // Recalcula sempre que qualquer entrada muda (100% no cliente / offline),
  // exceto se o usuário digitou manualmente um valor de consumo esperado.
  useEffect(() => {
    if (modo === "mineral" || modo === "racao" || modo === "outro") return;
    if (esperadoManual) return;
    if (consumoEsperadoCalc > 0) {
      setConsumoEsperado(String(Number(consumoEsperadoCalc.toFixed(2))));
    } else {
      setConsumoEsperado("");
    }
  }, [consumoEsperadoCalc, esperadoManual, modo]);

  const indiceMeta = useMemo(() => {
    const real = Number(consumoReal) || 0;
    const esp = Number(consumoEsperado) || 0;
    if (esp <= 0 || real <= 0) return 0;
    return (real / esp) * 100;
  }, [consumoReal, consumoEsperado]);

  // ===== Cálculos dedicados (100% no cliente, reativos, offline) =====
  const calc = useMemo(() => {
    const animais = Number(qtdAnimais) || 0;
    const peso = Number(pesoMedio) || 0;
    const kg = Number(kgConsumidos) || 0;
    const dias = Number(diasConsumo) || 0;
    const meta = Number(metaG100kg) || 0;
    const cabDia = animais > 0 && dias > 0 ? animais * dias : 0;

    if (modo === "mineral") {
      const espG = meta > 0 && peso > 0 ? (meta / 100) * peso : 0;
      const realG = cabDia > 0 && kg > 0 ? (kg * 1000) / cabDia : 0;
      const indice = espG > 0 && realG > 0 ? (realG / espG) * 100 : 0;
      return { espG, realG, indice, kgCabDia: 0, pctPv: 0, gCabDia: 0 };
    }
    if (modo === "racao" || modo === "outro") {
      const kgCabDia = cabDia > 0 && kg > 0 ? kg / cabDia : 0;
      const pctPv = kgCabDia > 0 && peso > 0 ? (kgCabDia / peso) * 100 : 0;
      return { espG: 0, realG: 0, indice: 0, kgCabDia, pctPv, gCabDia: kgCabDia * 1000 };
    }
    return { espG: 0, realG: 0, indice: 0, kgCabDia: 0, pctPv: 0, gCabDia: 0 };
  }, [modo, qtdAnimais, pesoMedio, kgConsumidos, diasConsumo, metaG100kg]);

  const statusMeta = calc.indice > 0
    ? (calc.indice < 80 ? "Baixo" : calc.indice > 120 ? "Alto" : "Ideal")
    : "";

  function handleTipoProdutoChange(v: string) {
    setTipoProduto(v);
    const pct = extractPercentFromProduto(v);
    if (pct) {
      setPercentualPv(pct);
      // troca de produto volta ao cálculo automático
      setEsperadoManual(false);
    }
  }



  const ensurePasto = useCallback(async (): Promise<string | null> => {
    if (pastoIdLocal) return pastoIdLocal;
    if (!letra.trim()) return null;
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const payload = {
        visita_id: visitaId,
        letra: letra.trim().toUpperCase(),
        ordem: proximaOrdem,
      };
      const res = await offlineUpsert({
        visitaId,
        table: "visita_pastos",
        rowId: id,
        payload,
        applyToSnapshot: (curr, p) => ({
          ...curr,
          pastos: [...(curr.pastos || []), { id, ...p, fotos: [], signed: {}, samples: { fezes: [], corporal: [], bebedouro: [] } }],
        }),
      });
      if (res.queued) toast.info("Pasto salvo off-line.");
      setPastoIdLocal(id);
      return id;
    } catch (err: any) {
      toast.error("Erro ao criar pasto: " + (err?.message || ""));
      return null;
    } finally {
      setCreating(false);
    }
  }, [pastoIdLocal, letra, visitaId, proximaOrdem]);

  async function handleLetraBlur() {
    if (readOnly) return;
    if (!pastoIdLocal && letra.trim()) {
      await ensurePasto();
    } else if (pastoIdLocal && letra.trim()) {
      await offlineUpdate({
        visitaId,
        table: "visita_pastos",
        rowId: pastoIdLocal,
        patch: { letra: letra.trim().toUpperCase() },
        applyToSnapshot: (curr, patch) => ({
          ...curr,
          pastos: (curr.pastos || []).map((p: any) => p.id === pastoIdLocal ? { ...p, ...patch } : p),
        }),
      });
    }
  }

  async function addSample(tipo: keyof SamplesState, nota: number) {
    const id = await ensurePasto();
    if (!id) { toast.error("Informe a letra do pasto primeiro"); return; }
    const scoreId = crypto.randomUUID();
    const item = { id: scoreId, nota };
    setSamples(prev => ({ ...prev, [tipo]: [...prev[tipo], item] }));
    const res = await offlineUpsert({
      visitaId,
      table: "avaliacoes_score",
      rowId: scoreId,
      payload: { visita_pasto_id: id, tipo, nota },
      applyToSnapshot: (curr, payload) => ({
        ...curr,
        avaliacoes_score: [...(curr.avaliacoes_score || []), { id: scoreId, ...payload }],
        pastos: (curr.pastos || []).map((p: any) => p.id === id
          ? { ...p, samples: { ...(p.samples || EMPTY_SAMPLES), [tipo]: [...((p.samples || EMPTY_SAMPLES)[tipo] || []), item] } }
          : p),
      }),
    });
    if (res.queued) toast.info("Amostra salva off-line.");
  }

  async function removeSample(tipo: keyof SamplesState, index: number) {
    const s = samples[tipo][index];
    if (!s?.id) return;
    await offlineDelete({
      visitaId,
      table: "avaliacoes_score",
      rowId: s.id,
      applyToSnapshot: (curr) => ({
        ...curr,
        avaliacoes_score: ((curr.avaliacoes_score as any[]) || []).filter((x: any) => x.id !== s.id),
        pastos: (curr.pastos || []).map((p: any) => p.id === (pastoIdLocal || pasto?.id)
          ? { ...p, samples: { ...(p.samples || EMPTY_SAMPLES), [tipo]: ((p.samples || EMPTY_SAMPLES)[tipo] || []).filter((x: any) => x.id !== s.id) } }
          : p),
      }),
    });
    setSamples(prev => ({ ...prev, [tipo]: prev[tipo].filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!letra.trim()) return toast.error("Letra é obrigatória");
    setSaving(true);
    try {
      const id = await ensurePasto();
      if (!id) return;
      const realN = consumoReal ? Number(consumoReal) : null;
      const base = {
        letra: letra.trim().toUpperCase(),
        num_pasto: numPasto.trim() || null,
        qtd_animais: qtdAnimais ? Number(qtdAnimais) : null,
        categoria: categoria || null,
        peso_medio_kg: pesoMedio ? Number(pesoMedio) : null,
        tipo_produto: tipoProduto || null,
        observacao: obs.trim() || null,
        meta_g_100kg: null as number | null,
        kg_consumidos: kgConsumidos ? Number(kgConsumidos) : null,
        dias_consumo: diasConsumo ? Number(diasConsumo) : null,
      };
      let payload: Record<string, any>;
      if (modo === "mineral") {
        payload = {
          ...base,
          meta_g_100kg: metaG100kg ? Number(metaG100kg) : null,
          percentual_pv: null,
          consumo_esperado_kg: calc.espG > 0 ? calc.espG / 1000 : null,
          consumo_real_kg: calc.realG > 0 ? calc.realG / 1000 : null,
          consumo_kg_dia: calc.realG > 0 ? calc.realG / 1000 : null,
          consumo_medio_g: calc.realG > 0 ? calc.realG : null,
        };
      } else if (modo === "racao") {
        payload = {
          ...base,
          percentual_pv: calc.pctPv > 0 ? `${calc.pctPv.toFixed(2).replace(".", ",")}%` : null,
          consumo_esperado_kg: null,
          consumo_real_kg: calc.kgCabDia > 0 ? calc.kgCabDia : null,
          consumo_kg_dia: calc.kgCabDia > 0 ? calc.kgCabDia : null,
          consumo_medio_g: calc.gCabDia > 0 ? calc.gCabDia : null,
        };
      } else if (modo === "outro") {
        payload = {
          ...base,
          percentual_pv: null,
          consumo_esperado_kg: null,
          consumo_real_kg: calc.kgCabDia > 0 ? calc.kgCabDia : null,
          consumo_kg_dia: calc.kgCabDia > 0 ? calc.kgCabDia : null,
          consumo_medio_g: calc.gCabDia > 0 ? calc.gCabDia : null,
        };
      } else {
        payload = {
          ...base,
          kg_consumidos: null,
          dias_consumo: null,
          percentual_pv: percentualPv.trim() || null,
          consumo_esperado_kg: consumoEsperado ? Number(consumoEsperado) : null,
          consumo_real_kg: realN,
          consumo_kg_dia: realN, // manter em sync p/ compatibilidade
        };
      }

      const res = await offlineUpdate({
        visitaId,
        table: "visita_pastos",
        rowId: id,
        patch: payload,
        applyToSnapshot: (curr, p) => ({
          ...curr,
          pastos: (curr.pastos || []).map((x: any) => x.id === id ? { ...x, ...p } : x),
        }),
      });
      if (res.queued) toast.info("Pasto salvo off-line.");
      toast.success(pasto ? "Pasto atualizado" : "Pasto adicionado");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pasto ? `Pasto ${pasto.letra}` : "Adicionar Pasto"}</DialogTitle>
          <DialogDescription>Registre os dados do pasto e as avaliações.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Letra *</Label>
              <div className="relative">
                <Input
                  value={letra}
                  onChange={e => setLetra(e.target.value)}
                  onBlur={handleLetraBlur}
                  maxLength={2}
                  disabled={readOnly}
                  autoFocus={!pasto}
                />
                {creating && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Nº Pasto</Label>
              <Input value={numPasto} onChange={e => setNumPasto(e.target.value)} disabled={readOnly} />
            </div>
          </div>

          {/* Categoria - chips */}
          <div>
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CATEGORIAS.map(c => {
                const active = categoria === c;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setCategoria(active ? "" : c)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70",
                      readOnly && "opacity-60 cursor-not-allowed"
                    )}
                  >{c}</button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Qtd. Animais</Label>
              <Input type="number" inputMode="numeric" value={qtdAnimais} onChange={e => setQtdAnimais(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>Peso Médio (kg)</Label>
              <Input type="number" inputMode="decimal" step="any" value={pesoMedio} onChange={e => setPesoMedio(e.target.value)} disabled={readOnly} />
            </div>
          </div>

          <div>
            <Label>Tipo de Produto</Label>
            <Select value={tipoProduto} onValueChange={handleTipoProdutoChange} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PRODUTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {modo === "mineral" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Meta do produto (g/100kg PV)</Label>
                  <Input type="number" inputMode="decimal" step="any" value={metaG100kg} onChange={e => setMetaG100kg(e.target.value)} placeholder="ex: 25" disabled={readOnly} />
                </div>
                <div>
                  <Label>Qtd. consumida (kg)</Label>
                  <Input type="number" inputMode="decimal" step="any" value={kgConsumidos} onChange={e => setKgConsumidos(e.target.value)} disabled={readOnly} />
                </div>
              </div>
              <div>
                <Label>Dias desde a última salga</Label>
                <Input type="number" inputMode="numeric" step="any" value={diasConsumo} onChange={e => setDiasConsumo(e.target.value)} disabled={readOnly} />
              </div>
              <div className="rounded-md border p-2.5 bg-muted/40 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo esperado</div>
                  <div className="font-semibold text-foreground">{calc.espG > 0 ? `${fmt(calc.espG, 1)} g/cab/dia` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo real</div>
                  <div className="font-semibold text-foreground">{calc.realG > 0 ? `${fmt(calc.realG, 1)} g/cab/dia` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Índice da meta</div>
                  <div className="font-semibold text-foreground">{calc.indice > 0 ? `${fmt(calc.indice, 1)}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Situação</div>
                  <div className="font-semibold text-foreground">{statusMeta || "—"}</div>
                </div>
              </div>
            </>
          )}

          {(modo === "racao" || modo === "outro") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{modo === "racao" ? "Qtd. consumida (kg)" : "Qtd. fornecida (kg)"}</Label>
                  <Input type="number" inputMode="decimal" step="any" value={kgConsumidos} onChange={e => setKgConsumidos(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <Label>Dias de consumo</Label>
                  <Input type="number" inputMode="numeric" step="any" value={diasConsumo} onChange={e => setDiasConsumo(e.target.value)} disabled={readOnly} />
                </div>
              </div>
              <div className="rounded-md border p-2.5 bg-muted/40 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo</div>
                  <div className="font-semibold text-foreground">{calc.kgCabDia > 0 ? `${fmt(calc.kgCabDia, 2)} kg/cab/dia` : "—"}</div>
                </div>
                {modo === "racao" ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">% do peso vivo</div>
                    <div className="font-semibold text-foreground">{calc.pctPv > 0 ? `${fmt(calc.pctPv, 2)}%` : "—"}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo (g/cab/dia)</div>
                    <div className="font-semibold text-foreground">{calc.gCabDia > 0 ? `${fmt(calc.gCabDia, 0)} g/cab/dia` : "—"}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {modo !== "mineral" && modo !== "racao" && modo !== "outro" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>% Peso Vivo</Label>
                  <Input value={percentualPv} onChange={e => setPercentualPv(e.target.value)} placeholder="ex: 0,3%" disabled={readOnly} />
                </div>
                <div>
                  <Label>Consumo Esperado (kg/dia)</Label>
                  <Input type="number" inputMode="decimal" step="any" value={consumoEsperado} onChange={e => { setEsperadoManual(true); setConsumoEsperado(e.target.value); }} disabled={readOnly} />
                </div>
              </div>

              <div>
                <Label>Consumo Real (kg/dia)</Label>
                <Input type="number" inputMode="decimal" step="any" value={consumoReal} onChange={e => setConsumoReal(e.target.value)} disabled={readOnly} />
              </div>

              {/* Resumo calculado */}
              <div className="rounded-md border p-2.5 bg-muted/40 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Peso vivo total</div>
                  <div className="font-semibold text-foreground">{pesoVivoTotal > 0 ? `${fmt(pesoVivoTotal, 0)} kg` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo esperado</div>
                  <div className="font-semibold text-foreground">{Number(consumoEsperado) > 0 ? `${fmt(Number(consumoEsperado), 1)} kg/dia` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consumo real</div>
                  <div className="font-semibold text-foreground">{Number(consumoReal) > 0 ? `${fmt(Number(consumoReal), 1)} kg/dia` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Índice / Meta</div>
                  <div className="font-semibold text-foreground">{indiceMeta > 0 ? `${fmt(indiceMeta, 1)}%` : "—"}</div>
                </div>
              </div>
            </>
          )}


          <div>
            <Label>Observação</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} disabled={readOnly} />
          </div>

          <div className="pt-2 border-t space-y-4">
            <div className="text-sm font-semibold text-foreground">Avaliações (1–5) — múltiplas amostras</div>
            <ScoreSamplesInput
              label="Fezes" samples={samples.fezes}
              onAdd={n => addSample("fezes", n)} onRemove={i => removeSample("fezes", i)} disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Escore Corporal" samples={samples.corporal}
              onAdd={n => addSample("corporal", n)} onRemove={i => removeSample("corporal", i)} disabled={readOnly}
            />
            <ScoreSamplesInput
              label="Bebedouro" samples={samples.bebedouro}
              onAdd={n => addSample("bebedouro", n)} onRemove={i => removeSample("bebedouro", i)} disabled={readOnly}
            />
          </div>

          <div className="pt-2 border-t">
            <PhotoGrid visitaId={visitaId} visitaPastoId={pastoIdLocal} disabled={readOnly} />
            {!pastoIdLocal && (
              <p className="text-[11px] text-muted-foreground mt-1">Informe a letra do pasto para habilitar o envio de fotos.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Fechar" : "Fechar"}</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving || !letra.trim()} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
