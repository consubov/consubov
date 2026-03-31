import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Map, TreePine } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Retiro = Tables<"retiros">;
type Fazenda = Tables<"fazendas">;
type Pasto = Tables<"pastos">;

interface PastoForm {
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string;
  sexo: string;
  ativo: boolean;
  categoriaManual: boolean;
}

const emptyPastoForm: PastoForm = {
  nome: "", num_animais: 0, peso_medio_kg: null, categoria: "", sexo: "Macho", ativo: true, categoriaManual: false,
};

function calcCategoria(peso: number | null, sexo: string): string {
  if (peso === null || peso <= 0) return "";
  if (sexo === "Fêmea") {
    if (peso <= 220) return "Recria 1";
    if (peso <= 299) return "Recria 2";
    return "Engorda";
  }
  // Macho or default
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

export default function RetiroDetailPage() {
  const { fazendaId, retiroId } = useParams<{ fazendaId: string; retiroId: string }>();
  const navigate = useNavigate();
  const [retiro, setRetiro] = useState<Retiro | null>(null);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PastoForm>(emptyPastoForm);
  const [saving, setSaving] = useState(false);

  const categoriaCalculada = useMemo(() => calcCategoria(form.peso_medio_kg, form.sexo), [form.peso_medio_kg, form.sexo]);

  async function loadData() {
    if (!retiroId || !fazendaId) return;
    const [retRes, fazRes, pastosRes] = await Promise.all([
      supabase.from("retiros").select("*").eq("id", retiroId).single(),
      supabase.from("fazendas").select("*").eq("id", fazendaId).single(),
      supabase.from("pastos").select("*").eq("retiro_id", retiroId).order("nome"),
    ]);
    if (retRes.error || fazRes.error) {
      toast.error("Retiro não encontrado.");
      navigate(`/admin/fazendas/${fazendaId}`);
      return;
    }
    setRetiro(retRes.data);
    setFazenda(fazRes.data);
    setPastos(pastosRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [retiroId, fazendaId]);

  function openNew() {
    setEditingId(null);
    setForm(emptyPastoForm);
    setDialogOpen(true);
  }

  function openEdit(p: Pasto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome, num_animais: p.num_animais, peso_medio_kg: p.peso_medio_kg ?? null,
      categoria: p.categoria ?? "", sexo: p.sexo ?? "Macho", ativo: p.ativo ?? true, categoriaManual: false,
    });
    setDialogOpen(true);
  }

  function handlePesoChange(val: string) {
    const peso = val ? parseFloat(val) : null;
    const newForm = { ...form, peso_medio_kg: peso };
    if (!form.categoriaManual) {
      newForm.categoria = calcCategoria(peso, form.sexo);
    }
    setForm(newForm);
  }

  function handleSexoChange(val: string) {
    const newForm = { ...form, sexo: val };
    if (!form.categoriaManual) {
      newForm.categoria = calcCategoria(form.peso_medio_kg, val);
    }
    setForm(newForm);
  }

  function handleCategoriaChange(val: string) {
    setForm({ ...form, categoria: val, categoriaManual: true });
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("O nome é obrigatório."); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      retiro_id: retiroId!,
      num_animais: form.num_animais,
      peso_medio_kg: form.peso_medio_kg,
      categoria: form.categoria || null,
      sexo: form.sexo || null,
      ativo: form.ativo,
    };

    if (editingId) {
      const { error } = await supabase.from("pastos").update(payload).eq("id", editingId);

      if (error) {
        console.error("Erro Supabase pastos:", error);
        toast.error(`Erro: ${error.message}`);
        setSaving(false);
        return;
      }

      toast.success("Pasto atualizado!");
      setSaving(false);
      setDialogOpen(false);
      loadData();
      return;
    }

    const { data, error } = await supabase
      .from("pastos")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Erro Supabase pastos:", error);
      toast.error(`Erro: ${error.message}`);
      setSaving(false);
      return;
    }

    setPastos((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    toast.success("Pasto criado!");
    setSaving(false);
    setDialogOpen(false);
    setForm(emptyPastoForm);
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este pasto?")) return;
    const { error } = await supabase.from("pastos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir pasto."); return; }
    toast.success("Pasto excluído.");
    loadData();
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!retiro || !fazenda) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>{fazenda.nome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{retiro.nome}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(`/admin/fazendas/${fazendaId}`)}>
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Map className="w-5 h-5" /> {retiro.nome}</CardTitle>
            <Badge variant={retiro.ativo ? "default" : "secondary"}>{retiro.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Fazenda:</span> {fazenda.nome}</div>
            <div><span className="text-muted-foreground">Capataz:</span> {retiro.capataz}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Pastos deste Retiro</h2>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo Pasto</Button>
      </div>

      {pastos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TreePine className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum pasto cadastrado neste retiro.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Animais</TableHead>
                  <TableHead>Peso Médio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link to={`/admin/fazendas/${fazendaId}/retiros/${retiroId}/pastos/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.nome}
                      </Link>
                    </TableCell>
                    <TableCell>{p.num_animais}</TableCell>
                    <TableCell>{p.peso_medio_kg ? `${p.peso_medio_kg} kg` : "—"}</TableCell>
                    <TableCell>
                      {p.categoria ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoriaBadgeClass(p.categoria)}`}>
                          {p.categoria}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
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
        <DialogContent className="max-w-md" aria-describedby="pasto-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Pasto" : "Novo Pasto"}</DialogTitle>
            <DialogDescription id="pasto-dialog-desc">
              Preencha os dados do pasto. A categoria é calculada automaticamente pelo peso e sexo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pasto A1" />
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