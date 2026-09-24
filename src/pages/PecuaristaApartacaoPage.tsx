import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { dataEscolhidaParaIso, diasEntrePesagens, escolherPesoAnterior } from "@/lib/pecuaristaData";
import { dataLocalSP } from "@/lib/diasCalendario";
import { supabase } from "@/integrations/supabase/client";
import { maFrom, maGetUser, isMaOffline } from "@/lib/maOffline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Check, Loader2, Scale, Split, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { gerarPecuaristaApartacaoPdf, type ApartacaoDestinoSection, type PecuaristaPesoIdentificado, type PecuaristaPesoSemId } from "@/lib/pecuaristaPdf";
import { enqueueMa, getMaPendingRows, nextMaLoteCodigo } from "@/lib/maisArrobasQueue";

const CATEGORIAS_PADRAO: Array<{ slug: string; label: string }> = [
  { slug: "boi_gordo", label: "Boi Gordo" },
  { slug: "vaca_gorda", label: "Vaca Gorda" },
  { slug: "vaca_magra", label: "Vaca Magra" },
  { slug: "boi_magro", label: "Boi Magro" },
  { slug: "garrote", label: "Garrote" },
  { slug: "novilha", label: "Novilha" },
  { slug: "bezerro", label: "Bezerro" },
  { slug: "bezerra", label: "Bezerra" },
];

interface Lote {
  id: string; codigo: string; nome_lote: string; categoria: string;
  categoria_customizada_id: string | null; identificado: boolean;
  fazenda_id: string; pecuarista_id: string; status: string;
}
interface CatCustom { id: string; nome: string; }
interface LoteExistente { id: string; nome_lote: string; codigo: string; identificado: boolean; status: string; }

type DestinoConfig =
  | { modo: "novo"; nome: string; categoriaSlug: string; categoriaCustomId: string; novaCategoria: string; criandoNova: boolean; pesoMin: string; pesoMax: string }
  | { modo: "existente"; loteExistenteId: string; pesoMin: string; pesoMax: string };

interface Destino {
  id: string;                 // apartacao_lotes.id
  lote_id: string;            // lotes_pecuarista.id (novo ou existente)
  nome_lote: string;
  codigo: string;
  identificado: boolean;
  peso_min: number | null;
  peso_max: number | null;
}

function parseRange(pMin: string, pMax: string): { min: number | null; max: number | null } | { error: string } {
  const trim = (s: string) => s.trim().replace(",", ".");
  const min = trim(pMin) === "" ? null : Number(trim(pMin));
  const max = trim(pMax) === "" ? null : Number(trim(pMax));
  if (min !== null && (!Number.isFinite(min) || min < 0)) return { error: "Peso mínimo inválido" };
  if (max !== null && (!Number.isFinite(max) || max < 0)) return { error: "Peso máximo inválido" };
  if (min !== null && max !== null && min > max) return { error: "Peso mínimo maior que peso máximo" };
  return { min, max };
}
function rangesOverlap(a: { min: number | null; max: number | null }, b: { min: number | null; max: number | null }): boolean {
  const aMin = a.min ?? -Infinity, aMax = a.max ?? Infinity;
  const bMin = b.min ?? -Infinity, bMax = b.max ?? Infinity;
  return aMin <= bMax && bMin <= aMax;
}
function destinoParaPeso(destinos: Destino[], peso: number): Destino | null {
  const matches = destinos.filter(d =>
    (d.peso_min == null || peso >= d.peso_min) &&
    (d.peso_max == null || peso <= d.peso_max)
  );
  return matches.length === 1 ? matches[0] : null;
}

type LinhaId = {
  animal_id: string; numero: string; peso_kg: number; data: string;
  peso_anterior_kg: number | null; data_anterior: string | null; lote_anterior: string | null;
  gmd_individual: number | null; dias: number | null;
  pesoRowId?: string;         // ainda não inserido durante a rodada
  destino_lote_id: string;
};
type LinhaSem = { ordem: number; peso_kg: number; rowId: string; destino_lote_id: string };
type Step = "numero" | "peso" | "destino";
type PrevInfo = {
  animalId: string | null; numero: string;
  peso_anterior_kg: number | null; data_anterior: string | null; lote_anterior: string | null;
};

