import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Loader2, Scale, Undo2, History } from "lucide-react";
import { gerarPecuaristaLotePdf, type PecuaristaPesoIdentificado, type PecuaristaPesoSemId } from "@/lib/pecuaristaPdf";

interface Lote {
  id: string; codigo: string; nome_lote: string; categoria: string;
  categoria_customizada_id: string | null; identificado: boolean;
  fazenda_id: string; pecuarista_id: string;
}

const CATEGORIAS_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo", vaca_gorda: "Vaca Gorda", vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro", garrote: "Garrote", novilha: "Novilha",
  bezerro: "Bezerro", bezerra: "Bezerra",
};

type LinhaId = {
  animal_id: string;
  numero: string;
  peso_kg: number;
  data: string;
  peso_anterior_kg: number | null;
  data_anterior: string | null;
  lote_anterior: string | null;
  gmd_individual: number | null;
  dias: number | null;
  pesoRowId: string;
};

type LinhaSem = { ordem: number; peso_kg: number; rowId: string };

type Step = "numero" | "peso";
type PrevInfo = {
  animalId: string | null;
  numero: string;
  peso_anterior_kg: number | null;
  data_anterior: string | null;
  lote_anterior: string | null;
};

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export default function PecuaristaPesagemExecPage() {
  const { fazendaId, loteId, pesagemId } = useParams<{ fazendaId: string; loteId: string; pesagemId: string }>();
  const navigate = useNavigate();

  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);

  // identificado
  const [linhasId, setLinhasId] = useState<LinhaId[]>([]);
  const [step, setStep] = useState<Step>("numero");
  const [numeroAtual, setNumeroAtual] = useState("");
  const [pesoAtual, setPesoAtual] = useState("");
  const [prev, setPrev] = useState<PrevInfo | null>(null);
  const [buscandoAnimal, setBuscandoAnimal] = useState(false);

  // sem identificação
  const [linhasSem, setLinhasSem] = useState<LinhaSem[]>([]);
  const [pesoSem, setPesoSem] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loteId) return;
    (async () => {
      const { data } = await supabase
        .from("lotes_pecuarista")
        .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, fazenda_id, pecuarista_id")
        .eq("id", loteId).maybeSingle();
      setLote(data as Lote);
      setLoading(false);
    })();
  }, [loteId]);

  useEffect(() => {
    if (!loading) setTimeout(() => inputRef.current?.focus(), 80);
  }, [loading, step, linhasId.length, linhasSem.length]);

  const media = useMemo(() => {
    if (lote?.identificado) {
      return linhasId.length ? linhasId.reduce((s, l) => s + l.peso_kg, 0) / linhasId.length : 0;
    }
    return linhasSem.length ? linhasSem.reduce((s, l) => s + l.peso_kg, 0) / linhasSem.length : 0;
  }, [lote, linhasId, linhasSem]);

  async function buscarAnimalPorNumero(numero: string): Promise<PrevInfo> {
    if (!lote) return { animalId: null, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
    const { data: an } = await supabase
      .from("animais_pecuarista")
      .select("id")
      .eq("pecuarista_id", lote.pecuarista_id)
      .eq("numero", numero)
      .maybeSingle();
    if (!an) return { animalId: null, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
    const animalId = (an as any).id as string;
    const { data: p } = await supabase
      .from("pesos_animais_pecuarista")
      .select("peso_kg, created_at, pesagem_lote_id, pesagens_lote_pecuarista!inner(data_pesagem, lote_id, lotes_pecuarista!inner(nome_lote))")
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = ((p as any[]) ?? [])[0];
    if (!row) return { animalId, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
    return {
      animalId,
      numero,
      peso_anterior_kg: Number(row.peso_kg),
      data_anterior: row.pesagens_lote_pecuarista?.data_pesagem ?? row.created_at,
      lote_anterior: row.pesagens_lote_pecuarista?.lotes_pecuarista?.nome_lote ?? null,
    };
  }

  async function handleConfirmarNumero() {
    const numero = numeroAtual.trim();
    if (!numero) return;
    setBuscandoAnimal(true);
    try {
      const info = await buscarAnimalPorNumero(numero);
      setPrev(info);
      setStep("peso");
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setBuscandoAnimal(false);
    }
  }

  async function handleSalvarPesoId() {
    if (!lote || !pesagemId || !prev) return;
    const peso = parseFloat(pesoAtual.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;

    let animalId = prev.animalId;
    // criar animal se não existir
    if (!animalId) {
      const { data: novo, error: e1 } = await supabase
        .from("animais_pecuarista")
        .insert({ pecuarista_id: lote.pecuarista_id, numero: prev.numero, lote_atual_id: lote.id })
        .select("id").single();
      if (e1 || !novo) return toast.error("Erro ao cadastrar animal: " + (e1?.message ?? ""));
      animalId = (novo as any).id;
    } else {
      await supabase.from("animais_pecuarista").update({ lote_atual_id: lote.id }).eq("id", animalId);
    }

    const agora = new Date().toISOString();
    let gmd: number | null = null;
    let dias: number | null = null;
    if (prev.peso_anterior_kg != null && prev.data_anterior) {
      dias = daysBetween(prev.data_anterior, agora);
      gmd = (peso - prev.peso_anterior_kg) / dias;
    }

    const { data: pRow, error: e2 } = await supabase
      .from("pesos_animais_pecuarista")
      .insert({
        pesagem_lote_id: pesagemId,
        animal_id: animalId,
        peso_kg: peso,
        gmd_individual: gmd,
      })
      .select("id").single();
    if (e2 || !pRow) return toast.error("Erro ao salvar peso: " + (e2?.message ?? ""));

    setLinhasId((prev2) => [
      ...prev2,
      {
        animal_id: animalId!, numero: prev.numero, peso_kg: peso, data: agora,
        peso_anterior_kg: prev.peso_anterior_kg, data_anterior: prev.data_anterior,
        lote_anterior: prev.lote_anterior, gmd_individual: gmd, dias,
        pesoRowId: (pRow as any).id,
      },
    ]);
    setNumeroAtual(""); setPesoAtual(""); setPrev(null); setStep("numero");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSalvarPesoSem() {
    if (!pesagemId || !lote) return;
    const peso = parseFloat(pesoSem.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;
    // criamos um "animal anônimo" por peso? Não — para lotes sem ID não persistimos por animal.
    // Guardamos apenas em memória e ao finalizar gravamos totais.
    setLinhasSem((prev) => [...prev, { ordem: prev.length + 1, peso_kg: peso, rowId: crypto.randomUUID() }]);
    setPesoSem("");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function desfazerId() {
    if (step !== "numero") {
      setStep("numero"); setPesoAtual(""); setPrev(null);
      return;
    }
    const last = linhasId[linhasId.length - 1];
    if (!last) return;
    await supabase.from("pesos_animais_pecuarista").delete().eq("id", last.pesoRowId);
    setLinhasId((prev) => prev.slice(0, -1));
  }

  function desfazerSem() {
    setLinhasSem((prev) => prev.slice(0, -1));
  }

  async function finalizar() {
    if (!lote || !pesagemId) return;
    const isId = lote.identificado;
    const qtd = isId ? linhasId.length : linhasSem.length;
    if (qtd === 0) return toast.error("Nenhum peso registrado.");
    const pesos = isId ? linhasId.map((l) => l.peso_kg) : linhasSem.map((l) => l.peso_kg);
    const peso_total = pesos.reduce((s, v) => s + v, 0);
    const peso_medio = peso_total / qtd;

    // GMD do lote (só faz sentido para "sem identificação" comparando peso médio anterior)
    let gmdLote: number | null = null;
    let dataAnterior: string | null = null;
    let mediaAnterior: number | null = null;
    let dias: number | null = null;
    if (!isId) {
      const { data: ant } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("id, data_pesagem, peso_medio")
        .eq("lote_id", lote.id)
        .neq("id", pesagemId)
        .gt("quantidade_animais", 0)
        .order("data_pesagem", { ascending: false })
        .limit(1);
      const a = ((ant as any[]) ?? [])[0];
      if (a) {
        mediaAnterior = Number(a.peso_medio);
        dataAnterior = a.data_pesagem;
        const agora = new Date().toISOString();
        dias = daysBetween(dataAnterior!, agora);
        gmdLote = (peso_medio - mediaAnterior) / dias;
      }
    }

    setFinalizando(true);
    const { error } = await supabase
      .from("pesagens_lote_pecuarista")
      .update({
        peso_total, quantidade_animais: qtd, peso_medio,
        gmd: gmdLote,
      })
      .eq("id", pesagemId);
    if (error) { setFinalizando(false); return toast.error("Erro: " + error.message); }

    // dados de cabeçalho
    const { data: fz } = await supabase.from("fazendas_pecuarista").select("nome_fazenda, cidade").eq("id", lote.fazenda_id).maybeSingle();
    const { data: pc } = await supabase.from("pecuaristas").select("nome, nome_empresa").eq("id", lote.pecuarista_id).maybeSingle();
    let categoriaLabel = CATEGORIAS_LABELS[lote.categoria] ?? lote.categoria;
    if (lote.categoria === "customizada" && lote.categoria_customizada_id) {
      const { data: c } = await supabase.from("categorias_pecuarista").select("nome").eq("id", lote.categoria_customizada_id).maybeSingle();
      categoriaLabel = (c as any)?.nome ?? "Personalizada";
    }

    try {
      const identificados: PecuaristaPesoIdentificado[] = linhasId.map((l) => ({
        numero: l.numero, peso_kg: l.peso_kg, data: l.data,
        peso_anterior_kg: l.peso_anterior_kg, data_anterior: l.data_anterior,
        lote_anterior: l.lote_anterior, gmd_individual: l.gmd_individual, dias: l.dias,
      }));
      const semId: PecuaristaPesoSemId[] = linhasSem.map((l) => ({ ordem: l.ordem, peso_kg: l.peso_kg }));
      const blob = await gerarPecuaristaLotePdf({
        header: {
          produtor: (pc as any)?.nome ?? "",
          nomeEmpresa: null, // sempre Mais Arrobas
          logoUrl: null,
          fazenda: (fz as any)?.nome_fazenda ?? "",
          cidade: (fz as any)?.cidade ?? null,
          lote: lote.nome_lote, codigoLote: lote.codigo,
          categoria: categoriaLabel, identificado: isId,
          data: new Date().toISOString(),
        },
        totais: {
          quantidade: qtd, peso_total, peso_medio,
          peso_medio_anterior: mediaAnterior, data_anterior: dataAnterior,
          dias, gmd: gmdLote,
        },
        identificados: isId ? identificados : undefined,
        semId: !isId ? semId : undefined,
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("PDF: " + (e?.message ?? ""));
    }
    setFinalizando(false);
    navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`);
  }

  if (loading || !lote) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const contagem = lote.identificado ? linhasId.length : linhasSem.length;
  const animalNum = contagem + 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-28">
      <Card className="p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Lote</div>
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          {lote.nome_lote} <Badge variant="outline" className="font-mono">#{lote.codigo}</Badge>
          <Badge variant="outline">{lote.identificado ? "Identificado" : "Sem identificação"}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-2xl font-bold text-primary">{contagem}</p>
          <p className="text-xs text-muted-foreground">animais pesados</p>
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-2xl font-bold text-primary">{media > 0 ? media.toFixed(1).replace(".", ",") : "—"}</p>
          <p className="text-xs text-muted-foreground">média (kg)</p>
        </div>
      </div>

      {lote.identificado ? (
        <div className="space-y-3">
          {step === "numero" ? (
            <>
              <div className="text-sm font-medium">Animal {animalNum} — Número</div>
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                placeholder="Número do animal"
                value={numeroAtual}
                onChange={(e) => setNumeroAtual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleConfirmarNumero(); } }}
                className="text-xl h-14 text-center"
                autoFocus
              />
              <Button
                className="w-full h-12"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void handleConfirmarNumero()}
                disabled={!numeroAtual.trim() || buscandoAnimal}
              >
                {buscandoAnimal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2" />}
                Continuar
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Animal {animalNum} — Peso (kg) — Nº {prev?.numero}</div>
              {prev?.peso_anterior_kg != null && (
                <Card className="p-3 bg-muted/50 text-sm">
                  <div><strong>Pesagem anterior:</strong></div>
                  <div>Peso: {prev.peso_anterior_kg.toFixed(1)} kg</div>
                  {prev.lote_anterior && <div>Lote: {prev.lote_anterior}</div>}
                  {prev.data_anterior && <div>Data: {new Date(prev.data_anterior).toLocaleString("pt-BR")}</div>}
                </Card>
              )}
              {prev?.peso_anterior_kg == null && (
                <div className="text-xs text-muted-foreground">Primeira pesagem deste animal.</div>
              )}
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="Peso (kg)"
                value={pesoAtual}
                onChange={(e) => setPesoAtual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSalvarPesoId(); } }}
                className="text-xl h-14 text-center"
                autoFocus
              />
              <Button
                className="w-full h-12"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void handleSalvarPesoId()}
                disabled={!pesoAtual || parseFloat(pesoAtual.replace(",", ".")) <= 0}
              >
                <Scale className="w-4 h-4 mr-2" /> Próximo ➜
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium">Animal {animalNum} — Peso (kg)</div>
          <Input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            placeholder="Peso (kg)"
            value={pesoSem}
            onChange={(e) => setPesoSem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSalvarPesoSem(); } }}
            className="text-xl h-14 text-center"
            autoFocus
          />
          <Button
            className="w-full h-12"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => void handleSalvarPesoSem()}
            disabled={!pesoSem || parseFloat(pesoSem.replace(",", ".")) <= 0}
          >
            <Scale className="w-4 h-4 mr-2" /> Próximo ➜
          </Button>
        </div>
      )}

      {(linhasId.length > 0 || linhasSem.length > 0) && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Histórico da rodada</div>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {lote.identificado
              ? linhasId.slice().reverse().map((l) => (
                <div key={l.pesoRowId} className="flex justify-between border-b border-border/40 py-1">
                  <span>Nº {l.numero}</span>
                  <span>
                    {l.peso_kg.toFixed(1)} kg
                    {l.gmd_individual != null ? ` • GMD ${l.gmd_individual.toFixed(3)}` : ""}
                  </span>
                </div>
              ))
              : linhasSem.slice().reverse().map((l) => (
                <div key={l.rowId} className="flex justify-between border-b border-border/40 py-1">
                  <span>{l.ordem}</span>
                  <span>{l.peso_kg.toFixed(1)} kg</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t flex gap-2 z-30">
        <Button variant="outline" onClick={() => void (lote.identificado ? desfazerId() : desfazerSem())} disabled={contagem === 0 && step === "numero"}>
          <Undo2 className="w-4 h-4 mr-1" /> Desfazer
        </Button>
        <Button className="flex-1" onClick={() => void finalizar()} disabled={contagem === 0 || finalizando}>
          {finalizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Finalizar ({contagem})
        </Button>
      </div>
    </div>
  );
}
