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

type TipoPreco = "arroba" | "kg" | "fixo_animal";
type ModoPercentual = "fixo" | "aleatorio";

type Cliente = {
  id: string;
  nome: string;
  nome_fazenda: string | null;
  cidade: string | null;
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

  const [categoria, setCategoria] = useState<string>("");
  const [tipoPreco, setTipoPreco] = useState<TipoPreco | "">("");
  const [precoValor, setPrecoValor] = useState<string>("");
  const [modoPercentual, setModoPercentual] = useState<ModoPercentual | "">("");
  const [percentualFixo, setPercentualFixo] = useState<string>("");

  // Campos independentes para lote "Aleatória" (misto)
  const [precoArroba, setPrecoArroba] = useState<string>("");
  const [precoKg, setPrecoKg] = useState<string>("");
  const [precoFixoAnimal, setPrecoFixoAnimal] = useState<string>("");

  const isAleatoria = categoria === "aleatoria";

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

  const canSubmit = useMemo(() => {
    if (!categoria) return false;
    if (isAleatoria) {
      // Ao menos um dos três preços preenchido e > 0
      const arr = parseNum(precoArroba);
      const kg = parseNum(precoKg);
      const fx = parseNum(precoFixoAnimal);
      const anyValid =
        (Number.isFinite(arr) && arr > 0) ||
        (Number.isFinite(kg) && kg > 0) ||
        (Number.isFinite(fx) && fx > 0);
      return anyValid;
    }
    if (!tipoPreco || !precoValor) return false;
    const preco = parseNum(precoValor);
    if (!Number.isFinite(preco) || preco <= 0) return false;
    if (tipoPreco === "arroba") {
      if (!modoPercentual) return false;
      if (modoPercentual === "fixo") {
        const pct = parseNum(percentualFixo);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return false;
      }
    }
    return true;
  }, [isAleatoria, categoria, tipoPreco, precoValor, modoPercentual, percentualFixo, precoArroba, precoKg, precoFixoAnimal]);

  async function handleIniciar() {
    if (!pesadorId || !clienteId || !canSubmit) return;
    setSaving(true);

    let payload: any;
    if (isAleatoria) {
      const arr = parseNum(precoArroba);
      const kg = parseNum(precoKg);
      const fx = parseNum(precoFixoAnimal);
      payload = {
        pesador_id: pesadorId,
        cliente_id: clienteId,
        categoria: "aleatoria",
        tipo_preco: "misto",
        preco_valor: null,
        modo_percentual: null,
        percentual_fixo: null,
        preco_arroba: Number.isFinite(arr) && arr > 0 ? arr : null,
        preco_kg: Number.isFinite(kg) && kg > 0 ? kg : null,
        preco_fixo_animal: Number.isFinite(fx) && fx > 0 ? fx : null,
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
        status: "em_andamento",
      };
    }

    const { data, error } = await supabase
      .from("pesagens_compra")
      .insert(payload)
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast({ title: "Erro ao iniciar pesagem", description: error?.message, variant: "destructive" });
      return;
    }
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
        <Label>Categoria</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <Chip key={c.value} active={categoria === c.value} onClick={() => setCategoria(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {isAleatoria ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Lote misto — preencha ao menos um preço. A forma de pagamento será escolhida animal por animal na pesagem.
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa">Preço da @ (R$)</Label>
            <Input
              id="pa"
              inputMode="decimal"
              value={precoArroba}
              onChange={(e) => setPrecoArroba(e.target.value)}
              placeholder="Opcional • Ex: 320,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pk">Preço por kg (R$)</Label>
            <Input
              id="pk"
              inputMode="decimal"
              value={precoKg}
              onChange={(e) => setPrecoKg(e.target.value)}
              placeholder="Opcional • Ex: 10,50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf">Preço fixo por animal (R$)</Label>
            <Input
              id="pf"
              inputMode="decimal"
              value={precoFixoAnimal}
              onChange={(e) => setPrecoFixoAnimal(e.target.value)}
              placeholder="Opcional • Ex: 3000,00"
            />
          </div>
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
