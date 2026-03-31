import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, TreePine } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Pasto = Tables<"pastos">;
type Retiro = Tables<"retiros">;
type Fazenda = Tables<"fazendas">;

interface PastoForm {
  nome: string;
  retiro_id: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string;
  sexo: string;
  ativo: boolean;
  categoriaManual: boolean;
}

const emptyForm: PastoForm = {
  nome: "", retiro_id: "", num_animais: 0, peso_medio_kg: null,
  categoria: "", sexo: "Macho", ativo: true, categoriaManual: false,
};

function calcCategoria(peso: number | null, sexo: string): string {
  if (peso === null || peso <= 0) return "";
  if (sexo === "Fêmea") {
    if (peso <= 220) return "Recria 1";
    if (peso <= 299) return "Recria 2";
    return "Engorda";
  }
  if (peso <= 220) return "Recria 1";
  if (peso <= 360) return "Recria 2";
  return "Engorda";
}

function categoriaBadgeClass(cat: string) {
  if (cat === "Recria 1") return "bg-blue-500 text-white";
  if (cat === "Recria 2") return "bg-yellow-500 text-black";
  if (cat === "Engorda") return "bg-green-600 text-white";
  return "";
}

type EnrichedPasto = Pasto & { retiro_nome?: string; fazenda_nome?: string };

export default function PastosPage() {
  const [pastos, setPastos] = useState<EnrichedPasto[]>([]);
  const [retiros, setRetiros] = useState<(Retiro & { fazenda_nome?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PastoForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const categoriaCalculada = useMemo(() => calcCategoria(form.peso_medio_kg, form.sexo), [form.peso_medio_kg, form.sexo]);

  async function loadData() {
    try {
      const [pastosRes, retirosRes, fazendasRes] = await Promise.all([
        supabase.from("pastos").select("*").order("nome"),
        supabase.from("retiros").select("*").eq("ativo", true).order("nome"),
        supabase.from("fazendas").select("*").eq("ativo", true).order("nome"),
      ]);

      if (pastosRes.error) { toast.error("Erro ao carregar pastos."); setLoading(false); return; }

      const fazendasMap: Record<string, string> = {};
      (fazendasRes.data ?? []).forEach((f) => { fazendasMap[f.id] = f.nome; });

      const retirosMap: Record<string, { nome: string; fazenda_id: string }> = {};
      const enrichedRetiros = (retirosRes.data ?? []).map((r) => {
        retirosMap[r.id] = { nome: r.nome, fazenda_id: r.fazenda_id };
        return { ...r, fazenda_nome: fazendasMap[r.fazenda_id] ?? "—" };
      });

      const enrichedPastos = (pastosRes.data ?? []).map((p) => {
        const retiro = retirosMap[p.retiro_id];
        return {
          ...p,
          retiro_nome: retiro?.nome ?? "—",
          fazenda_nome: retiro ? (fazendasMap[retiro.fazenda_id] ?? "—") : "—",
        };
      });

      setPastos(enrichedPastos);
      setRetiros(enrichedRetiros);
    } catch (err) {
      console.error("Erro ao carregar dados de pastos:", err);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }

  function openEdit(p: Pasto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome, retiro_id: p.retiro_id, num_animais: p.num_animais,
      peso_medio_kg: p.peso_medio_kg ?? null, categoria: p.categoria ?? "",
      sexo: p.sexo ?? "Macho", ativo: p.ativo ?? true, categoriaManual: false,
    });
    setDialogOpen(true);
  }

  function handlePesoChange(val: string) {
    const peso = val ? parseFloat(val) : null;
    const newForm = { ...form, peso_medio_kg: peso };
    if (!form.categoriaManual) newForm.categoria = calcCategoria(peso, form.sexo);
    setForm(newForm);
  }

  function handleSexoChange(val: string) {
    const newForm = { ...form, sexo: val };
    if (!form.categoriaManual) newForm.categoria = calcCategoria(form.peso_medio_kg, val);
    setForm(newForm);
  }

  function handleCategoriaChange(val: string) {
    setForm({ ...form, categoria: val, categoriaManual: true });
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("O nome é obrigatório."); return; }
    if (!form.retiro_id) { toast.error("Selecione um retiro."); return; }

    setSaving(true);
    const payload = {
      nome: form.nome.trim(), retiro_id: form.retiro_id, num_animais: form.num_animais,
      peso_medio_kg: form.peso_medio_kg, categoria: form.categoria || null,
      sexo: form.sexo || null, ativo: form.ativo,
    };

    let result;
    if (editingId) {
      result = await supabase.from("pastos").update(payload).eq("id", editingId);
    } else {
      result = await supabase.from("pastos").insert(payload);
    }

    if (result.error) {
      console.error("Erro Supabase pastos:", result.error);
      toast.error(`Erro: ${result.error.message}`);
      setSaving(false);
      return;
    }

    toast.success(editingId ? "Pasto atualizado com sucesso!" : "Pasto criado com sucesso!");
    setSaving(false);
    setDialogOpen(false);
    setLoading(true);
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este pasto?")) return;
    const { error } = await supabase.from("pastos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir pasto."); return; }
    toast.success("Pasto excluído.");
    loadData();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pastos</h1>
        <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> Novo Pasto</Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : pastos.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><TreePine className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Nenhum pasto cadastrado.</p></CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Retiro</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Animais</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.retiro_nome}</TableCell>
                    <TableCell>{p.fazenda_nome}</TableCell>
                    <TableCell>{p.num_animais}</TableCell>
                    <TableCell>
                      {p.categoria ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoriaBadgeClass(p.categoria)}`}>
                          {p.categoria}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
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
        <DialogContent className="max-w-md" aria-describedby="pasto-page-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Pasto" : "Novo Pasto"}</DialogTitle>
            <DialogDescription id="pasto-page-dialog-desc">
              Preencha os dados do pasto. A categoria é calculada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pasto A1" />
            </div>
            <div className="space-y-2">
              <Label>Retiro *</Label>
              <Select value={form.retiro_id} onValueChange={(val) => setForm({ ...form, retiro_id: val })}>
                <SelectTrigger><SelectValue placeholder="Selecione um retiro" /></SelectTrigger>
                <SelectContent>
                  {retiros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome} — {r.fazenda_nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="num_animais">Nº Animais</Label>
                <Input id="num_animais" type="number" value={form.num_animais} onChange={(e) => setForm({ ...form, num_animais: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso_medio">Peso Médio (kg)</Label>
                <Input id="peso_medio" type="number" value={form.peso_medio_kg ?? ""} onChange={(e) => handlePesoChange(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={handleSexoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Fêmea">Fêmea</SelectItem>
                    <SelectItem value="Misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={handleCategoriaChange}>
                  <SelectTrigger><SelectValue placeholder="Automática" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recria 1">Recria 1</SelectItem>
                    <SelectItem value="Recria 2">Recria 2</SelectItem>
                    <SelectItem value="Engorda">Engorda</SelectItem>
                    <SelectItem value="Cria">Cria</SelectItem>
                  </SelectContent>
                </Select>
                {categoriaCalculada && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1 ${categoriaBadgeClass(categoriaCalculada)}`}>
                    {categoriaCalculada}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch id="ativo" checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}