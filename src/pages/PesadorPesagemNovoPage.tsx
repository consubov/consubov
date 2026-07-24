import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIAS: { label: string; value: string }[] = [
  { label: "Boi Gordo", value: "boi_gordo" },
  { label: "Vaca Gorda", value: "vaca_gorda" },
  { label: "Vaca Magra", value: "vaca_magra" },
  { label: "Boi Magro", value: "boi_magro" },
  { label: "Garrote", value: "garrote" },
  { label: "Novilha", value: "novilha" },
  { label: "Bezerro", value: "bezerro" },
  { label: "Bezerra", value: "bezerra" },
  { label: "Aleatória", value: "aleatoria" },
];

const CATEGORIAS_PURAS = CATEGORIAS.filter((c) => c.value !== "aleatoria");

type TipoPreco = "arroba" | "kg" | "fixo_animal";
type ModoPercentual = "fixo" | "aleatorio";
type ModoPesagem = "comercial" | "rotina";

type Cliente = {
  id: string;
  nome: string;
  nome_fazenda: string | null;
  cidade: string | null;
};

type CategoriaMistaCfg = {
  tipo_preco: TipoPreco | "";
  preco_valor: string;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-full text-sm border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

const parseNum = (s: string) => parseFloat(s.replace(",", "."));

export default function PesadorPesagemNovoPage() {
  const { roleData } = useAuth();
  const pesadorId = roleData.roleId;
  const [params] = useSearchParams();
  const clienteId = params.get("cliente_id") ?? "";
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modo, setModo] = useState<ModoPesagem>("comercial");
  const [categoria, setCategoria] = useState<string>("");
  const [tipoPreco, setTipoPreco] = useState<TipoPreco | "">("");
  const [precoValor, setPrecoValor] = useState<string>("");
  const [modoPercentual, setModoPercentual] = useState<ModoPercentual | "">("");
  const [percentualFixo, setPercentualFixo] = useState<string>("");
  const [rendimentoRotina, setRendimentoRotina] = useState<string>("");
  const [tipoBalanca, setTipoBalanca] = useState<"individual" | "balancao">("individual");
  const [qtdBalancao, setQtdBalancao] = useState<2 | 3 | 4 | 5>(2);

  // Configuração por categoria para lote misto ("Aleatória")
  const [categoriasMistas, setCategoriasMistas] = useState<Record<string, CategoriaMistaCfg>>({});

  const isAleatoria = categoria === "aleatoria";
  const isRotina = modo === "rotina";
  const isBalancao = tipoBalanca === "balancao";

  useEffect(() => {
    (async () => {
      if (!clienteId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("clientes_pesador")
        .select("id, nome, nome_fazenda, cidade")
        .eq("id", clienteId)
        .maybeSingle();
      if (error) {
        toast({ title: "Erro ao carregar cliente", description: error.message, variant: "destructive" });
      } else {
        setCliente(data as Cliente | null);
      }
      setLoading(false);
    })();
  }, [clienteId]);

  function toggleCategoriaMista(value: string) {
    setCategoriasMistas((prev) => {
      const next = { ...prev };
      if (next[value]) delete next[value];
      else next[value] = { tipo_preco: "", preco_valor: "" };
      return next;
    });
  }

  function setMistaTipo(value: string, tipo: TipoPreco) {
    setCategoriasMistas((prev) => ({
      ...prev,
      [value]: { ...(prev[value] ?? { tipo_preco: "", preco_valor: "" }), tipo_preco: tipo },
    }));
  }

  function setMistaPreco(value: string, preco: string) {
    setCategoriasMistas((prev) => ({
      ...prev,
      [value]: { ...(prev[value] ?? { tipo_preco: "", preco_valor: "" }), preco_valor: preco },
    }));
  }

  const canSubmit = useMemo(() => {
    if (!categoria) return false;
    // Balanção não é compatível com lote misto nem rendimento aleatório
    if (isBalancao && isAleatoria) return false;
    if (isRotina) {
      if (!rendimentoRotina.trim()) return false;
      const r = parseNum(rendimentoRotina);
      if (!Number.isFinite(r) || r <= 0 || r > 100) return false;
      return true;
    }
    if (isAleatoria) {
      const entries = Object.entries(categoriasMistas);
      if (entries.length === 0) return false;
      for (const [, cfg] of entries) {
        if (!cfg.tipo_preco) return false;
        const v = parseNum(cfg.preco_valor);
        if (!Number.isFinite(v) || v <= 0) return false;
      }
      return true;
    }
    if (!tipoPreco || !precoValor) return false;
    const preco = parseNum(precoValor);
    if (!Number.isFinite(preco) || preco <= 0) return false;
    if (tipoPreco === "arroba") {
      if (!modoPercentual) return false;
      if (isBalancao && modoPercentual === "aleatorio") return false;
      if (modoPercentual === "fixo") {
        const pct = parseNum(percentualFixo);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return false;
      }
    }
    return true;
  }, [isRotina, rendimentoRotina, isAleatoria, categoria, tipoPreco, precoValor, modoPercentual, percentualFixo, categoriasMistas, isBalancao]);

  async function handleIniciar() {
    if (!pesadorId || !clienteId || !canSubmit) return;
    setSaving(true);

    let payload: any;
    if (isRotina) {
      const rend = parseNum(rendimentoRotina);
      payload = {
        pesador_id: pesadorId,
        cliente_id: clienteId,
        categoria,
        tipo_preco: null,
        preco_valor: null,
        modo_percentual: null,
        percentual_fixo: rend,
        preco_arroba: null,
        preco_kg: null,
        preco_fixo_animal: null,
        sem_valores: true,
        status: "em_andamento",
      };
    } else if (isAleatoria) {
      payload = {
        pesador_id: pesadorId,
        cliente_id: clienteId,
        categoria: "aleatoria",
        tipo_preco: "misto",
        preco_valor: null,
        modo_percentual: null,
        percentual_fixo: null,
        preco_arroba: null,
        preco_kg: null,
        preco_fixo_animal: null,
        sem_valores: false,
        status: "em_andamento",
      };
    } else {
      const preco = parseNum(precoValor);
      payload = {
        pesador_id: pesadorId,
        cliente_id: clienteId,
        categoria,
        tipo_preco: tipoPreco,
        preco_valor: preco,
        modo_percentual:
          tipoPreco === "arroba" ? (modoPercentual as ModoPercentual) : "fixo",
        percentual_fixo:
          tipoPreco === "arroba" && modoPercentual === "fixo"
            ? parseNum(percentualFixo)
            : null,
        sem_valores: false,
        status: "em_andamento",
      };
    }

    const { data, error } = await supabase
      .from("pesagens_compra")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast({ title: "Erro ao iniciar pesagem", description: error?.message, variant: "destructive" });
      return;
    }

    if (!isRotina && isAleatoria) {
      const rows = Object.entries(categoriasMistas).map(([cat, cfg]) => ({
        pesagem_id: data.id,
        categoria: cat,
        tipo_preco: cfg.tipo_preco,
        preco_valor: parseNum(cfg.preco_valor),
      }));
      const { error: catErr } = await supabase
        .from("pesagens_compra_categorias")
        .insert(rows);
      if (catErr) {
        setSaving(false);
        toast({ title: "Erro ao salvar categorias", description: catErr.message, variant: "destructive" });
        return;
      }
    }

    setSaving(false);
    navigate(`/pesador/pesagem/${data.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pesador/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Cliente não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <Button variant="ghost" size="sm" onClick={() => navigate("/pesador/clientes")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Produtor</div>
        <div className="text-lg font-semibold text-foreground">{cliente.nome}</div>
        <div className="text-xs text-muted-foreground">
          {[cliente.nome_fazenda, cliente.cidade].filter(Boolean).join(" • ") || "—"}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipo-pesagem">Tipo de pesagem</Label>
        <select
          id="tipo-pesagem"
          value={modo}
          onChange={(e) => setModo(e.target.value as ModoPesagem)}
          className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="comercial">Pesagem comercial</option>
          <option value="rotina">Pesagem de rotina (sem valores)</option>
        </select>
        {isRotina && (
          <p className="text-xs text-muted-foreground">
            Uso para conferência (ex.: antes do frigorífico). Nenhum valor será calculado.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <Chip key={c.value} active={categoria === c.value} onClick={() => setCategoria(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {isRotina ? (
        <div className="space-y-2">
          <Label htmlFor="rend-rotina">Rendimento estimado (%)</Label>
          <Input
            id="rend-rotina"
            inputMode="decimal"
            value={rendimentoRotina}
            onChange={(e) => setRendimentoRotina(e.target.value)}
            placeholder="Ex: 52"
          />
          <p className="text-xs text-muted-foreground">
            Obrigatório. Usado para estimar @ e Média de @ por animal no resumo. Valor informativo, sem finalidade comercial.
          </p>
        </div>
      ) : isAleatoria ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Selecione as categorias que aparecerão neste lote misto e configure a forma de pagamento de cada uma.
          </div>
          <div className="space-y-2">
            <Label>Categorias do lote</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_PURAS.map((c) => (
                <Chip
                  key={c.value}
                  active={!!categoriasMistas[c.value]}
                  onClick={() => toggleCategoriaMista(c.value)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>

          {CATEGORIAS_PURAS.filter((c) => categoriasMistas[c.value]).map((c) => {
            const cfg = categoriasMistas[c.value];
            const precoLabel =
              cfg.tipo_preco === "arroba"
                ? "Preço da @ (R$)"
                : cfg.tipo_preco === "kg"
                ? "Preço por kg (R$)"
                : cfg.tipo_preco === "fixo_animal"
                ? "Preço fixo por animal (R$)"
                : "Preço (R$)";
            return (
              <div key={c.value} className="rounded-lg border bg-card p-3 space-y-3">
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="flex flex-wrap gap-2">
                  <Chip active={cfg.tipo_preco === "arroba"} onClick={() => setMistaTipo(c.value, "arroba")}>
                    @ (arroba)
                  </Chip>
                  <Chip active={cfg.tipo_preco === "kg"} onClick={() => setMistaTipo(c.value, "kg")}>
                    kg
                  </Chip>
                  <Chip
                    active={cfg.tipo_preco === "fixo_animal"}
                    onClick={() => setMistaTipo(c.value, "fixo_animal")}
                  >
                    Fixo por animal
                  </Chip>
                </div>
                {cfg.tipo_preco && (
                  <div className="space-y-2">
                    <Label htmlFor={`preco-${c.value}`}>{precoLabel}</Label>
                    <Input
                      id={`preco-${c.value}`}
                      inputMode="decimal"
                      value={cfg.preco_valor}
                      onChange={(e) => setMistaPreco(c.value, e.target.value)}
                      placeholder="Ex: 320,00"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={tipoPreco === "arroba"} onClick={() => setTipoPreco("arroba")}>
                @ (arroba)
              </Chip>
              <Chip active={tipoPreco === "kg"} onClick={() => setTipoPreco("kg")}>
                kg
              </Chip>
              <Chip active={tipoPreco === "fixo_animal"} onClick={() => setTipoPreco("fixo_animal")}>
                Preço fixo por animal
              </Chip>
            </div>
          </div>

          {tipoPreco === "arroba" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="preco">Preço da @ (R$)</Label>
                <Input
                  id="preco"
                  inputMode="decimal"
                  value={precoValor}
                  onChange={(e) => setPrecoValor(e.target.value)}
                  placeholder="Ex: 320,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Rendimento</Label>
                <div className="flex flex-wrap gap-2">
                  <Chip active={modoPercentual === "fixo"} onClick={() => setModoPercentual("fixo")}>
                    Rendimento: Fixo
                  </Chip>
                  <Chip
                    active={modoPercentual === "aleatorio"}
                    onClick={() => setModoPercentual("aleatorio")}
                  >
                    Rendimento: Aleatório
                  </Chip>
                </div>
              </div>

              {modoPercentual === "fixo" && (
                <div className="space-y-2">
                  <Label htmlFor="pct">Percentual (%)</Label>
                  <Input
                    id="pct"
                    inputMode="decimal"
                    value={percentualFixo}
                    onChange={(e) => setPercentualFixo(e.target.value)}
                    placeholder="Ex: 52"
                  />
                </div>
              )}
            </>
          )}

          {tipoPreco === "kg" && (
            <div className="space-y-2">
              <Label htmlFor="preco">Preço por kg (R$)</Label>
              <Input
                id="preco"
                inputMode="decimal"
                value={precoValor}
                onChange={(e) => setPrecoValor(e.target.value)}
                placeholder="Ex: 10,50"
              />
            </div>
          )}

          {tipoPreco === "fixo_animal" && (
            <div className="space-y-2">
              <Label htmlFor="preco">Preço fixo (R$)</Label>
              <Input
                id="preco"
                inputMode="decimal"
                value={precoValor}
                onChange={(e) => setPrecoValor(e.target.value)}
                placeholder="Ex: 3000,00"
              />
            </div>
          )}
        </>
      )}

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t">
        <Button
          className="w-full h-12"
          disabled={!canSubmit || saving}
          onClick={handleIniciar}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Scale className="w-5 h-5 mr-2" />
              Iniciar Pesagem
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
