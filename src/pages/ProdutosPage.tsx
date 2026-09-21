import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import FazendasMultiSelect from "@/components/produtos/FazendasMultiSelect";
import { fetchVinculosPorProduto, salvarVinculosProduto } from "@/lib/produtosFazenda";

const PESO_SACO_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55];
const TIPO_OPTIONS = ["Sal Mineral", "Proteico Energético", "Ração", "Suplemento", "Outro"];

interface Produto {
  id: string;
  nome: string;
  marca: string | null;
  tipo: string | null;
  peso_saco_kg: number;
  preco_por_kg: number | null;
  ativo: boolean | null;
  administrador_id: string | null;
}

interface ProdutoForm {
  marca: string;
  nome: string;
  tipo: string;
  peso_saco_kg: number;
  preco_por_kg: string;
  consumo_por_100kg: string;
  consumo_recria1: string;
  consumo_recria2: string;
  consumo_engorda: string;
  margem_mais_recria1_pct: string;
  margem_menos_recria1_pct: string;
  margem_mais_recria2_pct: string;
  margem_menos_recria2_pct: string;
  margem_mais_engorda_pct: string;
  margem_menos_engorda_pct: string;
}

const emptyForm: ProdutoForm = {
  marca: "", nome: "", tipo: "", peso_saco_kg: 25, preco_por_kg: "",
  consumo_por_100kg: "",
  consumo_recria1: "", consumo_recria2: "", consumo_engorda: "",
  margem_mais_recria1_pct: "", margem_menos_recria1_pct: "",
  margem_mais_recria2_pct: "", margem_menos_recria2_pct: "",
  margem_mais_engorda_pct: "", margem_menos_engorda_pct: "",
};

interface ProdutosPageProps {
  /** "gerente" restringe as fazendas vinculáveis às fazendas do gerente logado. */
  modo?: "admin" | "gerente";
}

