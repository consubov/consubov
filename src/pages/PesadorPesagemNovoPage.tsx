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

const CATEGORIAS = [
  "Boi Gordo",
  "Vaca Gorda",
  "Vaca Magra",
  "Boi Magro",
  "Garrote",
  "Novilha",
  "Bezerro",
  "Bezerra",
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
    if (!categoria || !tipoPreco || !precoValor) return false;
    const preco = parseFloat(precoValor.replace(",", "."));
    if (!Number.isFinite(preco) || preco <= 0) return false;
    if (tipoPreco === "arroba") {
      if (!modoPercentual) return false;
      if (modoPercentual === "fixo") {
        const pct = parseFloat(percentualFixo.replace(",", "."));
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return false;
      }
    }
    return true;
  }, [categoria, tipoPreco, precoValor, modoPercentual, percentualFixo]);

  async function handleIniciar() {
    if (!pesadorId || !clienteId || !canSubmit) return;
    setSaving(true);
    const preco = parseFloat(precoValor.replace(",", "."));
    const payload: any = {
      pesador_id: pesadorId,
      cliente_id: clienteId,
      categoria,
      tipo_preco: tipoPreco,
      preco_valor: preco,
      modo_percentual:
        tipoPreco === "arroba" ? (modoPercentual as ModoPercentual) : "na",
      percentual_fixo:
        tipoPreco === "arroba" && modoPercentual === "fixo"
          ? parseFloat(percentualFixo.replace(",", "."))
          : null,
      status: "em_andamento",
    };
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
            <Chip key={c} active={categoria === c} onClick={() => setCategoria(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

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
