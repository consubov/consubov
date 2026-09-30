import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings, Package, BarChart3, Target, Weight } from "lucide-react";
import { toast } from "sonner";
import { fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";
import { camposProdutoParaRetiro } from "@/lib/retiroProduto";

interface Produto {
  id: string;
  nome: string;
  marca: string | null;
  tipo: string | null;
  peso_saco_kg: number;
  preco_por_kg: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
}

interface RetiroConfig {
  peso_saco_kg: number | null;
  produto_id: string | null;
  preco_por_kg: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
  estoque_sacos: number | null;
  gmd_recria1: number | null;
  gmd_recria2: number | null;
  gmd_engorda: number | null;
  peso_abate_kg: number | null;
  sexo_padrao: string | null;
}



interface Props {
  retiroId: string;
}

export default function RetiroConfigSection({ retiroId }: Props) {
  const [config, setConfig] = useState<RetiroConfig>({
    peso_saco_kg: 25, produto_id: null, preco_por_kg: null,
    consumo_recria1: null, consumo_recria2: null, consumo_engorda: null,
    margem_recria1: null, margem_recria2: null, margem_engorda: null,
    estoque_sacos: 0, gmd_recria1: null, gmd_recria2: null, gmd_engorda: null,
    peso_abate_kg: 500, sexo_padrao: "Macho",
  });
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const retRes = await supabase.from("retiros").select("*").eq("id", retiroId).single();
      const produtoIds = await fetchProdutoIdsDaFazenda((retRes.data as any)?.fazenda_id ?? null);
      let prodQuery = supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (produtoIds) prodQuery = prodQuery.in("id", produtoIds);
      const prodRes = await prodQuery;
      if (retRes.data) {
        const r = retRes.data as any;
        setConfig({
          peso_saco_kg: r.peso_saco_kg ?? 25,
          produto_id: r.produto_id ?? null,
          preco_por_kg: r.preco_por_kg ?? null,
          consumo_recria1: r.consumo_recria1 ?? null,
          consumo_recria2: r.consumo_recria2 ?? null,
          consumo_engorda: r.consumo_engorda ?? null,
          margem_recria1: r.margem_recria1 ?? null,
          margem_recria2: r.margem_recria2 ?? null,
          margem_engorda: r.margem_engorda ?? null,
          estoque_sacos: r.estoque_sacos ?? 0,
          gmd_recria1: r.gmd_recria1 ?? null,
          gmd_recria2: r.gmd_recria2 ?? null,
          gmd_engorda: r.gmd_engorda ?? null,
          peso_abate_kg: r.peso_abate_kg ?? 500,
          sexo_padrao: r.sexo_padrao ?? "Macho",
        });
      }
      setProdutos(prodRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [retiroId]);

  function update(field: keyof RetiroConfig, value: any) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function handleProductChange(produtoId: string) {
    const prod = produtos.find((p) => p.id === produtoId);
    setConfig((prev) => ({ ...prev, ...camposProdutoParaRetiro(prod, produtoId, prev) }));
  }

  function numOrNull(val: string): number | null {
    if (!val) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("retiros").update({
        peso_saco_kg: config.peso_saco_kg,
        produto_id: config.produto_id,
        preco_por_kg: config.preco_por_kg,
        consumo_recria1: config.consumo_recria1,
        consumo_recria2: config.consumo_recria2,
        consumo_engorda: config.consumo_engorda,
        margem_recria1: config.margem_recria1,
        margem_recria2: config.margem_recria2,
        margem_engorda: config.margem_engorda,
        estoque_sacos: config.estoque_sacos,
        gmd_recria1: config.gmd_recria1,
        gmd_recria2: config.gmd_recria2,
        gmd_engorda: config.gmd_engorda,
        peso_abate_kg: config.peso_abate_kg,
        sexo_padrao: config.sexo_padrao,
      } as any).eq("id", retiroId);
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      console.error("Erro ao salvar config:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Settings className="w-5 h-5" /> Configurações do Retiro
      </h2>

      {/* Produto do Retiro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Produto Ativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={config.produto_id ?? ""} onValueChange={handleProductChange}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.marca ? `${p.marca} — ${p.nome}` : p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && produtos.length === 0 && (
              <p className="text-xs text-amber-700">{MSG_FAZENDA_SEM_PRODUTO}</p>
            )}
            {config.produto_id && (() => {
              const prod = produtos.find((p) => p.id === config.produto_id);
              return prod ? (
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <p>Peso do saco: <strong>{prod.peso_saco_kg} kg</strong> · Custo: <strong>R$ {Number(prod.preco_por_kg ?? 0).toFixed(2)}/kg</strong></p>
                  {prod.consumo_recria1 != null && <p>Consumo R1: {prod.consumo_recria1} (±{prod.margem_recria1 ?? 0}) · R2: {prod.consumo_recria2 ?? "—"} (±{prod.margem_recria2 ?? 0}) · Eng: {prod.consumo_engorda ?? "—"} (±{prod.margem_engorda ?? 0})</p>}
                </div>
              ) : null;
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Estoque */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Sacos recebidos no mês</Label>
            <Input type="number" value={config.estoque_sacos ?? 0} onChange={(e) => update("estoque_sacos", parseInt(e.target.value) || 0)} />
            <p className="text-sm font-medium text-muted-foreground">Estoque atual: <span className="text-foreground">{config.estoque_sacos ?? 0} sacos</span></p>
          </div>
        </CardContent>
      </Card>

      {/* GMD por Categoria */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> GMD por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">GMD Recria 1 (kg/dia)</Label>
              <Input type="number" step="0.001" value={config.gmd_recria1 ?? ""} onChange={(e) => update("gmd_recria1", numOrNull(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GMD Recria 2 (kg/dia)</Label>
              <Input type="number" step="0.001" value={config.gmd_recria2 ?? ""} onChange={(e) => update("gmd_recria2", numOrNull(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GMD Engorda (kg/dia)</Label>
              <Input type="number" step="0.001" value={config.gmd_engorda ?? ""} onChange={(e) => update("gmd_engorda", numOrNull(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peso de Abate + Sexo Padrão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Peso de Abate e Sexo Padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Peso alvo de abate (kg)</Label>
            <Input type="number" value={config.peso_abate_kg ?? ""} onChange={(e) => update("peso_abate_kg", numOrNull(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Sexo padrão</Label>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${config.sexo_padrao === "Macho" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>Macho</span>
              <Switch
                checked={config.sexo_padrao === "Fêmea"}
                onCheckedChange={(checked) => update("sexo_padrao", checked ? "Fêmea" : "Macho")}
              />
              <span className={`text-sm ${config.sexo_padrao === "Fêmea" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>Fêmea</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Weight className="w-4 h-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
}