export default function PecuaristaApartacaoPage() {
  const { fazendaId, loteId } = useParams<{ fazendaId: string; loteId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "Data da pesagem" escolhida no início (?data=YYYY-MM-DD); base oficial de data e GMD.
  const [dataPesagem] = useState<string>(() => dataEscolhidaParaIso(searchParams.get("data") ?? ""));

  const [phase, setPhase] = useState<"config" | "weighing">("config");
  const [loading, setLoading] = useState(true);
  const [lote, setLote] = useState<Lote | null>(null);
  const [customCats, setCustomCats] = useState<CatCustom[]>([]);
  const [lotesFazenda, setLotesFazenda] = useState<LoteExistente[]>([]);
  const [codigosOcupados, setCodigosOcupados] = useState<string[]>([]);

  // Config
  const [qtd, setQtd] = useState<2 | 3>(2);
  const [confs, setConfs] = useState<DestinoConfig[]>([
    { modo: "novo", nome: "", categoriaSlug: "boi_gordo", categoriaCustomId: "", novaCategoria: "", criandoNova: false, pesoMin: "", pesoMax: "" },
    { modo: "novo", nome: "", categoriaSlug: "boi_gordo", categoriaCustomId: "", novaCategoria: "", criandoNova: false, pesoMin: "", pesoMax: "" },
  ]);
  const [preparando, setPreparando] = useState(false);

  // Weighing state
  const [apartacaoId, setApartacaoId] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [step, setStep] = useState<Step>("numero"); // sem id: começa em "peso"
  const [numeroAtual, setNumeroAtual] = useState("");
  const [pesoAtual, setPesoAtual] = useState("");
  const [prev, setPrev] = useState<PrevInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [linhasId, setLinhasId] = useState<LinhaId[]>([]);
  const [linhasSem, setLinhasSem] = useState<LinhaSem[]>([]);
  const [finalizando, setFinalizando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  async function marcarInicioSePreciso(apId: string | null) {
    if (horaInicio || !apId) return;
    const agora = new Date().toISOString();
    setHoraInicio(agora);
    await maFrom("apartacoes_pecuarista").update({ hora_inicio: agora }).eq("id", apId);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loteId) return;
    (async () => {
      const { data: l } = await maFrom("lotes_pecuarista")
        .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, fazenda_id, pecuarista_id, status")
        .eq("id", loteId).maybeSingle();
      const lo = l as Lote | null;
      setLote(lo);
      if (lo) {
        const [{ data: cats }, { data: lotes }, { data: codigos }] = await Promise.all([
          maFrom("categorias_pecuarista").select("id, nome").eq("pecuarista_id", lo.pecuarista_id).order("nome"),
          maFrom("lotes_pecuarista")
            .select("id, nome_lote, codigo, identificado, status")
            .eq("fazenda_id", lo.fazenda_id).neq("id", lo.id).eq("status", "ativo")
            .order("nome_lote"),
          maFrom("lotes_pecuarista").select("codigo").eq("pecuarista_id", lo.pecuarista_id),
        ]);
        setCustomCats((cats as CatCustom[]) || []);
        setLotesFazenda(((lotes as LoteExistente[]) || []).filter(x => x.identificado === lo.identificado));
        setCodigosOcupados((codigos ?? []).map((row: any) => row.codigo));
      }
      setLoading(false);
    })();
  }, [loteId]);

  useEffect(() => {
    if (phase === "weighing") setTimeout(() => inputRef.current?.focus(), 80);
  }, [phase, step, linhasId.length, linhasSem.length]);

  function setQtdSafe(n: 2 | 3) {
    setQtd(n);
    setConfs(prev => {
      const next = [...prev];
      while (next.length < n) next.push({ modo: "novo", nome: "", categoriaSlug: "boi_gordo", categoriaCustomId: "", novaCategoria: "", criandoNova: false, pesoMin: "", pesoMax: "" });
      return next.slice(0, n);
    });
  }

  async function nextCodigo(pecuaristaId: string, usados: Set<string>): Promise<string> {
    if (usados.size === 0) {
      const pending = await getMaPendingRows("lotes_pecuarista");
      codigosOcupados.forEach((codigo) => usados.add(codigo));
      pending.filter((r) => r.pecuarista_id === pecuaristaId).forEach((r) => usados.add(r.codigo));
    }
    const codigo = nextMaLoteCodigo(usados);
    usados.add(codigo);
    return codigo;
  }

  async function preparar() {
    if (!lote) return;
    // Validate configs
    const ranges: Array<{ min: number | null; max: number | null }> = [];
    for (let i = 0; i < qtd; i++) {
      const c = confs[i];
      if (c.modo === "novo" && !c.nome.trim()) return toast.error(`Destino ${i + 1}: informe o nome do novo lote.`);
      if (c.modo === "novo" && c.criandoNova && !c.novaCategoria.trim()) return toast.error(`Destino ${i + 1}: informe o nome da nova categoria.`);
      if (c.modo === "novo" && !c.criandoNova && c.categoriaSlug === "customizada" && !c.categoriaCustomId) return toast.error(`Destino ${i + 1}: selecione a categoria personalizada.`);
      if (c.modo === "existente" && !c.loteExistenteId) return toast.error(`Destino ${i + 1}: selecione um lote existente.`);
      const r = parseRange(c.pesoMin, c.pesoMax);
      if ("error" in r) return toast.error(`Destino ${i + 1}: ${r.error}.`);
      ranges.push(r);
    }
    // Validate no overlap between ranges (only among destinos that defined at least one bound)
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i], b = ranges[j];
        if (a.min == null && a.max == null) continue;
        if (b.min == null && b.max == null) continue;
        if (rangesOverlap(a, b)) return toast.error(`As faixas de peso dos destinos ${i + 1} e ${j + 1} se sobrepõem.`);
      }
    }
    setPreparando(true);
    try {
      // A apartação recebe UUID local para que seus lotes e destinos possam
      // manter as chaves estrangeiras em ordem mesmo sem rede.
      const apId = crypto.randomUUID();
      enqueueMa(apId, { kind: "insert", table: "apartacoes_pecuarista", row: {
        id: apId, lote_origem_id: lote.id, pecuarista_id: lote.pecuarista_id,
        quantidade_lotes_destino: qtd, data_apartacao: dataPesagem,
      } });

      const usadosCod = new Set<string>();
      const destinosFeitos: Destino[] = [];
      const ordens = ["A", "B", "C"];
      for (let i = 0; i < qtd; i++) {
        const c = confs[i];
        let destLote: { id: string; nome_lote: string; codigo: string; identificado: boolean } | null = null;

        if (c.modo === "existente") {
          const found = lotesFazenda.find(l => l.id === c.loteExistenteId);
          if (!found) throw new Error("Lote existente inválido");
          destLote = { id: found.id, nome_lote: found.nome_lote, codigo: found.codigo, identificado: found.identificado };
        } else {
          // create new lote
          let categoria = c.categoriaSlug;
          let categoria_customizada_id: string | null = null;
          if (c.criandoNova) {
            const categoriaId = crypto.randomUUID();
            enqueueMa(categoriaId, { kind: "insert", table: "categorias_pecuarista", row: {
              id: categoriaId, pecuarista_id: lote.pecuarista_id, nome: c.novaCategoria.trim(),
            } });
            categoria = "customizada";
            categoria_customizada_id = categoriaId;
          } else if (c.categoriaSlug === "customizada") {
            categoria_customizada_id = c.categoriaCustomId;
          }
          const cod = await nextCodigo(lote.pecuarista_id, usadosCod);
          const novoId = crypto.randomUUID();
          const novo = {
            id: novoId,
            pecuarista_id: lote.pecuarista_id,
            fazenda_id: lote.fazenda_id,
            nome_lote: c.nome.trim(),
            codigo: cod,
            categoria,
            categoria_customizada_id,
            identificado: lote.identificado,
            status: "ativo",
          };
          enqueueMa(novoId, { kind: "insert", table: "lotes_pecuarista", row: novo });
          destLote = { id: novoId, nome_lote: novo.nome_lote, codigo: novo.codigo, identificado: lote.identificado };
        }

        // apartacao_destinos_pecuarista: faixa de peso por destino
        const r = ranges[i];
        const destinoId = crypto.randomUUID();
        enqueueMa(destinoId, { kind: "insert", table: "apartacao_destinos_pecuarista", row: {
          id: destinoId,
          apartacao_id: apId,
          lote_destino_id: destLote.id,
          peso_min: r.min,
          peso_max: r.max,
          ordem: i + 1,
        } });

        destinosFeitos.push({
          id: destinoId,
          lote_id: destLote.id,
          nome_lote: destLote.nome_lote,
          codigo: destLote.codigo,
          identificado: destLote.identificado,
          peso_min: r.min,
          peso_max: r.max,
        });
      }

      setApartacaoId(apId);
      setDestinos(destinosFeitos);
      setPhase("weighing");
      setStep(lote.identificado ? "numero" : "peso");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    } finally {
      setPreparando(false);
    }
  }

  // === weighing helpers ===
  const contagemPorDestino = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of destinos) map[d.lote_id] = 0;
    if (lote?.identificado) linhasId.forEach(l => { map[l.destino_lote_id] = (map[l.destino_lote_id] || 0) + 1; });
    else linhasSem.forEach(l => { map[l.destino_lote_id] = (map[l.destino_lote_id] || 0) + 1; });
    return map;
  }, [destinos, linhasId, linhasSem, lote]);

  const total = (lote?.identificado ? linhasId.length : linhasSem.length);

  async function buscarAnimalPorNumero(numero: string): Promise<PrevInfo> {
    if (!lote) return { animalId: null, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
    const { data: an } = await maFrom("animais_pecuarista")
      .select("id")
      .eq("pecuarista_id", lote.pecuarista_id)
      .eq("numero", numero)
      .maybeSingle();
    if (!an) return { animalId: null, numero, peso_anterior_kg: null, data_anterior: null, lote_anterior: null };
    const animalId = (an as any).id as string;
    const { data: p } = await maFrom("pesos_animais_pecuarista")
      .select("peso_kg, created_at, pesagem_lote_id, pesagens_lote_pecuarista!inner(data_pesagem, lote_id, lotes_pecuarista!inner(nome_lote))")
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false })
      .limit(100);
    const row: any = escolherPesoAnterior(((p as any[]) ?? []), dataPesagem);
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
    setBuscando(true);
    try {
      const info = await buscarAnimalPorNumero(numero);
      setPrev(info);
      setStep("peso");
      setTimeout(() => inputRef.current?.focus(), 40);
    } finally { setBuscando(false); }
  }

  function handleConfirmarPesoId() {
    const peso = parseFloat(pesoAtual.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;
    setStep("destino");
  }

  function handleConfirmarPesoSem() {
    const peso = parseFloat(pesoAtual.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;
    setStep("destino");
  }

  function escolherDestinoId(destLoteId: string) {
    if (!prev) return;
    const peso = parseFloat(pesoAtual.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;
    const agora = new Date().toISOString();
    let gmd: number | null = null, dias: number | null = null;
    if (prev.peso_anterior_kg != null && prev.data_anterior) {
      dias = diasEntrePesagens(prev.data_anterior, dataPesagem);
      if (dias) gmd = (peso - prev.peso_anterior_kg) / dias;
    }
    setLinhasId(prev2 => [...prev2, {
      animal_id: prev.animalId ?? "",
      numero: prev.numero, peso_kg: peso, data: agora,
      peso_anterior_kg: prev.peso_anterior_kg, data_anterior: prev.data_anterior,
      lote_anterior: prev.lote_anterior, gmd_individual: gmd, dias,
      destino_lote_id: destLoteId,
    }]);
    void marcarInicioSePreciso(apartacaoId);
    setNumeroAtual(""); setPesoAtual(""); setPrev(null); setStep("numero");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function escolherDestinoSem(destLoteId: string) {
    const peso = parseFloat(pesoAtual.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0) return;
    setLinhasSem(prev => [...prev, {
      ordem: prev.length + 1, peso_kg: peso, rowId: crypto.randomUUID(), destino_lote_id: destLoteId,
    }]);
    void marcarInicioSePreciso(apartacaoId);
    setPesoAtual(""); setStep("peso");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function desfazer() {
    if (!lote) return;
    if (step === "destino") { setStep(lote.identificado ? "peso" : "peso"); return; }
    if (step === "peso" && lote.identificado) { setStep("numero"); setPesoAtual(""); setPrev(null); return; }
    if (lote.identificado) {
      setLinhasId(prev => prev.slice(0, -1));
    } else {
      setLinhasSem(prev => prev.slice(0, -1));
    }
  }

  async function finalizar() {
    if (!lote || !apartacaoId) return;
    if (total === 0) return toast.error("Nenhum animal pesado.");
    setFinalizando(true);
    try {
      const dataFim = new Date().toISOString();
      const horaIniFinal = horaInicio ?? dataFim;
      const secoes: ApartacaoDestinoSection[] = [];
      let totalGeralQtd = 0, totalGeralPeso = 0;

      for (const d of destinos) {
        const linhasDest = lote.identificado
          ? linhasId.filter(l => l.destino_lote_id === d.lote_id)
          : linhasSem.filter(l => l.destino_lote_id === d.lote_id);
        if (linhasDest.length === 0) continue;
        const pesos = linhasDest.map((l: any) => l.peso_kg as number);
        const peso_total = pesos.reduce((s, v) => s + v, 0);
        const qtd = linhasDest.length;
        const peso_medio = peso_total / qtd;

        // GMD do lote destino: compara com pesagem anterior desse destino
        const { data: ant } = await maFrom("pesagens_lote_pecuarista")
          .select("id, data_pesagem, peso_medio")
          .eq("lote_id", d.lote_id)
          .gt("quantidade_animais", 0)
          .order("data_pesagem", { ascending: false })
          .limit(100);
        const a = ((ant as any[]) ?? []).find((x) => dataLocalSP(x.data_pesagem) < dataLocalSP(dataPesagem));
        let gmdLote: number | null = null, dias: number | null = null, mediaAnt: number | null = null, dataAnt: string | null = null;
        if (a) {
          mediaAnt = Number(a.peso_medio);
          dataAnt = a.data_pesagem;
          dias = diasEntrePesagens(dataAnt!, dataPesagem);
          if (dias) gmdLote = (peso_medio - mediaAnt) / dias;
        }

        // cria pesagem do destino
        const { data: pRow, error: eP } = await maFrom("pesagens_lote_pecuarista").insert({
          lote_id: d.lote_id,
          apartacao_id: apartacaoId,
          data_pesagem: dataPesagem,
          hora_inicio: horaIniFinal,
          hora_fim: dataFim,
          peso_total, quantidade_animais: qtd, peso_medio,
          gmd: gmdLote,
        }).select("id").single();
        if (eP || !pRow) throw eP ?? new Error("Falha ao gravar pesagem do destino");
        const pesagemId = (pRow as any).id as string;

        // (contadores por destino são derivados das pesagens; nada a atualizar em apartacao_lotes)

        // Insere pesos identificados
        const identificadosOut: PecuaristaPesoIdentificado[] = [];
        const semIdOut: PecuaristaPesoSemId[] = [];

        if (lote.identificado) {
          const lins = linhasDest as LinhaId[];
          for (const l of lins) {
            let animalId = l.animal_id;
            if (!animalId) {
              const { data: novo, error: eA } = await maFrom("animais_pecuarista")
                .insert({ pecuarista_id: lote.pecuarista_id, numero: l.numero, lote_atual_id: d.lote_id })
                .select("id").single();
              if (eA || !novo) throw eA ?? new Error("Falha ao criar animal");
              animalId = (novo as any).id;
            } else {
              await maFrom("animais_pecuarista").update({ lote_atual_id: d.lote_id }).eq("id", animalId);
            }
            const { error: ePe } = await maFrom("pesos_animais_pecuarista").insert({
              pesagem_lote_id: pesagemId,
              animal_id: animalId,
              peso_kg: l.peso_kg,
              gmd_individual: l.gmd_individual,
            });
            if (ePe) throw ePe;
            identificadosOut.push({
              numero: l.numero, peso_kg: l.peso_kg, data: dataPesagem,
              peso_anterior_kg: l.peso_anterior_kg, data_anterior: l.data_anterior,
              lote_anterior: l.lote_anterior, gmd_individual: l.gmd_individual, dias: l.dias,
            });
          }
        } else {
          (linhasDest as LinhaSem[]).forEach((l, i) => semIdOut.push({ ordem: i + 1, peso_kg: l.peso_kg }));
        }

        secoes.push({
          nome_lote: d.nome_lote, codigo: d.codigo, identificado: d.identificado,
          quantidade: qtd, peso_total, peso_medio,
          peso_medio_anterior: mediaAnt, data_anterior: dataAnt, dias, gmd: gmdLote,
          identificados: lote.identificado ? identificadosOut : undefined,
          semId: !lote.identificado ? semIdOut : undefined,
        });

        totalGeralQtd += qtd;
        totalGeralPeso += peso_total;
      }

      // Cabeçalho dados
      const { data: fz } = await maFrom("fazendas_pecuarista").select("nome_fazenda, cidade, logo_url").eq("id", lote.fazenda_id).maybeSingle();
      const { data: pc } = await maFrom("pecuaristas").select("nome").eq("id", lote.pecuarista_id).maybeSingle();
      let categoriaLabel = CATEGORIAS_PADRAO.find(c => c.slug === lote.categoria)?.label ?? lote.categoria;
      if (lote.categoria === "customizada" && lote.categoria_customizada_id) {
        const { data: c } = await maFrom("categorias_pecuarista").select("nome").eq("id", lote.categoria_customizada_id).maybeSingle();
        categoriaLabel = (c as any)?.nome ?? "Personalizada";
      }

      const blob = await gerarPecuaristaApartacaoPdf({
        header: {
          produtor: (pc as any)?.nome ?? "",
          nomeEmpresa: null, logoUrl: (fz as any)?.logo_url ?? null,
          fazenda: (fz as any)?.nome_fazenda ?? "",
          cidade: (fz as any)?.cidade ?? null,
          lote: lote.nome_lote, codigoLote: lote.codigo,
          categoria: categoriaLabel, identificado: lote.identificado,
          data: dataPesagem,
          horaInicio: horaIniFinal,
          horaFim: dataFim,
        },
        totalGeral: { quantidade: totalGeralQtd, peso_total: totalGeralPeso },
        destinos: secoes,
      });
      let pdfUrl: string | null = null;
      try {
        if (isMaOffline()) throw new Error("offline");
        const path = `pecuarista/apartacoes/${apartacaoId}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage.from("relatorios")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
          pdfUrl = pub.publicUrl;
          await maFrom("apartacoes_pecuarista")
            .update({ pdf_url: pdfUrl, hora_fim: dataFim, hora_inicio: horaIniFinal })
            .eq("id", apartacaoId);
        } else {
          await maFrom("apartacoes_pecuarista")
            .update({ hora_fim: dataFim, hora_inicio: horaIniFinal })
            .eq("id", apartacaoId);
        }
      } catch { /* segue mesmo sem PDF */ }
      toast.success("Apartação finalizada!");
      navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}/apartacao/${apartacaoId}/resumo`, {
        state: {
          pdfUrl: pdfUrl ?? undefined,
          totalGeral: { quantidade: totalGeralQtd, peso_total: totalGeralPeso },
          destinos: secoes,
          dataFim: dataPesagem,
          horaFim: dataFim,
          horaInicio: horaIniFinal,
        },
      });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setFinalizando(false);
    }
  }

  if (loading || !lote) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // ============ CONFIG PHASE ============
  if (phase === "config") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${loteId}`)}><ArrowLeft className="w-4 h-4" /></Button>
          <h1 className="text-xl font-bold flex-1">Configurar apartação</h1>
        </div>

        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Lote de origem</div>
          <div className="font-semibold flex items-center gap-2 flex-wrap">
            {lote.nome_lote} <Badge variant="outline" className="font-mono">#{lote.codigo}</Badge>
            <Badge variant="outline">{lote.identificado ? "Identificado" : "Sem identificação"}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Data da pesagem: <strong>{new Date(dataPesagem).toLocaleDateString("pt-BR")}</strong></div>
        </Card>

        <Card className="p-4 space-y-2">
          <Label>Quantos lotes de destino?</Label>
          <div className="flex gap-2">
            {[2, 3].map(n => (
              <button key={n} type="button" onClick={() => setQtdSafe(n as 2 | 3)}
                className={`flex-1 h-14 rounded-lg border font-semibold ${qtd === n ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                {n} lotes
              </button>
            ))}
          </div>
        </Card>

        {confs.slice(0, qtd).map((c, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="font-semibold">Destino {i + 1}</div>
            <RadioGroup value={c.modo} onValueChange={(v) => setConfs(prev => {
              const next = [...prev];
              const keepMin = (next[i] as any).pesoMin ?? "";
              const keepMax = (next[i] as any).pesoMax ?? "";
              next[i] = v === "novo"
                ? { modo: "novo", nome: "", categoriaSlug: "boi_gordo", categoriaCustomId: "", novaCategoria: "", criandoNova: false, pesoMin: keepMin, pesoMax: keepMax }
                : { modo: "existente", loteExistenteId: "", pesoMin: keepMin, pesoMax: keepMax };
              return next;
            })}>
              <div className="flex items-center gap-2"><RadioGroupItem value="novo" id={`m-novo-${i}`} /><Label htmlFor={`m-novo-${i}`} className="font-normal cursor-pointer">Criar novo lote</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="existente" id={`m-ex-${i}`} /><Label htmlFor={`m-ex-${i}`} className="font-normal cursor-pointer">Usar lote existente</Label></div>
            </RadioGroup>

            {c.modo === "novo" ? (
              <>
                <div><Label>Nome do novo lote *</Label>
                  <Input value={c.nome} onChange={e => setConfs(prev => { const n = [...prev]; (n[i] as any).nome = e.target.value; return n; })} />
                </div>
                <div>
                  <Label className="mb-2 block">Categoria</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS_PADRAO.map(cp => (
                      <button key={cp.slug} type="button"
                        onClick={() => setConfs(prev => { const n = [...prev]; const cur = n[i] as any; cur.categoriaSlug = cp.slug; cur.categoriaCustomId = ""; cur.criandoNova = false; return n; })}
                        className={`px-3 py-1.5 rounded-full text-xs border ${!(c as any).criandoNova && (c as any).categoriaSlug === cp.slug ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                        {cp.label}
                      </button>
                    ))}
                    {customCats.map(cc => (
                      <button key={cc.id} type="button"
                        onClick={() => setConfs(prev => { const n = [...prev]; const cur = n[i] as any; cur.categoriaSlug = "customizada"; cur.categoriaCustomId = cc.id; cur.criandoNova = false; return n; })}
                        className={`px-3 py-1.5 rounded-full text-xs border ${!(c as any).criandoNova && (c as any).categoriaSlug === "customizada" && (c as any).categoriaCustomId === cc.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                        {cc.nome}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setConfs(prev => { const n = [...prev]; (n[i] as any).criandoNova = true; return n; })}
                      className={`px-3 py-1.5 rounded-full text-xs border ${(c as any).criandoNova ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                      + Nova categoria
                    </button>
                  </div>
                  {(c as any).criandoNova && (
                    <Input className="mt-2" placeholder="Nome da nova categoria"
                      value={(c as any).novaCategoria}
                      onChange={e => setConfs(prev => { const n = [...prev]; (n[i] as any).novaCategoria = e.target.value; return n; })} />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Novo lote será criado como <strong>{lote.identificado ? "Identificado" : "Sem identificação"}</strong> (mesmo do origem).</div>
              </>
            ) : (
              <div>
                <Label>Selecione o lote</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3"
                  value={(c as any).loteExistenteId}
                  onChange={e => setConfs(prev => { const n = [...prev]; (n[i] as any).loteExistenteId = e.target.value; return n; })}>
                  <option value="">— selecionar —</option>
                  {lotesFazenda.map(l => (
                    <option key={l.id} value={l.id}>{l.nome_lote} (#{l.codigo})</option>
                  ))}
                </select>
                {lotesFazenda.length === 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Nenhum outro lote {lote.identificado ? "identificado" : "sem identificação"} ativo nesta fazenda.</div>
                )}
              </div>
            )}

            <div className="pt-2 border-t space-y-2">
              <Label className="text-sm">Faixa de peso (kg) — opcional</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Peso mínimo</Label>
                  <Input type="number" inputMode="decimal" placeholder="ex: 401"
                    value={(c as any).pesoMin}
                    onChange={e => setConfs(prev => { const n = [...prev]; (n[i] as any).pesoMin = e.target.value; return n; })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Peso máximo</Label>
                  <Input type="number" inputMode="decimal" placeholder="ex: 500"
                    value={(c as any).pesoMax}
                    onChange={e => setConfs(prev => { const n = [...prev]; (n[i] as any).pesoMax = e.target.value; return n; })} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Deixe em branco para "sem limite". As faixas não podem se sobrepor entre os destinos.
              </div>
            </div>
          </Card>
        ))}

        {(() => {
          const configOk = confs.slice(0, qtd).every(c => {
            if (c.modo === "existente") { if (!c.loteExistenteId) return false; }
            else {
              if (!c.nome.trim()) return false;
              if (c.criandoNova && !c.novaCategoria.trim()) return false;
              if (!c.criandoNova && c.categoriaSlug === "customizada" && !c.categoriaCustomId) return false;
            }
            const r = parseRange(c.pesoMin, c.pesoMax);
            if ("error" in r) return false;
            return true;
          });
          const ranges = confs.slice(0, qtd).map(c => {
            const r = parseRange(c.pesoMin, c.pesoMax);
            return "error" in r ? { min: null, max: null } : r;
          });
          let overlap = false;
          for (let i = 0; i < ranges.length && !overlap; i++) {
            for (let j = i + 1; j < ranges.length && !overlap; j++) {
              const a = ranges[i], b = ranges[j];
              if (a.min == null && a.max == null) continue;
              if (b.min == null && b.max == null) continue;
              if (rangesOverlap(a, b)) overlap = true;
            }
          }
          const canStart = configOk && !overlap;
          return (
            <Button size="lg" className="w-full h-14 bg-primary hover:bg-primary/90" onClick={preparar} disabled={preparando || !canStart}>
              {preparando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Split className="w-5 h-5 mr-2" />}
              Começar apartação
            </Button>
          );
        })()}
      </div>
    );
  }

  // ============ WEIGHING PHASE ============
  const animalNum = total + 1;
  return (
    <div className="max-w-3xl mx-auto space-y-3 pb-44">
      <Card className="p-3">
        <div className="text-xs uppercase text-muted-foreground">Apartação — origem</div>
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          {lote.nome_lote}
          <Badge variant="outline">{lote.identificado ? "Identificado" : "Sem identificação"}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {destinos.map(d => (
          <div key={d.lote_id} className="p-3 rounded-lg bg-muted text-center">
            <div className="text-2xl font-bold text-primary">{contagemPorDestino[d.lote_id] || 0}</div>
            <div className="text-xs text-muted-foreground truncate">{d.nome_lote}</div>
          </div>
        ))}
      </div>

      {lote.identificado ? (
        <div className="space-y-3">
          {(step === "numero" || step === "peso") && (
            <>
              <div className="text-sm font-medium">
                {step === "numero"
                  ? `Animal ${animalNum} — Número`
                  : `Animal ${animalNum} — Peso — Nº ${prev?.numero}`}
              </div>
              {step === "peso" && prev?.peso_anterior_kg != null && (
                <Card className="p-3 bg-muted/50 text-sm">
                  <div><strong>Pesagem anterior:</strong></div>
                  <div>Peso: {prev.peso_anterior_kg.toFixed(1)} kg</div>
                  {prev.lote_anterior && <div>Lote: {prev.lote_anterior}</div>}
                  {prev.data_anterior && <div>Data: {new Date(prev.data_anterior).toLocaleString("pt-BR")}</div>}
                </Card>
              )}
              <Input
                key="apart-main-input-id"
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
                    else handleConfirmarPesoId();
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
                  else handleConfirmarPesoId();
                }}
                disabled={
                  step === "numero"
                    ? !numeroAtual.trim() || buscando
                    : !pesoAtual || parseFloat(pesoAtual.replace(",", ".")) <= 0
                }
              >
                {step === "numero" ? (
                  buscando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null
                ) : (
                  <Scale className="w-4 h-4 mr-2" />
                )}
                {step === "numero" ? "Continuar" : "Escolher destino ➜"}
              </Button>
            </>
          )}

          {step === "destino" && (() => {
            const peso = parseFloat(pesoAtual.replace(",", "."));
            const sugerido = destinoParaPeso(destinos, peso);
            return (
              <>
                <div className="text-sm font-medium">Animal {animalNum} — Destino</div>
                <div className="text-xs text-muted-foreground">Nº {prev?.numero} · {peso.toFixed(1)} kg</div>
                {sugerido ? (
                  <Button className="w-full h-16 text-base bg-primary hover:bg-primary/90"
                    onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()}
                    onClick={() => escolherDestinoId(sugerido.lote_id)}>
                    <Check className="w-5 h-5 mr-2" />
                    Confirmar {sugerido.nome_lote}
                  </Button>
                ) : (
                  <div className="text-xs text-amber-600">Peso não se encaixa em nenhuma faixa — escolha manualmente:</div>
                )}
                <div className="text-xs text-muted-foreground text-center">
                  {sugerido ? "ou trocar manualmente:" : "Destinos disponíveis:"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {destinos.map(d => {
                    const isSug = sugerido?.lote_id === d.lote_id;
                    return (
                      <button key={d.lote_id} type="button"
                        onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()}
                        onClick={() => escolherDestinoId(d.lote_id)}
                        className={`flex-1 min-w-[100px] px-3 py-3 rounded-lg border-2 text-sm transition ${
                          isSug
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-muted-foreground/30 bg-background text-foreground hover:bg-muted"
                        }`}>
                        {d.nome_lote}
                        <div className="text-xs opacity-70">{contagemPorDestino[d.lote_id] || 0} animais</div>
                      </button>
                    );
                  })}
                </div>
                <RecentesList lote={lote} linhasId={linhasId} linhasSem={linhasSem} destinos={destinos} />
              </>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {step === "peso" && (
            <>
              <div className="text-sm font-medium">Animal {animalNum} — Peso (kg)</div>
              <Input ref={inputRef} type="number" inputMode="decimal" placeholder="Peso (kg)"
                value={pesoAtual} onChange={e => setPesoAtual(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleConfirmarPesoSem(); } }}
                className="text-xl h-14 text-center" autoFocus />
              <Button className="w-full h-12"
                onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()}
                onClick={handleConfirmarPesoSem}
                disabled={!pesoAtual || parseFloat(pesoAtual.replace(",", ".")) <= 0}>
                <Scale className="w-4 h-4 mr-2" /> Escolher destino ➜
              </Button>
            </>
          )}
          {step === "destino" && (() => {
            const peso = parseFloat(pesoAtual.replace(",", "."));
            const sugerido = destinoParaPeso(destinos, peso);
            return (
              <>
                <div className="text-sm font-medium">Animal {animalNum} — Destino</div>
                <div className="text-xs text-muted-foreground">{peso.toFixed(1)} kg</div>
                {sugerido ? (
                  <Button className="w-full h-16 text-base bg-primary hover:bg-primary/90"
                    onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()}
                    onClick={() => escolherDestinoSem(sugerido.lote_id)}>
                    <Check className="w-5 h-5 mr-2" />
                    Confirmar {sugerido.nome_lote}
                  </Button>
                ) : (
                  <div className="text-xs text-amber-600">Peso não se encaixa em nenhuma faixa — escolha manualmente:</div>
                )}
                <div className="text-xs text-muted-foreground text-center">
                  {sugerido ? "ou trocar manualmente:" : "Destinos disponíveis:"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {destinos.map(d => {
                    const isSug = sugerido?.lote_id === d.lote_id;
                    return (
                      <button key={d.lote_id} type="button"
                        onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()}
                        onClick={() => escolherDestinoSem(d.lote_id)}
                        className={`flex-1 min-w-[100px] px-3 py-3 rounded-lg border-2 text-sm transition ${
                          isSug
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-muted-foreground/30 bg-background text-foreground hover:bg-muted"
                        }`}>
                        {d.nome_lote}
                        <div className="text-xs opacity-70">{contagemPorDestino[d.lote_id] || 0} animais</div>
                      </button>
                    );
                  })}
                </div>
                <RecentesList lote={lote} linhasId={linhasId} linhasSem={linhasSem} destinos={destinos} />
              </>
            );
          })()}
        </div>
      )}

      <div
        className="fixed left-0 right-0 px-4 pt-3 bg-background/95 backdrop-blur border-t flex gap-2 z-50 shadow-lg"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "1rem" }}
      >
        <Button variant="outline" onClick={desfazer} disabled={total === 0 && step === (lote.identificado ? "numero" : "peso")}>
          <Undo2 className="w-4 h-4 mr-1" /> Desfazer
        </Button>
        <Button className="flex-1" onClick={() => void finalizar()} disabled={total === 0 || finalizando}>
          {finalizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Finalizar ({total})
        </Button>
      </div>
    </div>
  );
}

function RecentesList({ lote, linhasId, linhasSem, destinos }: {
  lote: { identificado: boolean };
  linhasId: LinhaId[];
  linhasSem: LinhaSem[];
  destinos: Destino[];
}) {
  const nomeDestino = (id: string) => destinos.find(d => d.lote_id === id)?.nome_lote ?? "—";
  const items = lote.identificado
    ? linhasId.slice(-5).reverse().map((l, i) => ({
        key: `${l.animal_id}-${i}`,
        left: `Nº ${l.numero}`,
        mid: `${l.peso_kg.toFixed(1)} kg`,
        right: nomeDestino(l.destino_lote_id),
      }))
    : linhasSem.slice(-5).reverse().map((l) => ({
        key: l.rowId,
        left: `#${l.ordem}`,
        mid: `${l.peso_kg.toFixed(1)} kg`,
        right: nomeDestino(l.destino_lote_id),
      }));
  if (items.length === 0) return null;
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground mb-2">Últimos pesados nesta sessão</div>
      <div className="text-xs space-y-1">
        {items.map((it) => (
          <div key={it.key} className="flex justify-between gap-2 border-b border-border/40 py-1 last:border-0">
            <span className="font-medium">{it.left}</span>
            <span>{it.mid}</span>
            <span className="text-muted-foreground truncate max-w-[40%] text-right">{it.right}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

