import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2, Scale, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Pesagem = {
  id: string;
  cliente_id: string;
  categoria: string;
  tipo_preco: "arroba" | "kg" | "fixo_animal" | "misto";
  preco_valor: number | null;
  modo_percentual: "fixo" | "aleatorio" | "na" | null;
  percentual_fixo: number | null;
  preco_arroba: number | null;
  preco_kg: number | null;
  preco_fixo_animal: number | null;
  status: string;
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
  ordem: number;
  peso_kg: number;
  percentual_individual: number | null;
  tipo_preco_individual: TipoInd | null;
  categoria_individual: string | null;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      if (!pesagemId) return;
      const { data: p, error } = await supabase
        .from("pesagens_compra")
        .select(
          "id, cliente_id, categoria, tipo_preco, preco_valor, modo_percentual, percentual_fixo, preco_arroba, preco_kg, preco_fixo_animal, status"
        )
        .eq("id", pesagemId)
        .maybeSingle();
      if (error || !p) {
        toast({ title: "Pesagem não encontrada", description: error?.message, variant: "destructive" });
        navigate("/pesador/clientes");
        return;
      }
      setPesagem(p as Pesagem);
      const { data: c } = await supabase
        .from("clientes_pesador")
        .select("nome")
        .eq("id", (p as Pesagem).cliente_id)
        .maybeSingle();
      setClienteNome((c?.nome as string) ?? "");
      setLoading(false);
    })();
  }, [pesagemId, navigate]);

  useEffect(() => {
    if (!loading && subStep !== "tipo_pagamento") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, subStep, pesos.length]);

  const media = useMemo(
    () => (pesos.length ? pesos.reduce((a, b) => a + b.peso_kg, 0) / pesos.length : 0),
    [pesos]
  );

  const isMisto = pesagem?.tipo_preco === "misto";
  const modoAleatorio =
    pesagem?.tipo_preco === "arroba" && pesagem.modo_percentual === "aleatorio";

  async function persistirPeso(p: Peso) {
    const { error } = await supabase.from("pesos_pesagem_compra").insert({
      pesagem_id: pesagemId,
      ordem: p.ordem,
      peso_kg: p.peso_kg,
      percentual_individual: p.percentual_individual,
      tipo_preco_individual: p.tipo_preco_individual,
    });
    if (error) {
      toast({ title: "Erro ao salvar peso", description: error.message, variant: "destructive" });
      setPesos((prev) => prev.filter((x) => x.ordem !== p.ordem));
      return false;
    }
    return true;
  }

  async function commitPeso(peso_kg: number, tipo: TipoInd | null, pct: number | null) {
    const ordem = pesos.length + 1;
    const novo: Peso = {
      ordem,
      peso_kg,
      percentual_individual: pct,
      tipo_preco_individual: tipo,
    };
    setPesos((prev) => [...prev, novo]);
    setCurrent("");
    setPendingPeso(null);
    setPendingTipo(null);
    setSubStep("peso");
    // Mantém o teclado aberto: reforça o foco no mesmo gesto do usuário
    inputRef.current?.focus();
    await persistirPeso(novo);
  }

  async function handleProximo() {
    if (subStep === "tipo_pagamento") return; // avançado por chips
    const val = parseFloat(current.replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) return;

    if (subStep === "peso") {
      if (isMisto) {
        setPendingPeso(val);
        setCurrent("");
        setSubStep("tipo_pagamento");
        return;
      }
      if (modoAleatorio) {
        setPendingPeso(val);
        setCurrent("");
        setSubStep("percentual");
        // Mantém teclado aberto ao trocar peso → percentual
        inputRef.current?.focus();
        return;
      }
      // fluxo tradicional (kg / fixo / arroba com % fixo)
      await commitPeso(val, null, null);
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
    // Se veio do fluxo misto, usa pendingTipo; senão null (arroba do lote)
    const tipo = isMisto ? pendingTipo : null;
    await commitPeso(pendingPeso, tipo, val);
  }

  async function handleEscolherTipo(tipo: TipoInd) {
    if (pendingPeso == null) return;
    // Valida se o lote misto tem esse preço configurado
    if (pesagem) {
      const has =
        (tipo === "arroba" && (pesagem.preco_arroba ?? 0) > 0) ||
        (tipo === "kg" && (pesagem.preco_kg ?? 0) > 0) ||
        (tipo === "fixo_animal" && (pesagem.preco_fixo_animal ?? 0) > 0);
      if (!has) {
        toast({
          title: "Preço não configurado",
          description: "Esta forma de pagamento não foi cadastrada no lote.",
          variant: "destructive",
        });
        return;
      }
    }
    setPendingTipo(tipo);
    if (tipo === "arroba") {
      setSubStep("percentual");
    } else {
      await commitPeso(pendingPeso, tipo, null);
    }
  }

  async function handleDesfazer() {
    // Se estamos em um sub-passo pendente, apenas volta
    if (subStep !== "peso") {
      setSubStep("peso");
      setPendingPeso(null);
      setPendingTipo(null);
      setCurrent("");
      return;
    }
    const last = pesos[pesos.length - 1];
    if (!last) return;
    setPesos((prev) => prev.slice(0, -1));
    const { error } = await supabase
      .from("pesos_pesagem_compra")
      .delete()
      .eq("pesagem_id", pesagemId!)
      .eq("ordem", last.ordem);
    if (error) {
      toast({ title: "Erro ao desfazer", description: error.message, variant: "destructive" });
    }
  }

  async function handleFinalizar() {
    if (!pesagem || pesos.length === 0) {
      toast({ title: "Nenhum peso registrado", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("pesagens_compra")
      .update({ status: "finalizada", finalizada_at: new Date().toISOString() })
      .eq("id", pesagem.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" });
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

  const tipoLabel =
    pesagem.tipo_preco === "arroba"
      ? "@"
      : pesagem.tipo_preco === "kg"
      ? "kg"
      : pesagem.tipo_preco === "fixo_animal"
      ? "fixo/animal"
      : "misto";

  const animalNum = pesos.length + 1;

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

      {subStep === "tipo_pagamento" ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Animal {animalNum} — Forma de pagamento ({pendingPeso} kg)
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={false}
              disabled={!((pesagem.preco_arroba ?? 0) > 0)}
              onClick={() => void handleEscolherTipo("arroba")}
            >
              @
            </Chip>
            <Chip
              active={false}
              disabled={!((pesagem.preco_kg ?? 0) > 0)}
              onClick={() => void handleEscolherTipo("kg")}
            >
              kg
            </Chip>
            <Chip
              active={false}
              disabled={!((pesagem.preco_fixo_animal ?? 0) > 0)}
              onClick={() => void handleEscolherTipo("fixo_animal")}
            >
              Fixo por animal
            </Chip>
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
          <div className="text-xs text-muted-foreground mb-2">Histórico</div>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {pesos
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.ordem} className="flex justify-between border-b border-border/40 py-1">
                  <span>{p.ordem}</span>
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
