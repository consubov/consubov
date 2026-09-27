import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";
import { camposProdutoParaRetiro, type ProdutoParaRetiro } from "@/lib/retiroProduto";

interface Produto extends ProdutoParaRetiro {
  nome: string;
  marca: string | null;
}

interface Props {
  retiroId: string;
  retiroNome: string;
  fazendaId: string;
}

/**
 * Troca do produto ativo do retiro pelo Gerente.
 * Mesma regra do Admin (opção A): ao trocar, copia peso do saco, preço,
 * consumo e margens do novo produto. Opção de aplicar a todos os retiros
 * da fazenda.
 */
export default function GerenteProdutoRetiroCard({ retiroId, retiroNome, fazendaId }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [aplicarTodos, setAplicarTodos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [retRes, produtoIds] = await Promise.all([
        supabase.from("retiros").select("produto_id, peso_saco_kg, preco_por_kg, consumo_recria1, consumo_recria2, consumo_engorda, margem_recria1, margem_recria2, margem_engorda").eq("id", retiroId).single(),
        fetchProdutoIdsDaFazenda(fazendaId),
      ]);
      let prodQuery = supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (produtoIds) prodQuery = prodQuery.in("id", produtoIds);
      const prodRes = await prodQuery;
      setProdutos((prodRes.data ?? []) as Produto[]);
      setProdutoId((retRes.data as any)?.produto_id ?? "");
      setLoading(false);
    }
    load();
  }, [retiroId, fazendaId]);

  async function handleSave() {
    if (!produtoId) {
      toast.error("Selecione um produto.");
      return;
    }
    setSaving(true);
    try {
      const prod = produtos.find((p) => p.id === produtoId);
      // Sem valor anterior confiável neste fluxo: usa os campos do produto,
      // mantendo null onde o produto não tem o campo (mesmo resultado da
      // opção A quando o retiro ainda não tinha valores próprios).
      const campos = camposProdutoParaRetiro(prod, produtoId, {
        peso_saco_kg: null,
        preco_por_kg: null,
        consumo_recria1: null,
        consumo_recria2: null,
        consumo_engorda: null,
        margem_recria1: null,
        margem_recria2: null,
        margem_engorda: null,
      });

      let query = supabase.from("retiros").update(campos as any);
      if (aplicarTodos) {
        query = query.eq("fazenda_id", fazendaId);
      } else {
        query = query.eq("id", retiroId);
      }
      const { error } = await query;
      if (error) throw error;
      toast.success(aplicarTodos
        ? `Produto aplicado a todos os retiros da fazenda.`
        : `Produto do retiro ${retiroNome} atualizado!`);
    } catch (err: any) {
      console.error("Erro ao trocar produto do retiro:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Produto Ativo do Retiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Produto</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.marca ? `${p.marca} — ${p.nome}` : p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {produtos.length === 0 && (
            <p className="text-xs text-amber-700">{MSG_FAZENDA_SEM_PRODUTO}</p>
          )}
          {produtoId && (() => {
            const prod = produtos.find((p) => p.id === produtoId);
            return prod ? (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                <p>Peso do saco: <strong>{prod.peso_saco_kg} kg</strong> · Custo: <strong>R$ {Number(prod.preco_por_kg ?? 0).toFixed(2)}/kg</strong></p>
                {prod.consumo_recria1 != null && <p>Consumo R1: {prod.consumo_recria1} (±{prod.margem_recria1 ?? 0}) · R2: {prod.consumo_recria2 ?? "—"} (±{prod.margem_recria2 ?? 0}) · Eng: {prod.consumo_engorda ?? "—"} (±{prod.margem_engorda ?? 0})</p>}
              </div>
            ) : null;
          })()}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="aplicar-todos-retiros"
            checked={aplicarTodos}
            onCheckedChange={(checked) => setAplicarTodos(checked === true)}
          />
          <Label htmlFor="aplicar-todos-retiros" className="text-sm font-normal cursor-pointer">
            Aplicar a todos os retiros da fazenda
          </Label>
        </div>

        <Button onClick={handleSave} disabled={saving || !produtoId} className="w-full" size="sm">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Salvar Produto
        </Button>
      </CardContent>
    </Card>
  );
}
