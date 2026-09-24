import { useEffect, useMemo, useRef, useState } from "react";
import { useCriticalOperation } from "@/lib/criticalOperations";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Check, CloudOff, Loader2, Scale, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { enqueueMa, undoMa, flushMaAndCount, getMaQueueItems } from "@/lib/maisArrobasQueue";
import { setPesagemAtiva, clearPesagemAtiva } from "@/lib/maisArrobasResume";
import { useMaisArrobasSync } from "@/hooks/useMaisArrobasSync";
import { calcularAnimais, totalizar } from "@/lib/pesagemCompra";

type Pesagem = {
  id: string;
  cliente_id: string;
  categoria: string;
  tipo_preco: "arroba" | "kg" | "fixo_animal" | "misto" | null;
  preco_valor: number | null;
  modo_percentual: "fixo" | "aleatorio" | "na" | null;
  percentual_fixo: number | null;
  preco_arroba: number | null;
  preco_kg: number | null;
  preco_fixo_animal: number | null;
  sem_valores: boolean;
  status: string;
  tipo_balanca: "individual" | "balancao" | null;
  quantidade_padrao_balancao: number | null;
};

type TipoInd = "arroba" | "kg" | "fixo_animal";

type CategoriaCfg = {
  categoria: string;
  tipo_preco: TipoInd;
  preco_valor: number;
};

const CATEGORIA_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
};

type Peso = {
  id: string;
  ordem: number;
  peso_kg: number;
  percentual_individual: number | null;
  tipo_preco_individual: TipoInd | null;
  categoria_individual: string | null;
  leitura_balancao_id: string | null;
};

type SubStep = "peso" | "categoria" | "tipo_pagamento" | "percentual";

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 py-2 rounded-full text-sm border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

