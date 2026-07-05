import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Package2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface MateriaPrima {
  id: string;
  nome: string;
  unidade: string;
  peso_por_saco: number | null;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  ativo: boolean | null;
}

interface Form {
  nome: string; unidade: string; peso_por_saco: string; estoque_minimo: string; ativo: boolean;
}

const emptyForm: Form = { nome: "", unidade: "kg", peso_por_saco: "", estoque_minimo: "", ativo: true };
const UNIDADES = ["kg", "saco", "litro", "unidade", "tonelada"];

export default function MateriasPrimasPage() {
  const [items, setItems] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("materias_primas").select("*").order("nome");
    setItems((data as MateriaPrima[]) || []);
    setLoading(false);
  }

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(m: MateriaPrima) {
    setEditingId(m.id);
    setForm({
      nome: m.nome,
      unidade: m.unidade,
      peso_por_saco: m.peso_por_saco?.toString() ?? "",
      estoque_minimo: m.estoque_minimo?.toString() ?? "",
      ativo: m.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.unidade.trim()) return toast.error("Unidade é obrigatória");
    setSaving(true);
    try {
      const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
      const payload = {
        nome: form.nome.trim(),
        unidade: form.unidade,
        peso_por_saco: num(form.peso_por_saco),
        estoque_minimo: num(form.estoque_minimo),
        ativo: form.ativo,
      };
      if (editingId) {
        const { error } = await supabase.from("materias_primas").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Matéria-prima atualizada!");
      } else {
        const { error } = await supabase.from("materias_primas").insert({ ...payload, estoque_atual: 0 });
        if (error) throw error;
        toast.success("Matéria-prima criada!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta matéria-prima?")) return;
    const { error } = await supabase.from("materias_primas").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Excluída"); load(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package2 className="w-5 h-5" /> Matérias-Primas
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Matéria-Prima
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Peso/saco</TableHead>
                <TableHead>Estoque Atual</TableHead>
                <TableHead>Estoque Mínimo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma matéria-prima cadastrada</TableCell></TableRow>
              ) : items.map(m => {
                const baixo = (m.estoque_minimo ?? 0) > 0 && (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.unidade}</TableCell>
                    <TableCell>{m.peso_por_saco ? `${m.peso_por_saco} kg` : "—"}</TableCell>
                    <TableCell>
                      <span className={baixo ? "text-destructive font-semibold flex items-center gap-1" : ""}>
                        {baixo && <AlertTriangle className="w-3.5 h-3.5" />}
                        {m.estoque_atual ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>{m.estoque_minimo ?? "—"}</TableCell>
                    <TableCell><Badge variant={m.ativo ? "default" : "secondary"}>{m.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}</DialogTitle>
            <DialogDescription>Estoque atual é atualizado automaticamente pelas entradas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div>
              <Label>Unidade *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {UNIDADES.map(u => (
                  <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unidade: u }))}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${form.unidade === u ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Peso por saco (kg)</Label><Input type="number" step="0.01" value={form.peso_por_saco} onChange={e => setForm(f => ({ ...f, peso_por_saco: e.target.value }))} /></div>
            <div><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} /></div>
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
    </div>
  );
}
