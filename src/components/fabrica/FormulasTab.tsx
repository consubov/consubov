import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, FlaskConical, X } from "lucide-react";
import { toast } from "sonner";

interface MateriaPrima { id: string; nome: string; unidade: string; }
interface Formula {
  id: string; nome: string; peso_batida: number | null;
  peso_por_saco: number | null; producao_esperada: number | null; ativo: boolean | null;
}
interface Ingrediente {
  id?: string; materia_prima_id: string; quantidade: string;
}

export default function FormulasTab({ fabricaId }: { fabricaId: string }) {
  const [items, setItems] = useState<Formula[]>([]);
  const [materias, setMaterias] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: "", peso_batida: "", peso_por_saco: "", producao_esperada: "", ativo: true,
  });
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);

  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const [fm, mp] = await Promise.all([
      supabase.from("formulas_fabrica").select("*").eq("fabrica_id", fabricaId).order("nome"),
      supabase.from("materias_primas").select("id, nome, unidade").eq("fabrica_id", fabricaId).eq("ativo", true).order("nome"),
    ]);
    setItems((fm.data as Formula[]) || []);
    setMaterias((mp.data as MateriaPrima[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({ nome: "", peso_batida: "", peso_por_saco: "", producao_esperada: "", ativo: true });
    setIngredientes([]);
    setDialogOpen(true);
  }

  async function openEdit(f: Formula) {
    setEditingId(f.id);
    setForm({
      nome: f.nome,
      peso_batida: f.peso_batida?.toString() ?? "",
      peso_por_saco: f.peso_por_saco?.toString() ?? "",
      producao_esperada: f.producao_esperada?.toString() ?? "",
      ativo: f.ativo ?? true,
    });
    const { data } = await supabase.from("formula_ingredientes").select("*").eq("formula_id", f.id);
    setIngredientes(((data as any[]) || []).map(i => ({
      id: i.id, materia_prima_id: i.materia_prima_id, quantidade: i.quantidade?.toString() ?? "",
    })));
    setDialogOpen(true);
  }

  function addIngrediente() {
    setIngredientes(xs => [...xs, { materia_prima_id: "", quantidade: "" }]);
  }
  function updateIng(idx: number, patch: Partial<Ingrediente>) {
    setIngredientes(xs => xs.map((x, i) => i === idx ? { ...x, ...patch } : x));
  }
  function removeIng(idx: number) {
    setIngredientes(xs => xs.filter((_, i) => i !== idx));
  }

  const totalIng = ingredientes.reduce((s, i) => s + (parseFloat(i.quantidade) || 0), 0);
  const pesoBatida = parseFloat(form.peso_batida) || 0;
  const diff = pesoBatida > 0 ? ((totalIng - pesoBatida) / pesoBatida) * 100 : 0;

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    const validIngs = ingredientes.filter(i => i.materia_prima_id && parseFloat(i.quantidade) > 0);
    if (validIngs.length === 0) return toast.error("Adicione pelo menos um ingrediente");

    setSaving(true);
    try {
      const payload = {
        fabrica_id: fabricaId,
        nome: form.nome.trim(),
        peso_batida: parseFloat(form.peso_batida) || null,
        peso_por_saco: parseFloat(form.peso_por_saco) || null,
        producao_esperada: parseFloat(form.producao_esperada) || null,
        ativo: form.ativo,
      };

      let formulaId = editingId;
      if (editingId) {
        const { error } = await supabase.from("formulas_fabrica").update(payload).eq("id", editingId);
        if (error) throw error;
        // Replace ingredients
        await supabase.from("formula_ingredientes").delete().eq("formula_id", editingId);
      } else {
        const { data, error } = await supabase.from("formulas_fabrica").insert(payload).select("id").single();
        if (error) throw error;
        formulaId = data.id;
      }

      const rows = validIngs.map(i => ({
        formula_id: formulaId!,
        materia_prima_id: i.materia_prima_id,
        quantidade: parseFloat(i.quantidade),
      }));
      const { error: ingErr } = await supabase.from("formula_ingredientes").insert(rows);
      if (ingErr) throw ingErr;

      toast.success(editingId ? "Fórmula atualizada!" : "Fórmula criada!");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta fórmula? Os ingredientes vinculados também serão removidos.")) return;
    await supabase.from("formula_ingredientes").delete().eq("formula_id", id);
    const { error } = await supabase.from("formulas_fabrica").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Excluída"); load(); }
  }

  const mpMap = Object.fromEntries(materias.map(m => [m.id, m]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Fórmulas</CardTitle>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" disabled={materias.length === 0}>
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : materias.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Cadastre matérias-primas antes de criar fórmulas.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Peso batida (kg)</TableHead>
                  <TableHead>Produção esperada (sc)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma fórmula cadastrada.</TableCell></TableRow>
                ) : items.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.peso_batida ?? "—"}</TableCell>
                    <TableCell>{f.producao_esperada ?? "—"}</TableCell>
                    <TableCell><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fórmula" : "Nova Fórmula"}</DialogTitle>
            <DialogDescription>Defina os ingredientes e a produção esperada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Peso batida (kg)</Label><Input type="number" step="0.01" value={form.peso_batida} onChange={e => setForm(f => ({ ...f, peso_batida: e.target.value }))} /></div>
              <div><Label>Peso/saco (kg)</Label><Input type="number" step="0.01" value={form.peso_por_saco} onChange={e => setForm(f => ({ ...f, peso_por_saco: e.target.value }))} /></div>
              <div><Label>Produção esp. (sc)</Label><Input type="number" step="0.01" value={form.producao_esperada} onChange={e => setForm(f => ({ ...f, producao_esperada: e.target.value }))} /></div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Ingredientes</Label>
                <Button type="button" size="sm" variant="outline" onClick={addIngrediente}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {ingredientes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum ingrediente. Clique em Adicionar.</p>
              ) : (
                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Select value={ing.materia_prima_id} onValueChange={v => updateIng(idx, { materia_prima_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Matéria-prima" /></SelectTrigger>
                          <SelectContent>
                            {materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.unidade})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-28">
                        <Input type="number" step="0.01" placeholder="Qtd" value={ing.quantidade} onChange={e => updateIng(idx, { quantidade: e.target.value })} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeIng(idx)}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {ingredientes.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Soma ingredientes:</span> <span className="font-semibold">{totalIng.toFixed(2)} kg</span></div>
                  {pesoBatida > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Diferença vs. peso batida:</span>
                      <span className={`font-semibold ${Math.abs(diff) > 5 ? "text-destructive" : "text-primary"}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
