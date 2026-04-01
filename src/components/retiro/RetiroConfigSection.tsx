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
      const [retRes, prodRes] = await Promise.all([
        supabase.from("retiros").select("*").eq("id", retiroId).single(),
        supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
      ]);
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
    setConfig((prev) => ({
      ...prev,
      produto_id: produtoId || null,
      peso_saco_kg: prod?.peso_saco_kg ?? prev.peso_saco_kg,
      preco_por_kg: prod?.preco_por_kg ?? prev.preco_por_kg,
    }));
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

      {/* Produto e Consumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Produto e Consumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              {config.produto_id && (() => {
                const prod = produtos.find((p) => p.id === config.produto_id);
                return prod ? (
                  <p className="text-xs text-muted-foreground mt-1">Peso do saco: <strong>{prod.peso_saco_kg} kg</strong></p>
                ) : null;
              })()}
            </div>
            <div className="space-y-2">
              <Label>Preço do kg (R$)</Label>
              <Input type="number" step="0.01" value={config.preco_por_kg ?? ""} onChange={(e) => update("preco_por_kg", numOrNull(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Consumo por categoria (kg/100kg PV)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Recria 1 (0–220kg)</Label>
                <Input type="number" step="0.01" placeholder="Consumo" value={config.consumo_recria1 ?? ""} onChange={(e) => update("consumo_recria1", numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recria 2</Label>
                <Input type="number" step="0.01" placeholder="Consumo" value={config.consumo_recria2 ?? ""} onChange={(e) => update("consumo_recria2", numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Engorda</Label>
                <Input type="number" step="0.01" placeholder="Consumo" value={config.consumo_engorda ?? ""} onChange={(e) => update("consumo_engorda", numOrNull(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Margem (±)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Recria 1</Label>
                <Input type="number" step="0.01" placeholder="±" value={config.margem_recria1 ?? ""} onChange={(e) => update("margem_recria1", numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recria 2</Label>
                <Input type="number" step="0.01" placeholder="±" value={config.margem_recria2 ?? ""} onChange={(e) => update("margem_recria2", numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Engorda</Label>
                <Input type="number" step="0.01" placeholder="±" value={config.margem_engorda ?? ""} onChange={(e) => update("margem_engorda", numOrNull(e.target.value))} />
              </div>
            </div>
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