export default function PesadorPesagemExecPage() {
  const { pesagemId } = useParams<{ pesagemId: string }>();
  const navigate = useNavigate();
  const syncSnap = useMaisArrobasSync();
  const [finalizadoLocal, setFinalizadoLocal] = useState(false);

  const [pesagem, setPesagem] = useState<Pesagem | null>(null);
  const [clienteNome, setClienteNome] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pesos, setPesos] = useState<Peso[]>([]);
  const [current, setCurrent] = useState("");
  const [subStep, setSubStep] = useState<SubStep>("peso");
  const [pendingPeso, setPendingPeso] = useState<number | null>(null);
  const [pendingTipo, setPendingTipo] = useState<TipoInd | null>(null);
  const [pendingCategoria, setPendingCategoria] = useState<string | null>(null);
  const [categoriasLote, setCategoriasLote] = useState<CategoriaCfg[]>([]);
  const [qtdBalancaoAtual, setQtdBalancaoAtual] = useState<number>(2);
  const [salvandoLeitura, setSalvandoLeitura] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Pesagem em andamento: segura recargas automáticas (nova versão, falha de chunk).
  useCriticalOperation(!loading && !!pesagem && !finalizadoLocal, "pesagem-pesador");

  useEffect(() => {
    (async () => {
      if (!pesagemId) return;
      const { data: p, error } = await supabase
        .from("pesagens_compra")
        .select(
          "id, cliente_id, categoria, tipo_preco, preco_valor, modo_percentual, percentual_fixo, preco_arroba, preco_kg, preco_fixo_animal, sem_valores, status, tipo_balanca, quantidade_padrao_balancao"
        )
        .eq("id", pesagemId)
        .maybeSingle();
      if (error || !p) {
        toast({ title: "Pesagem não encontrada", description: error?.message, variant: "destructive" });
        navigate("/pesador/clientes");
        return;
      }
      setPesagem(p as Pesagem);
      const qDef = (p as any).quantidade_padrao_balancao;
      if (qDef && qDef >= 2 && qDef <= 5) setQtdBalancaoAtual(qDef);
      if ((p as Pesagem).tipo_preco === "misto") {
        const { data: cats } = await supabase
          .from("pesagens_compra_categorias")
          .select("categoria, tipo_preco, preco_valor")
          .eq("pesagem_id", pesagemId);
        setCategoriasLote(
          (cats ?? []).map((r: any) => ({
            categoria: r.categoria,
            tipo_preco: r.tipo_preco,
            preco_valor: Number(r.preco_valor),
          }))
        );
      }
      const { data: c } = await supabase
        .from("clientes_pesador")
        .select("nome")
        .eq("id", (p as Pesagem).cliente_id)
        .maybeSingle();
      const nomeCliente = (c?.nome as string) ?? "";
      setClienteNome(nomeCliente);

      // ---- Retomada: pesos do servidor + pesos ainda na fila local ----
      const [{ data: srv }, fila] = await Promise.all([
        supabase
          .from("pesos_pesagem_compra")
          .select("id, ordem, peso_kg, percentual_individual, tipo_preco_individual, categoria_individual, leitura_balancao_id")
          .eq("pesagem_id", pesagemId)
          .order("ordem"),
        getMaQueueItems(),
      ]);
      const removidos = new Set(
        fila.filter((i) => i.op.kind === "delete" && i.op.table === "pesos_pesagem_compra").map((i) => i.refId),
      );
      const porId = new Map<string, Peso>();
      for (const r of (srv ?? []) as any[]) {
        porId.set(r.id, {
          id: r.id,
          ordem: Number(r.ordem),
          peso_kg: Number(r.peso_kg),
          percentual_individual: r.percentual_individual != null ? Number(r.percentual_individual) : null,
          tipo_preco_individual: r.tipo_preco_individual,
          categoria_individual: r.categoria_individual,
          leitura_balancao_id: r.leitura_balancao_id,
        });
      }
      for (const i of fila) {
        if (i.op.kind !== "insert" || i.op.table !== "pesos_pesagem_compra") continue;
        const r = i.op.row;
        if (r.pesagem_id !== pesagemId || porId.has(r.id)) continue;
        porId.set(r.id, {
          id: r.id,
          ordem: Number(r.ordem),
          peso_kg: Number(r.peso_kg),
          percentual_individual: r.percentual_individual ?? null,
          tipo_preco_individual: r.tipo_preco_individual ?? null,
          categoria_individual: r.categoria_individual ?? null,
          leitura_balancao_id: r.leitura_balancao_id ?? null,
        });
      }
      const restaurados = [...porId.values()]
        .filter((x) => !removidos.has(x.id))
        .sort((a, b) => a.ordem - b.ordem);
      setPesos(restaurados);

      const finalizadaNaFila = fila.some(
        (i) => i.op.kind === "update" && i.op.table === "pesagens_compra" && i.op.id === pesagemId && i.op.values?.status === "finalizada",
      );
      if (finalizadaNaFila) setFinalizadoLocal(true);
      if (finalizadaNaFila || (p as Pesagem).status === "finalizada") {
        clearPesagemAtiva(pesagemId);
      } else {
        setPesagemAtiva({
          tipo: "pesador",
          pesagemId,
          path: `/pesador/pesagem/${pesagemId}`,
          label: nomeCliente ? `o cliente ${nomeCliente}` : "um cliente",
        });
      }
      if (restaurados.length > 0) {
        toast({ title: "Pesagem retomada", description: `${restaurados.length} peso(s) recuperado(s). Continue de onde parou.` });
      }
      setLoading(false);
    })();
  }, [pesagemId, navigate]);

  useEffect(() => {
    if (finalizadoLocal && pesagemId) clearPesagemAtiva(pesagemId);
  }, [finalizadoLocal, pesagemId]);

  useEffect(() => {
    if (!loading && subStep !== "categoria" && subStep !== "tipo_pagamento") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, subStep, pesos.length]);

  const media = useMemo(
    () => (pesos.length ? pesos.reduce((a, b) => a + b.peso_kg, 0) / pesos.length : 0),
    [pesos]
  );

  const semValores = !!pesagem?.sem_valores;
  const isMisto = !semValores && pesagem?.tipo_preco === "misto";
  const modoAleatorio =
    !semValores && pesagem?.tipo_preco === "arroba" && pesagem.modo_percentual === "aleatorio";
  const isBalancao = pesagem?.tipo_balanca === "balancao";

  async function commitBalancaoLeitura() {
    if (!pesagem || salvandoLeitura) return;
    const total = parseFloat(current.replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) return;
    const qtd = qtdBalancaoAtual;
    if (!qtd || qtd < 2) return;
    setSalvandoLeitura(true);
    try {
      const pesoIndiv = Math.round((total / qtd) * 100) / 100;
      // ordem da leitura calculada localmente (sem consulta ao servidor)
      const ordemLeitura = new Set(pesos.map((p) => p.leitura_balancao_id).filter(Boolean)).size + 1;
      const leituraId = crypto.randomUUID();
      enqueueMa(leituraId, {
        kind: "insert",
        table: "leituras_balancao_pesador",
        row: {
          id: leituraId,
          pesagem_id: pesagem.id,
          ordem: ordemLeitura,
          peso_total: total,
          quantidade_animais: qtd,
          peso_individual: pesoIndiv,
        },
      });
      // percentual padrão para arroba+fixo
      const pctPadrao =
        pesagem.tipo_preco === "arroba" && pesagem.modo_percentual === "fixo"
          ? pesagem.percentual_fixo
          : null;
      const base = pesos.length;
      const novos: Peso[] = [];
      for (let i = 0; i < qtd; i++) {
        novos.push({
          id: crypto.randomUUID(),
          ordem: base + i + 1,
          peso_kg: pesoIndiv,
          percentual_individual: pctPadrao,
          tipo_preco_individual: null,
          categoria_individual: null,
          leitura_balancao_id: leituraId,
        });
      }
      setPesos((prev) => [...prev, ...novos]);
      setCurrent("");
      // reset qtd to default
      const qDef = pesagem.quantidade_padrao_balancao ?? 2;
      setQtdBalancaoAtual(qDef >= 2 && qDef <= 5 ? qDef : 2);
      for (const n of novos) persistirPeso(n);
      inputRef.current?.focus();
    } finally {
      setSalvandoLeitura(false);
    }
  }

  /** Grava no aparelho e envia em segundo plano (idempotente pelo id). */
  function persistirPeso(p: Peso) {
    enqueueMa(p.id, {
      kind: "insert",
      table: "pesos_pesagem_compra",
      row: {
        id: p.id,
        pesagem_id: pesagemId,
        ordem: p.ordem,
        peso_kg: p.peso_kg,
        percentual_individual: p.percentual_individual,
        tipo_preco_individual: p.tipo_preco_individual,
        categoria_individual: p.categoria_individual,
        leitura_balancao_id: p.leitura_balancao_id,
      },
    });
  }

  async function commitPeso(
    peso_kg: number,
    tipo: TipoInd | null,
    pct: number | null,
    categoria: string | null,
    leituraBalancaoId: string | null = null,
  ) {
    const ordem = pesos.length + 1;
    const novo: Peso = {
      id: crypto.randomUUID(),
      ordem,
      peso_kg,
      percentual_individual: pct,
      tipo_preco_individual: tipo,
      categoria_individual: categoria,
      leitura_balancao_id: leituraBalancaoId,
    };
    setPesos((prev) => [...prev, novo]);
    setCurrent("");
    setPendingPeso(null);
    setPendingTipo(null);
    setPendingCategoria(null);
    setSubStep("peso");
    inputRef.current?.focus();
    persistirPeso(novo);
  }

  async function handleProximo() {
    if (subStep === "tipo_pagamento" || subStep === "categoria") return;
    const val = parseFloat(current.replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) return;

    if (subStep === "peso") {
      if (isMisto) {
        setPendingPeso(val);
        setCurrent("");
        setSubStep("categoria");
        return;
      }
      if (modoAleatorio) {
        setPendingPeso(val);
        setCurrent("");
        setSubStep("percentual");
        inputRef.current?.focus();
        return;
      }
      await commitPeso(val, null, null, null);
      return;
    }

    // percentual
    if (pendingPeso == null) {
      setSubStep("peso");
      return;
    }
    if (val <= 0 || val > 100) {
      toast({ title: "Percentual inválido", description: "Informe um valor entre 1 e 100.", variant: "destructive" });
      return;
    }
    const tipo = isMisto ? pendingTipo : null;
    await commitPeso(pendingPeso, tipo, val, pendingCategoria);
  }

  async function handleEscolherCategoria(cat: string) {
    if (pendingPeso == null) return;
    const cfg = categoriasLote.find((c) => c.categoria === cat);
    if (!cfg) {
      toast({ title: "Categoria não configurada", variant: "destructive" });
      return;
    }
    setPendingCategoria(cat);
    setPendingTipo(cfg.tipo_preco);
    if (cfg.tipo_preco === "arroba") {
      setSubStep("percentual");
      inputRef.current?.focus();
    } else {
      await commitPeso(pendingPeso, cfg.tipo_preco, null, cat);
    }
  }

  async function handleDesfazer() {
    if (isBalancao) {
      const last = pesos[pesos.length - 1];
      if (!last || !last.leitura_balancao_id) return;
      const leituraId = last.leitura_balancao_id;
      const doGrupo = pesos.filter((p) => p.leitura_balancao_id === leituraId);
      setPesos((prev) => prev.filter((p) => p.leitura_balancao_id !== leituraId));
      for (const p of doGrupo) undoMa(p.id, "pesos_pesagem_compra");
      undoMa(leituraId, "leituras_balancao_pesador");
      return;
    }
    if (subStep !== "peso") {
      setSubStep("peso");
      setPendingPeso(null);
      setPendingTipo(null);
      setPendingCategoria(null);
      setCurrent("");
      return;
    }
    const last = pesos[pesos.length - 1];
    if (!last) return;
    setPesos((prev) => prev.slice(0, -1));
    undoMa(last.id, "pesos_pesagem_compra");
  }


  /** Registros desta pesagem ainda na fila local (pesos, leituras e o fechamento). */
  function pendentesDaPesagem() {
    const ids = new Set<string>();
    for (const p of pesos) {
      if (syncSnap.pendingRefIds.has(p.id)) ids.add(p.id);
      if (p.leitura_balancao_id && syncSnap.pendingRefIds.has(p.leitura_balancao_id)) ids.add(p.leitura_balancao_id);
    }
    if (pesagem && syncSnap.pendingRefIds.has(pesagem.id)) ids.add(pesagem.id);
    return ids.size;
  }

  async function handleFinalizar() {
    if (!pesagem || pesos.length === 0) {
      toast({ title: "Nenhum peso registrado", variant: "destructive" });
      return;
    }
    setSaving(true);
    let valorTotal: number | null = null;
    if (!semValores) {
      const categoriasMap: Record<string, { tipo_preco: any; preco_valor: number }> = {};
      for (const c of categoriasLote) {
        categoriasMap[c.categoria] = { tipo_preco: c.tipo_preco, preco_valor: c.preco_valor };
      }
      const cfg: any = {
        tipo_preco: pesagem.tipo_preco,
        preco_valor: Number(pesagem.preco_valor ?? 0),
        modo_percentual: pesagem.modo_percentual ?? "na",
        percentual_fixo: pesagem.percentual_fixo != null ? Number(pesagem.percentual_fixo) : null,
        preco_arroba: pesagem.preco_arroba != null ? Number(pesagem.preco_arroba) : null,
        preco_kg: pesagem.preco_kg != null ? Number(pesagem.preco_kg) : null,
        preco_fixo_animal: pesagem.preco_fixo_animal != null ? Number(pesagem.preco_fixo_animal) : null,
        categorias_map: pesagem.tipo_preco === "misto" ? categoriasMap : null,
      };
      const totals = totalizar(calcularAnimais(cfg, pesos as any));
      valorTotal = totals.totalValor;
    }
    // Fechamento vai para a mesma fila local — funciona offline.
    enqueueMa(pesagem.id, {
      kind: "update",
      table: "pesagens_compra",
      id: pesagem.id,
      values: {
        status: "finalizada",
        finalizada_at: new Date().toISOString(),
        valor_total_pago: valorTotal,
      },
    });
    setFinalizadoLocal(true);
    setSaving(false);
    // Se a internet ajudar, segue direto para o resumo como antes.
    const restantes = await flushMaAndCount();
    if (restantes === 0) navigate(`/pesador/pesagem/${pesagem.id}/resumo`);
  }

  async function handleIrParaPdf() {
    if (!pesagem) return;
    setSaving(true);
    const restantes = await flushMaAndCount();
    setSaving(false);
    if (restantes > 0) {
      toast({
        title: "PDF ainda não disponível",
        description: `Aguardando sincronizar ${restantes} registro(s) antes de gerar o PDF. Tente de novo quando a internet voltar.`,
        variant: "destructive",
      });
      return;
    }
    navigate(`/pesador/pesagem/${pesagem.id}/resumo`);
  }

  if (loading || !pesagem) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  const tipoLabel = semValores
    ? "sem valores"
    : pesagem.tipo_preco === "arroba"
    ? "@"
    : pesagem.tipo_preco === "kg"
    ? "kg"
    : pesagem.tipo_preco === "fixo_animal"
    ? "fixo/animal"
    : "misto";

  const animalNum = pesos.length + 1;

  if (finalizadoLocal) {
    const pend = pendentesDaPesagem();
    const pesosPend = pesos.filter(
      (p) => syncSnap.pendingRefIds.has(p.id) || (p.leitura_balancao_id && syncSnap.pendingRefIds.has(p.leitura_balancao_id)),
    ).length;
    return (
      <div className="space-y-4 pb-28">
        <div className="rounded-lg border bg-card p-4 space-y-3 text-center">
          <Check className="w-8 h-8 mx-auto text-primary" />
          <div className="font-semibold">Pesagem finalizada</div>
          <div className="text-sm text-muted-foreground">{clienteNome} • {pesos.length} animais</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-primary">{pesos.length - pesosPend}</p>
              <p className="text-xs text-muted-foreground">confirmados no servidor</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                {pesosPend > 0 && <CloudOff className="w-5 h-5" />}{pesosPend}
              </p>
              <p className="text-xs text-muted-foreground">pendentes de envio</p>
            </div>
          </div>
          {pend > 0 ? (
            <p className="text-xs text-muted-foreground">
              Os dados estão salvos no aparelho e serão enviados automaticamente quando a internet voltar.
              O PDF fica disponível depois que tudo for sincronizado.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Tudo sincronizado. O PDF já pode ser gerado.</p>
          )}
        </div>
        <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pesador/clientes")}>Voltar</Button>
          <Button className="flex-1" onClick={() => void handleIrParaPdf()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {pend > 0 ? `Gerar PDF (${pend} pendente${pend > 1 ? "s" : ""})` : "Gerar PDF"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Produtor</div>
        <div className="font-semibold">{clienteNome}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {pesagem.categoria} • {tipoLabel}
          {pesagem.tipo_preco === "arroba" && pesagem.modo_percentual === "fixo" && pesagem.percentual_fixo != null
            ? ` • ${pesagem.percentual_fixo}%`
            : ""}
          {pesagem.tipo_preco === "arroba" && pesagem.modo_percentual === "aleatorio" ? " • rend. aleatório" : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-2xl font-bold text-primary">{pesos.length}</p>
          <p className="text-xs text-muted-foreground">animais pesados</p>
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-2xl font-bold text-primary">
            {media > 0 ? media.toFixed(1).replace(".", ",") : "—"}
          </p>
          <p className="text-xs text-muted-foreground">média (kg)</p>
        </div>
      </div>

      {isBalancao ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Leitura em Balanção — Peso TOTAL (kg)
          </div>
          <Input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            placeholder="Peso total da leitura (kg)"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitBalancaoLeitura();
              }
            }}
            className="text-xl h-14 text-center"
            autoFocus
          />
          <div className="flex gap-2 items-center">
            <select
              value={qtdBalancaoAtual}
              onChange={(e) => setQtdBalancaoAtual(Number(e.target.value))}
              className="h-12 rounded-md border border-input bg-background px-3 text-sm"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} animais</option>
              ))}
            </select>
            <Button
              className="flex-1 h-12"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => void commitBalancaoLeitura()}
              disabled={
                !current ||
                parseFloat(current.replace(",", ".")) <= 0 ||
                salvandoLeitura
              }
            >
              {salvandoLeitura ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
              Próximo ➜
            </Button>
          </div>
          {current && parseFloat(current.replace(",", ".")) > 0 && (
            <p className="text-xs text-muted-foreground">
              Peso individual: {(parseFloat(current.replace(",", ".")) / qtdBalancaoAtual).toFixed(1).replace(".", ",")} kg
              × {qtdBalancaoAtual} animais
            </p>
          )}
        </div>
      ) : subStep === "categoria" ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Animal {animalNum} — Categoria ({pendingPeso} kg)
          </div>
          <div className="flex flex-wrap gap-2">
            {categoriasLote.map((c) => (
              <Chip
                key={c.categoria}
                active={false}
                onClick={() => void handleEscolherCategoria(c.categoria)}
              >
                {CATEGORIA_LABELS[c.categoria] ?? c.categoria}
                <span className="ml-1 text-xs opacity-70">
                  ({c.tipo_preco === "arroba" ? "@" : c.tipo_preco === "kg" ? "kg" : "fixo"})
                </span>
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {subStep === "peso"
              ? `Animal ${animalNum} — Peso (kg)`
              : `Animal ${animalNum} — Rendimento (%)`}
          </div>
          <Input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            placeholder={subStep === "peso" ? "Peso (kg)" : "Rendimento (%)"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleProximo();
              }
            }}
            className="text-xl h-14 text-center"
            autoFocus
          />
          <Button
            className="w-full h-12"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => void handleProximo()}
            disabled={!current || parseFloat(current.replace(",", ".")) <= 0}
          >
            <Scale className="w-4 h-4 mr-2" />
            Próximo ➜
          </Button>
        </div>
      )}

      {pesos.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
            <span>Histórico</span>
            {syncSnap.pendingCount > 0 && (
              <span className="flex items-center gap-1">
                <CloudOff className="w-3 h-3" /> {syncSnap.pendingCount} aguardando envio
              </span>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {pesos
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="flex justify-between border-b border-border/40 py-1">
                  <span className="flex items-center gap-1">
                    {p.ordem}
                    {(syncSnap.pendingRefIds.has(p.id) ||
                      (p.leitura_balancao_id && syncSnap.pendingRefIds.has(p.leitura_balancao_id))) && (
                      <CloudOff className="w-3 h-3 text-muted-foreground" aria-label="Pendente de envio" />
                    )}
                  </span>
                  <span>
                    {p.peso_kg} kg
                    {p.tipo_preco_individual ? ` • ${
                      p.tipo_preco_individual === "arroba"
                        ? "@"
                        : p.tipo_preco_individual === "kg"
                        ? "kg"
                        : "fixo"
                    }` : ""}
                    {p.percentual_individual != null ? ` • ${p.percentual_individual}%` : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t flex gap-2">
        <Button variant="outline" onClick={() => void handleDesfazer()} disabled={pesos.length === 0 && subStep === "peso"}>
          <Undo2 className="w-4 h-4 mr-1" /> Desfazer
        </Button>
        <Button
          className="flex-1"
          onClick={() => void handleFinalizar()}
          disabled={pesos.length === 0 || saving}
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Finalizar ({pesos.length})
        </Button>
      </div>
    </div>
  );
}