export default function ProdutosPage({ modo = "admin" }: ProdutosPageProps) {
  const { roleData, user } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProdutoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fazendasOpcoes, setFazendasOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({});
  const [fazendasSelecionadas, setFazendasSelecionadas] = useState<string[]>([]);

  const fazendasPermitidasIds = fazendasOpcoes.map((f) => f.id);

  async function loadFazendas() {
    if (modo === "gerente") {
      if (!user) return;
      const { data } = await supabase
        .from("gerentes")
        .select("fazenda_id, fazendas(nome)")
        .eq("user_id", user.id)
        .eq("ativo", true);
      const list = ((data ?? []) as any[])
        .filter((g) => g.fazenda_id)
        .map((g) => ({ id: g.fazenda_id as string, nome: g.fazendas?.nome ?? "Fazenda" }));
      setFazendasOpcoes(list);
    } else {
      const { data } = await supabase
        .from("fazendas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setFazendasOpcoes((data ?? []) as { id: string; nome: string }[]);
    }
  }

  async function loadProdutos(permitidas?: string[]) {
    const vinc = await fetchVinculosPorProduto();
    setVinculos(vinc);
    const { data } = await supabase
      .from("produtos")
      .select("*")
      .order("nome") as { data: Produto[] | null };
    let list = data ?? [];
    if (modo === "gerente") {
      const ids = permitidas ?? fazendasPermitidasIds;
      list = list.filter((p) => (vinc[p.id] ?? []).some((f) => ids.includes(f)));
    }
    setProdutos(list);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await loadFazendas();
    })();
  }, [modo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadProdutos(fazendasPermitidasIds);
  }, [fazendasOpcoes]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFazendasSelecionadas(
      modo === "gerente" && fazendasOpcoes.length === 1 ? [fazendasOpcoes[0].id] : [],
    );
    setDialogOpen(true);
  }

  function openEdit(p: Produto) {
    setEditingId(p.id);
    setFazendasSelecionadas(vinculos[p.id] ?? []);
    const a = p as any;
    setForm({
      marca: a.marca ?? "",
      nome: p.nome,
      tipo: a.tipo ?? "",
      peso_saco_kg: p.peso_saco_kg,
      preco_por_kg: p.preco_por_kg?.toString() ?? "",
      consumo_por_100kg: a.consumo_por_100kg?.toString() ?? "",
      consumo_recria1: a.consumo_recria1?.toString() ?? "",
      consumo_recria2: a.consumo_recria2?.toString() ?? "",
      consumo_engorda: a.consumo_engorda?.toString() ?? "",
      margem_mais_recria1_pct: a.margem_mais_recria1_pct?.toString() ?? "",
      margem_menos_recria1_pct: a.margem_menos_recria1_pct?.toString() ?? "",
      margem_mais_recria2_pct: a.margem_mais_recria2_pct?.toString() ?? "",
      margem_menos_recria2_pct: a.margem_menos_recria2_pct?.toString() ?? "",
      margem_mais_engorda_pct: a.margem_mais_engorda_pct?.toString() ?? "",
      margem_menos_engorda_pct: a.margem_menos_engorda_pct?.toString() ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome do produto é obrigatório."); return; }
    if (!form.marca.trim()) { toast.error("Marca é obrigatória."); return; }
    if (!form.tipo) { toast.error("Tipo é obrigatório."); return; }
    if (!form.preco_por_kg) { toast.error("Custo por kg é obrigatório."); return; }
    if (!form.consumo_por_100kg) { toast.error("Consumo por 100kg PV é obrigatório."); return; }

    setSaving(true);
    const numOrNull = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const consumo_recria1 = numOrNull(form.consumo_recria1);
    const consumo_recria2 = numOrNull(form.consumo_recria2);
    const consumo_engorda = numOrNull(form.consumo_engorda);
    const margem_mais_recria1_pct = numOrNull(form.margem_mais_recria1_pct);
    const margem_menos_recria1_pct = numOrNull(form.margem_menos_recria1_pct);
    const margem_mais_recria2_pct = numOrNull(form.margem_mais_recria2_pct);
    const margem_menos_recria2_pct = numOrNull(form.margem_menos_recria2_pct);
    const margem_mais_engorda_pct = numOrNull(form.margem_mais_engorda_pct);
    const margem_menos_engorda_pct = numOrNull(form.margem_menos_engorda_pct);
    // Compatibilidade temporária: margem_<categoria> (absoluta) = consumo × média das margens %
    const margemAbs = (consumo: number | null, mais: number | null, menos: number | null): number | null => {
      if (consumo == null || mais == null || menos == null) return null;
      return consumo * (((mais + menos) / 2) / 100);
    };
    const payload: any = {
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      tipo: form.tipo,
      peso_saco_kg: form.peso_saco_kg,
      preco_por_kg: parseFloat(form.preco_por_kg) || null,
      consumo_por_100kg: numOrNull(form.consumo_por_100kg),
      consumo_recria1,
      consumo_recria2,
      consumo_engorda,
      margem_mais_recria1_pct,
      margem_menos_recria1_pct,
      margem_mais_recria2_pct,
      margem_menos_recria2_pct,
      margem_mais_engorda_pct,
      margem_menos_engorda_pct,
      margem_recria1: margemAbs(consumo_recria1, margem_mais_recria1_pct, margem_menos_recria1_pct),
      margem_recria2: margemAbs(consumo_recria2, margem_mais_recria2_pct, margem_menos_recria2_pct),
      margem_engorda: margemAbs(consumo_engorda, margem_mais_engorda_pct, margem_menos_engorda_pct),
    };

    try {
      const escopo = modo === "gerente" ? fazendasPermitidasIds : undefined;
      let produtoId = editingId;
      if (editingId) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        if (modo === "admin") payload.administrador_id = roleData?.roleId ?? null;
        const { data, error } = await supabase.from("produtos").insert(payload).select("id").single();
        if (error) throw error;
        produtoId = (data as any)?.id ?? null;
        toast.success("Produto cadastrado!");
      }
      if (produtoId) {
        await salvarVinculosProduto(produtoId, fazendasSelecionadas, escopo);
      }
      setDialogOpen(false);
      loadProdutos(fazendasPermitidasIds);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir produto."); return; }
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    toast.success("Produto excluído.");
  }

  function getMargemUnico(mais: string, menos: string): string {
    return mais || menos;
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5" /> Produtos
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Cadastrar Produto
        </Button>
      </div>

      {produtos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum produto cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Peso Saco</TableHead>
                  <TableHead>Custo/kg</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{(p as any).marca || "—"}</TableCell>
                    <TableCell>{p.nome}</TableCell>
                    <TableCell>
                      {(p as any).tipo ? (
                        <Badge variant="outline" className="text-xs">{(p as any).tipo}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{p.peso_saco_kg} kg</TableCell>
                    <TableCell>{p.preco_por_kg ? `R$ ${Number(p.preco_por_kg).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby="produto-dialog-desc">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} className="gap-1 px-2">
                ← Voltar
              </Button>
            </div>
            <DialogTitle>{editingId ? "Editar Produto" : "Cadastrar Produto"}</DialogTitle>
            <DialogDescription id="produto-dialog-desc">
              Preencha os dados do produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Marca *</Label>
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Ex: Vaccinar, Tortuga, Minerax" />
            </div>
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Tecnocorte Águas HD" />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peso do Saco (kg) *</Label>
              <div className="flex flex-wrap gap-2">
                {PESO_SACO_OPTIONS.map((peso) => (
                  <button
                    key={peso}
                    type="button"
                    onClick={() => setForm({ ...form, peso_saco_kg: peso })}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      form.peso_saco_kg === peso
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent"
                    }`}
                  >
                    {peso} kg
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Custo por kg (R$) *</Label>
              <Input type="number" step="0.01" value={form.preco_por_kg} onChange={(e) => setForm({ ...form, preco_por_kg: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Consumo por 100kg PV (g/cab/dia) *</Label>
              <Input type="number" step="0.01" value={form.consumo_por_100kg} onChange={(e) => setForm({ ...form, consumo_por_100kg: e.target.value })} placeholder="Ex: 100" />
              <p className="text-xs text-muted-foreground">Parâmetro nutricional obrigatório para cálculos do sistema</p>
            </div>

            {/* Consumo por Categoria */}
            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs text-muted-foreground font-semibold">Consumo por Categoria (kg/100kg PV)</Label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Recria 1</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Consumo (kg/100kg PV)</Label>
                      <Input type="number" step="0.01" placeholder="Consumo" value={form.consumo_recria1} onChange={(e) => setForm({ ...form, consumo_recria1: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Margem (%)</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" placeholder="Margem" className="pr-6" value={getMargemUnico(form.margem_mais_recria1_pct, form.margem_menos_recria1_pct)} onChange={(e) => setForm({ ...form, margem_mais_recria1_pct: e.target.value, margem_menos_recria1_pct: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Recria 2</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Consumo (kg/100kg PV)</Label>
                      <Input type="number" step="0.01" placeholder="Consumo" value={form.consumo_recria2} onChange={(e) => setForm({ ...form, consumo_recria2: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Margem (%)</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" placeholder="Margem" className="pr-6" value={getMargemUnico(form.margem_mais_recria2_pct, form.margem_menos_recria2_pct)} onChange={(e) => setForm({ ...form, margem_mais_recria2_pct: e.target.value, margem_menos_recria2_pct: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Engorda</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Consumo (kg/100kg PV)</Label>
                      <Input type="number" step="0.01" placeholder="Consumo" value={form.consumo_engorda} onChange={(e) => setForm({ ...form, consumo_engorda: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Margem (%)</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" placeholder="Margem" className="pr-6" value={getMargemUnico(form.margem_mais_engorda_pct, form.margem_menos_engorda_pct)} onChange={(e) => setForm({ ...form, margem_mais_engorda_pct: e.target.value, margem_menos_engorda_pct: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
