import { useEffect, useMemo, useRef, useState } from "react";
import { useCriticalOperation } from "@/lib/criticalOperations";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, CloudOff, Loader2, Scale, Undo2, History } from "lucide-react";
import { enqueueMa, undoMa, flushMaAndCount, getMaQueueItems } from "@/lib/maisArrobasQueue";
import { setPesagemAtiva, clearPesagemAtiva, loadLinhasSem, saveLinhasSem } from "@/lib/maisArrobasResume";
import { diasEntrePesagens, escolherPesoAnterior } from "@/lib/pecuaristaData";
import { dataLocalSP } from "@/lib/diasCalendario";
import { useMaisArrobasSync } from "@/hooks/useMaisArrobasSync";
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
  leitura_balancao_id?: string | null;
};

type LinhaSem = { ordem: number; peso_kg: number; rowId: string; leitura_balancao_id?: string | null };

type LeituraBalancao = { id: string; ordem: number; peso_total: number; quantidade_animais: number; peso_individual: number };

type Step = "numero" | "peso";
type PrevInfo = {
  animalId: string | null;
  numero: string;
  peso_anterior_kg: number | null;
  data_anterior: string | null;
  lote_anterior: string | null;
};

export default function PecuaristaPesagemExecPage() {
  const { fazendaId, loteId, pesagemId } = useParams<{ fazendaId: string; loteId: string; pesagemId: string }>();
  const navigate = useNavigate();
  const syncSnap = useMaisArrobasSync();
  const [dataFimLocal, setDataFimLocal] = useState<string | null>(null);

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

  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  // "Data da pesagem" escolhida ao abrir a pesagem — base oficial de data e GMD.
  const [dataPesagem, setDataPesagem] = useState<string>(new Date().toISOString());

  // Balanção
  const [tipoBalanca, setTipoBalanca] = useState<"individual" | "balancao">("individual");
  const [qtdBalancaoDefault, setQtdBalancaoDefault] = useState<number>(2);
  const [qtdBalancaoAtual, setQtdBalancaoAtual] = useState<number>(2);
  const [pesoBalancao, setPesoBalancao] = useState("");
  const [pendingLeituraId, setPendingLeituraId] = useState<string | null>(null);
  const [pendingPesoIndiv, setPendingPesoIndiv] = useState<number | null>(null);
  const [pendingRestante, setPendingRestante] = useState<number>(0);
  const [salvandoLeitura, setSalvandoLeitura] = useState(false);
  const [leiturasBalancao, setLeiturasBalancao] = useState<LeituraBalancao[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const restauradoRef = useRef(false);
  // Pesagem em andamento: segura recargas automáticas (nova versão, falha de chunk).
  useCriticalOperation(!loading && !!lote && !dataFimLocal, "pesagem-pecuarista");

  async function marcarInicioSePreciso() {
    if (horaInicio || !pesagemId) return;
    const agora = new Date().toISOString();
    setHoraInicio(agora);
    enqueueMa(pesagemId, { kind: "update", table: "pesagens_lote_pecuarista", id: pesagemId, values: { hora_inicio: agora } });
  }

  useEffect(() => {
    if (!loteId || !pesagemId) return;
    (async () => {
      const [{ data }, { data: pes }] = await Promise.all([
        supabase
          .from("lotes_pecuarista")
          .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, fazenda_id, pecuarista_id")
          .eq("id", loteId).maybeSingle(),
        supabase
          .from("pesagens_lote_pecuarista")
          .select("tipo_balanca, quantidade_padrao_balancao, hora_inicio, data_pesagem")
          .eq("id", pesagemId).maybeSingle(),
      ]);
      setLote(data as Lote);
      if ((pes as any)?.data_pesagem) setDataPesagem((pes as any).data_pesagem);
      const tb = ((pes as any)?.tipo_balanca as "individual" | "balancao" | null) ?? "individual";
      setTipoBalanca(tb);
      const q = Number((pes as any)?.quantidade_padrao_balancao ?? 2);
      const qSafe = q >= 2 && q <= 5 ? q : 2;
      setQtdBalancaoDefault(qSafe);
      setQtdBalancaoAtual(qSafe);

      // ---- Retomada: servidor + fila local ----
      try {
        const fila = await getMaQueueItems();
        const lt = data as Lote | null;

        // hora de início
        let hi: string | null = (pes as any)?.hora_inicio ?? null;
        for (const i of fila) {
          if (i.op.kind === "update" && i.op.table === "pesagens_lote_pecuarista" && i.op.id === pesagemId && i.op.values?.hora_inicio) {
            hi = hi ?? i.op.values.hora_inicio;
          }
        }
        if (hi) setHoraInicio(hi);

        // leituras de balanção
        const { data: lsrv } = await supabase
          .from("leituras_balancao_pecuarista")
          .select("id, ordem, peso_total, quantidade_animais, peso_individual")
          .eq("pesagem_lote_id", pesagemId);
        const lmap = new Map<string, LeituraBalancao>();
        for (const r of (lsrv ?? []) as any[]) {
          lmap.set(r.id, { id: r.id, ordem: Number(r.ordem), peso_total: Number(r.peso_total), quantidade_animais: Number(r.quantidade_animais), peso_individual: Number(r.peso_individual) });
        }
        for (const i of fila) {
          if (i.op.kind !== "insert" || i.op.table !== "leituras_balancao_pecuarista") continue;
          const r = i.op.row;
          if (r.pesagem_lote_id !== pesagemId || lmap.has(r.id)) continue;
          lmap.set(r.id, { id: r.id, ordem: Number(r.ordem), peso_total: Number(r.peso_total), quantidade_animais: Number(r.quantidade_animais), peso_individual: Number(r.peso_individual) });
        }
        const leituras = [...lmap.values()].sort((a, b) => a.ordem - b.ordem);
        setLeiturasBalancao(leituras);

        let recuperados = 0;
        if (lt?.identificado) {
          const { data: psrv } = await supabase
            .from("pesos_animais_pecuarista")
            .select("id, animal_id, peso_kg, gmd_individual, leitura_balancao_id, created_at")
            .eq("pesagem_lote_id", pesagemId)
            .order("created_at");
          const animalIds = [...new Set(((psrv ?? []) as any[]).map((r) => r.animal_id))];
          const numeros = new Map<string, string>();
          if (animalIds.length) {
            const { data: an } = await supabase.from("animais_pecuarista").select("id, numero").in("id", animalIds);
            for (const a of (an ?? []) as any[]) numeros.set(a.id, a.numero);
          }
          const removidos = new Set(
            fila.filter((i) => i.op.kind === "delete" && i.op.table === "pesos_animais_pecuarista").map((i) => i.refId),
          );
          const vistos = new Set<string>();
          const linhas: LinhaId[] = [];
          for (const r of (psrv ?? []) as any[]) {
            if (removidos.has(r.id)) continue;
            vistos.add(r.id);
            linhas.push({
              animal_id: r.animal_id, numero: numeros.get(r.animal_id) ?? "—",
              peso_kg: Number(r.peso_kg), data: r.created_at ?? new Date().toISOString(),
              peso_anterior_kg: null, data_anterior: null, lote_anterior: null,
              gmd_individual: r.gmd_individual != null ? Number(r.gmd_individual) : null, dias: null,
              pesoRowId: r.id, leitura_balancao_id: r.leitura_balancao_id,
            });
          }
          for (const i of fila) {
            if (i.op.kind !== "pecuarista_peso_id" || i.op.pesagemLoteId !== pesagemId) continue;
            const op = i.op;
            if (vistos.has(op.pesoId) || removidos.has(op.pesoId)) continue;
            vistos.add(op.pesoId);
            linhas.push({
              animal_id: op.animalIdLocal, numero: op.numero, peso_kg: op.pesoKg,
              data: (i.createdAt.split("#")[0]) || new Date().toISOString(),
              peso_anterior_kg: null, data_anterior: null, lote_anterior: null,
              gmd_individual: op.gmdIndividual, dias: null,
              pesoRowId: op.pesoId, leitura_balancao_id: op.leituraBalancaoId,
            });
          }
          setLinhasId(linhas);
          recuperados = linhas.length;

          // leitura de balanção interrompida no meio da coleta de números
          const ultima = leituras[leituras.length - 1];
          if (tb === "balancao" && ultima) {
            const feitos = linhas.filter((l) => l.leitura_balancao_id === ultima.id).length;
            if (feitos < ultima.quantidade_animais) {
              setPendingLeituraId(ultima.id);
              setPendingPesoIndiv(ultima.peso_individual);
              setPendingRestante(ultima.quantidade_animais - feitos);
            }
          }
        } else {
          const salvas = loadLinhasSem<LinhaSem>(pesagemId);
          setLinhasSem(salvas);
          recuperados = salvas.length;
        }

        const fimNaFila = fila.find(
          (i) => i.op.kind === "update" && i.op.table === "pesagens_lote_pecuarista" && i.op.id === pesagemId && (i.op.values?.hora_fim || i.op.values?.data_pesagem),
        );
        if (fimNaFila && fimNaFila.op.kind === "update") {
          setDataFimLocal(fimNaFila.op.values.hora_fim ?? fimNaFila.op.values.data_pesagem);
          clearPesagemAtiva(pesagemId);
        } else if (lt) {
          setPesagemAtiva({
            tipo: "pecuarista",
            pesagemId,
            path: `/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/pesagem/${pesagemId}`,
            label: `o lote ${lt.codigo ?? lt.nome_lote ?? ""}`.trim(),
          });
        }
        if (recuperados > 0 && !fimNaFila) {
          toast.success(`Pesagem retomada: ${recuperados} peso(s) recuperado(s).`);
        }
      } catch (err) {
        console.warn("[pecuarista] retomada falhou", err);
      }
      restauradoRef.current = true;
      setLoading(false);
    })();
  }, [loteId, pesagemId, fazendaId]);

  // guarda a lista de lotes sem identificação no aparelho (retomada após recarga)
  useEffect(() => {
    if (!restauradoRef.current || !pesagemId || lote?.identificado) return;
    saveLinhasSem(pesagemId, linhasSem);
  }, [linhasSem, pesagemId, lote]);

  useEffect(() => {
    if (dataFimLocal && pesagemId) clearPesagemAtiva(pesagemId);
  }, [dataFimLocal, pesagemId]);

  async function iniciarLeituraBalancao() {
    if (!pesagemId || !lote || salvandoLeitura) return;
    const total = parseFloat(pesoBalancao.replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) return toast.error("Informe o peso total.");
    const qtd = qtdBalancaoAtual;
    if (!qtd || qtd < 2) return;
    setSalvandoLeitura(true);
    try {
      const pesoIndiv = Math.round((total / qtd) * 100) / 100;
      const ordem = leiturasBalancao.length + 1;
      const leituraId = crypto.randomUUID();
      enqueueMa(leituraId, {
        kind: "insert",
        table: "leituras_balancao_pecuarista",
        row: {
          id: leituraId,
          pesagem_lote_id: pesagemId,
          ordem,
          peso_total: total,
          quantidade_animais: qtd,
          peso_individual: pesoIndiv,
        },
      });

      if (!lote.identificado) {
        // Cria N linhas sem identificação diretamente
        const base = linhasSem.length;
        const novos: LinhaSem[] = [];
        for (let i = 0; i < qtd; i++) {
          novos.push({ ordem: base + i + 1, peso_kg: pesoIndiv, rowId: crypto.randomUUID(), leitura_balancao_id: leituraId });
        }
        setLinhasSem((prev) => [...prev, ...novos]);
        setLeiturasBalancao((prev) => [...prev, { id: leituraId, ordem, peso_total: total, quantidade_animais: qtd, peso_individual: pesoIndiv }]);
        setPesoBalancao("");
        setQtdBalancaoAtual(qtdBalancaoDefault);
        void marcarInicioSePreciso();
      } else {
        // Fluxo de coleta de números
        setPendingLeituraId(leituraId);
        setPendingPesoIndiv(pesoIndiv);
        setPendingRestante(qtd);
        setLeiturasBalancao((prev) => [...prev, { id: leituraId, ordem, peso_total: total, quantidade_animais: qtd, peso_individual: pesoIndiv }]);
        setPesoBalancao("");
        setQtdBalancaoAtual(qtdBalancaoDefault);
        setNumeroAtual("");
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    } finally {
      setSalvandoLeitura(false);
    }
  }

  async function confirmarNumeroBalancao() {
    if (!pesagemId || !lote || !pendingLeituraId || pendingPesoIndiv == null) return;
    const numero = numeroAtual.trim();
    if (!numero) return;
    // animal é resolvido/criado pelo número no momento do envio (fila local)
    const animalId = crypto.randomUUID();
    const pesoRowId = crypto.randomUUID();
    const agora = new Date().toISOString();
    enqueueMa(pesoRowId, {
      kind: "pecuarista_peso_id",
      pesoId: pesoRowId,
      animalIdLocal: animalId,
      pecuaristaId: lote.pecuarista_id,
      numero,
      loteId: lote.id,
      pesagemLoteId: pesagemId,
      pesoKg: pendingPesoIndiv,
      gmdIndividual: null,
      leituraBalancaoId: pendingLeituraId,
    });
    void marcarInicioSePreciso();
    setLinhasId((prev) => [
      ...prev,
      {
        animal_id: animalId, numero, peso_kg: pendingPesoIndiv, data: agora,
        peso_anterior_kg: null, data_anterior: null, lote_anterior: null,
        gmd_individual: null, dias: null,
        pesoRowId,
        leitura_balancao_id: pendingLeituraId,
      },
    ]);
    setNumeroAtual("");
    const rest = pendingRestante - 1;
    if (rest <= 0) {
      setPendingLeituraId(null);
      setPendingPesoIndiv(null);
      setPendingRestante(0);
    } else {
      setPendingRestante(rest);
    }
    setTimeout(() => inputRef.current?.focus(), 40);
  }

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
      .limit(100);
    const row: any = escolherPesoAnterior(((p as any[]) ?? []), dataPesagem, pesagemId);
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
      // Consulta do peso anterior com tempo limite: com internet ruim a tela
      // não trava — segue sem o histórico e o animal é resolvido no envio.
      let info: PrevInfo;
      try {
        info = await Promise.race([
          buscarAnimalPorNumero(numero),
          new Promise<PrevInfo>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
        ]);
      } catch {
        info = { animalId: null, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
      }
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

    const animalId = prev.animalId ?? crypto.randomUUID();
    const agora = new Date().toISOString();
    let gmd: number | null = null;
    let dias: number | null = null;
    if (prev.peso_anterior_kg != null && prev.data_anterior) {
      dias = diasEntrePesagens(prev.data_anterior, dataPesagem);
      if (dias) gmd = (peso - prev.peso_anterior_kg) / dias;
    }

    const pesoRowId = crypto.randomUUID();
    enqueueMa(pesoRowId, {
      kind: "pecuarista_peso_id",
      pesoId: pesoRowId,
      animalIdLocal: animalId,
      pecuaristaId: lote.pecuarista_id,
      numero: prev.numero,
      loteId: lote.id,
      pesagemLoteId: pesagemId,
      pesoKg: peso,
      gmdIndividual: gmd,
      leituraBalancaoId: null,
    });
    void marcarInicioSePreciso();

    setLinhasId((prev2) => [
      ...prev2,
      {
        animal_id: animalId, numero: prev.numero, peso_kg: peso, data: agora,
        peso_anterior_kg: prev.peso_anterior_kg, data_anterior: prev.data_anterior,
        lote_anterior: prev.lote_anterior, gmd_individual: gmd, dias,
        pesoRowId,
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
    void marcarInicioSePreciso();
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
    undoMa(last.pesoRowId, "pesos_animais_pecuarista");
    setLinhasId((prev) => prev.slice(0, -1));
  }

  function desfazerSem() {
    setLinhasSem((prev) => prev.slice(0, -1));
  }

  /** Registros desta pesagem ainda na fila local. */
  function pendentesDaPesagem() {
    const ids = new Set<string>();
    for (const l of linhasId) {
      if (syncSnap.pendingRefIds.has(l.pesoRowId)) ids.add(l.pesoRowId);
    }
    for (const l of leiturasBalancao) {
      if (syncSnap.pendingRefIds.has(l.id)) ids.add(l.id);
    }
    if (pesagemId && syncSnap.pendingRefIds.has(pesagemId)) ids.add(pesagemId);
    return ids.size;
  }

  /** Finaliza a pesagem — funciona offline (vai para a fila local). */
  async function finalizar() {
    if (!lote || !pesagemId) return;
    const isId = lote.identificado;
    const qtd = isId ? linhasId.length : linhasSem.length;
    if (qtd === 0) return toast.error("Nenhum peso registrado.");
    const pesos = isId ? linhasId.map((l) => l.peso_kg) : linhasSem.map((l) => l.peso_kg);
    const peso_total = pesos.reduce((s, v) => s + v, 0);
    const dataFim = new Date().toISOString();
    enqueueMa(pesagemId, {
      kind: "update",
      table: "pesagens_lote_pecuarista",
      id: pesagemId,
      values: {
        peso_total, quantidade_animais: qtd, peso_medio: peso_total / qtd,
        hora_fim: dataFim,
        hora_inicio: horaInicio ?? dataFim,
      },
    });
    setDataFimLocal(dataFim);
    setFinalizando(true);
    const restantes = await flushMaAndCount();
    setFinalizando(false);
    // Com tudo sincronizado segue direto para o PDF, como antes.
    if (restantes === 0) await gerarPdfEResumo(dataFim);
  }

  /** Gera o PDF — exige que todos os registros estejam no servidor. */
  async function tentarGerarPdf() {
    if (!dataFimLocal) return;
    setFinalizando(true);
    const restantes = await flushMaAndCount();
    setFinalizando(false);
    if (restantes > 0) {
      return toast.error(
        `Aguardando sincronizar ${restantes} registro(s) antes de gerar o PDF. Tente de novo quando a internet voltar.`,
      );
    }
    await gerarPdfEResumo(dataFimLocal);
  }

  async function gerarPdfEResumo(dataFim: string) {
    if (!lote || !pesagemId) return;
    const isId = lote.identificado;
    const qtd = isId ? linhasId.length : linhasSem.length;
    const pesos = isId ? linhasId.map((l) => l.peso_kg) : linhasSem.map((l) => l.peso_kg);
    const peso_total = pesos.reduce((s, v) => s + v, 0);
    const peso_medio = peso_total / qtd;

    // GMD do lote (só faz sentido para "sem identificação" comparando peso médio anterior)
    let gmdLote: number | null = null;
    let dataAnterior: string | null = null;
    let mediaAnterior: number | null = null;
    let dias: number | null = null;
    setFinalizando(true);
    if (!isId) {
      const { data: ant } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("id, data_pesagem, peso_medio")
        .eq("lote_id", lote.id)
        .neq("id", pesagemId)
        .gt("quantidade_animais", 0)
        .order("data_pesagem", { ascending: false })
        .limit(100);
      const diaAtual = dataLocalSP(dataPesagem);
      const a = ((ant as any[]) ?? []).find((x) => dataLocalSP(x.data_pesagem) < diaAtual);
      if (a) {
        mediaAnterior = Number(a.peso_medio);
        dataAnterior = a.data_pesagem;
        dias = diasEntrePesagens(dataAnterior!, dataPesagem);
        if (dias) gmdLote = (peso_medio - mediaAnterior) / dias;
      }
    }

    const horaIniFinal = horaInicio ?? dataFim;
    const { error } = await supabase
      .from("pesagens_lote_pecuarista")
      .update({
        peso_total, quantidade_animais: qtd, peso_medio,
        gmd: gmdLote,
        hora_fim: dataFim,
        hora_inicio: horaIniFinal,
      })
      .eq("id", pesagemId);
    if (error) { setFinalizando(false); return toast.error("Erro: " + error.message); }

    // dados de cabeçalho
    const { data: fz } = await supabase.from("fazendas_pecuarista").select("nome_fazenda, cidade, logo_url").eq("id", lote.fazenda_id).maybeSingle();
    const { data: pc } = await supabase.from("pecuaristas").select("nome, nome_empresa").eq("id", lote.pecuarista_id).maybeSingle();
    let categoriaLabel = CATEGORIAS_LABELS[lote.categoria] ?? lote.categoria;
    if (lote.categoria === "customizada" && lote.categoria_customizada_id) {
      const { data: c } = await supabase.from("categorias_pecuarista").select("nome").eq("id", lote.categoria_customizada_id).maybeSingle();
      categoriaLabel = (c as any)?.nome ?? "Personalizada";
    }

    let pdfUrl: string | null = null;
    const identificados: PecuaristaPesoIdentificado[] = linhasId.map((l) => ({
      numero: l.numero, peso_kg: l.peso_kg, data: dataPesagem,
      peso_anterior_kg: l.peso_anterior_kg, data_anterior: l.data_anterior,
      lote_anterior: l.lote_anterior, gmd_individual: l.gmd_individual, dias: l.dias,
    }));
    const semId: PecuaristaPesoSemId[] = linhasSem.map((l) => ({ ordem: l.ordem, peso_kg: l.peso_kg }));

    try {
      const blob = await gerarPecuaristaLotePdf({
        header: {
          produtor: (pc as any)?.nome ?? "",
          nomeEmpresa: null,
          logoUrl: (fz as any)?.logo_url ?? null,
          fazenda: (fz as any)?.nome_fazenda ?? "",
          cidade: (fz as any)?.cidade ?? null,
          lote: lote.nome_lote, codigoLote: lote.codigo,
          categoria: categoriaLabel, identificado: isId,
          data: dataPesagem,
          horaInicio: horaIniFinal,
          horaFim: dataFim,
        },
        totais: {
          quantidade: qtd, peso_total, peso_medio,
          peso_medio_anterior: mediaAnterior, data_anterior: dataAnterior,
          dias, gmd: gmdLote,
        },
        identificados: isId ? identificados : undefined,
        semId: !isId ? semId : undefined,
        leiturasBalancao: leiturasBalancao.length ? leiturasBalancao.map((l) => ({
          ordem: l.ordem, peso_total: l.peso_total,
          quantidade_animais: l.quantidade_animais, peso_individual: l.peso_individual,
        })) : undefined,
      });
      const path = `pecuarista/pesagens/${pesagemId}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("relatorios")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
        pdfUrl = pub.publicUrl;
        await supabase.from("pesagens_lote_pecuarista").update({ pdf_url: pdfUrl }).eq("id", pesagemId);
      }
    } catch (e: any) {
      toast.error("PDF: " + (e?.message ?? ""));
    }
    setFinalizando(false);
    navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/pesagem/${pesagemId}/resumo`, {
      state: {
        pdfUrl: pdfUrl ?? undefined,
        identificado: isId,
        loteNome: lote.nome_lote,
        quantidade: qtd, peso_total, peso_medio,
        peso_medio_anterior: mediaAnterior, data_anterior: dataAnterior,
        dias, gmd: gmdLote,
        identificados: isId ? identificados : undefined,
        semId: !isId ? semId : undefined,
        dataFim: dataPesagem,
        horaFim: dataFim,
        horaInicio: horaIniFinal,
      },
    });
  }

  if (loading || !lote) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const contagem = lote.identificado ? linhasId.length : linhasSem.length;
  const animalNum = contagem + 1;

  if (dataFimLocal) {
    const pend = pendentesDaPesagem();
    const pesosPend = lote.identificado
      ? linhasId.filter((l) => syncSnap.pendingRefIds.has(l.pesoRowId)).length
      : linhasSem.filter((l) => l.leitura_balancao_id && syncSnap.pendingRefIds.has(l.leitura_balancao_id)).length;
    return (
      <div className="max-w-3xl mx-auto space-y-4 pb-44">
        <Card className="p-4 space-y-3 text-center">
          <Check className="w-8 h-8 mx-auto text-primary" />
          <div className="font-semibold">Pesagem finalizada</div>
          <div className="text-sm text-muted-foreground">{lote.nome_lote} • {contagem} animais</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-primary">{contagem - pesosPend}</p>
              <p className="text-xs text-muted-foreground">confirmados no servidor</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                {pesosPend > 0 && <CloudOff className="w-5 h-5" />}{pesosPend}
              </p>
              <p className="text-xs text-muted-foreground">pendentes de envio</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {pend > 0
              ? "Os dados estão salvos no aparelho e serão enviados automaticamente quando a internet voltar. O PDF fica disponível depois que tudo for sincronizado."
              : "Tudo sincronizado. O PDF já pode ser gerado."}
          </p>
        </Card>
        <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`)}>Voltar</Button>
          <Button className="flex-1" onClick={() => void tentarGerarPdf()} disabled={finalizando}>
            {finalizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {pend > 0 ? `Gerar PDF (${pend} pendente${pend > 1 ? "s" : ""})` : "Gerar PDF"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-44">
      <Card className="p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Lote</div>
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          {lote.nome_lote}
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

      {tipoBalanca === "balancao" ? (
        <div className="space-y-3">
          {pendingLeituraId && pendingRestante > 0 ? (
            <>
              <div className="text-sm font-medium">
                Leitura em andamento — {pendingPesoIndiv?.toFixed(1)} kg/animal • faltam {pendingRestante}
              </div>
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                placeholder="Número do animal"
                value={numeroAtual}
                onChange={(e) => setNumeroAtual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmarNumeroBalancao(); } }}
                className="text-xl h-14 text-center"
                autoFocus
              />
              <Button
                className="w-full h-12"
                onClick={() => void confirmarNumeroBalancao()}
                disabled={!numeroAtual.trim()}
              >
                Confirmar animal
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Nova leitura em Balanção — Peso total (kg)</div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="Peso total (kg)"
                  value={pesoBalancao}
                  onChange={(e) => setPesoBalancao(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void iniciarLeituraBalancao(); } }}
                  className="text-xl h-14 text-center flex-1"
                  autoFocus
                />
                <select
                  value={qtdBalancaoAtual}
                  onChange={(e) => setQtdBalancaoAtual(Number(e.target.value))}
                  className="h-14 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} animais</option>)}
                </select>
              </div>
              <Button
                className="w-full h-12"
                onClick={() => void iniciarLeituraBalancao()}
                disabled={!pesoBalancao || parseFloat(pesoBalancao.replace(",", ".")) <= 0 || salvandoLeitura}
              >
                {salvandoLeitura ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Próximo ➜
              </Button>
              {leiturasBalancao.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {leiturasBalancao.length} leitura(s) • {leiturasBalancao.reduce((s, l) => s + l.quantidade_animais, 0)} animais
                </div>
              )}
            </>
          )}
        </div>
      ) : lote.identificado ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            {step === "numero"
              ? `Animal ${animalNum} — Número`
              : `Animal ${animalNum} — Peso (kg) — Nº ${prev?.numero}`}
          </div>
          {step === "peso" && prev?.peso_anterior_kg != null && (
            <Card className="p-3 bg-muted/50 text-sm">
              <div><strong>Pesagem anterior:</strong></div>
              <div>Peso: {prev.peso_anterior_kg.toFixed(1)} kg</div>
              {prev.lote_anterior && <div>Lote: {prev.lote_anterior}</div>}
              {prev.data_anterior && <div>Data: {new Date(prev.data_anterior).toLocaleString("pt-BR")}</div>}
            </Card>
          )}
          {step === "peso" && prev?.peso_anterior_kg == null && (
            <div className="text-xs text-muted-foreground">Primeira pesagem deste animal.</div>
          )}
          <Input
            key="main-input-id"
            ref={inputRef}
            type={step === "numero" ? "text" : "number"}
            inputMode={step === "numero" ? "numeric" : "decimal"}
            placeholder={step === "numero" ? "Número do animal" : "Peso (kg)"}
            value={step === "numero" ? numeroAtual : pesoAtual}
            onChange={(e) => (step === "numero" ? setNumeroAtual(e.target.value) : setPesoAtual(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (step === "numero") void handleConfirmarNumero();
                else void handleSalvarPesoId();
              }
            }}
            className="text-xl h-14 text-center"
            autoFocus
          />
          <Button
            className="w-full h-12"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              inputRef.current?.focus();
              if (step === "numero") void handleConfirmarNumero();
              else void handleSalvarPesoId();
            }}
            disabled={
              step === "numero"
                ? !numeroAtual.trim() || buscandoAnimal
                : !pesoAtual || parseFloat(pesoAtual.replace(",", ".")) <= 0
            }
          >
            {step === "numero" ? (
              buscandoAnimal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2" />
            ) : (
              <Scale className="w-4 h-4 mr-2" />
            )}
            {step === "numero" ? "Continuar" : "Próximo ➜"}
          </Button>
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
            onClick={() => { inputRef.current?.focus(); void handleSalvarPesoSem(); }}
            disabled={!pesoSem || parseFloat(pesoSem.replace(",", ".")) <= 0}
          >
            <Scale className="w-4 h-4 mr-2" /> Próximo ➜
          </Button>
        </div>
      )}


      {(linhasId.length > 0 || linhasSem.length > 0) && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
            <span>Histórico da rodada</span>
            {syncSnap.pendingCount > 0 && (
              <span className="flex items-center gap-1">
                <CloudOff className="w-3 h-3" /> {syncSnap.pendingCount} aguardando envio
              </span>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {lote.identificado
              ? linhasId.slice().reverse().map((l) => (
                <div key={l.pesoRowId} className="flex justify-between border-b border-border/40 py-1">
                  <span className="flex items-center gap-1">
                    Nº {l.numero}
                    {syncSnap.pendingRefIds.has(l.pesoRowId) && (
                      <CloudOff className="w-3 h-3 text-muted-foreground" aria-label="Pendente de envio" />
                    )}
                  </span>
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

      <div
        className="fixed left-0 right-0 px-4 pt-3 bg-background/95 backdrop-blur border-t flex gap-2 z-50 shadow-lg"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "1rem" }}
      >
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
