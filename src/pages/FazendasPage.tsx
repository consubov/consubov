import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Landmark, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Fazenda = Tables<"fazendas">;

interface FazendaForm {
  nome: string;
  cidade: string;
  estado: string;
  ativo: boolean;
}

const emptyForm: FazendaForm = { nome: "", cidade: "", estado: "TO", ativo: true };

export default function FazendasPage() {
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FazendaForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadFazendas() {
    const { data, error } = await supabase
      .from("fazendas")
      .select("*")
      .order("nome");

    if (error) {
      toast.error("Erro ao carregar fazendas.");
      return;
    }
    setFazendas(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadFazendas();
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(f: Fazenda) {
    setEditingId(f.id);
    setForm({ nome: f.nome, cidade: f.cidade, estado: f.estado, ativo: f.ativo ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("fazendas")
        .update({ nome: form.nome.trim(), cidade: form.cidade.trim(), estado: form.estado.trim(), ativo: form.ativo })
        .eq("id", editingId);

      if (error) {
        toast.error("Erro ao atualizar fazenda.");
        setSaving(false);
        return;
      }
      toast.success("Fazenda atualizada com sucesso!");
    } else {
      const { error } = await supabase
        .from("fazendas")
        .insert({
          nome: form.nome.trim(),
          cidade: form.cidade.trim(),
          estado: form.estado.trim(),
          ativo: form.ativo,
          administrador_id: roleData.roleId,
        });

      if (error) {
        toast.error("Erro ao criar fazenda.");
        setSaving(false);
        return;
      }
      toast.success("Fazenda criada com sucesso!");
    }

    setSaving(false);
    setDialogOpen(false);
    loadFazendas();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir esta fazenda?")) return;

    const { error } = await supabase.from("fazendas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir fazenda. Verifique se não há retiros vinculados.");
      return;
    }
    toast.success("Fazenda excluída.");
    loadFazendas();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Fazendas</h1>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nova Fazenda
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : fazendas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Landmark className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma fazenda cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fazendas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Link to={`/admin/fazendas/${f.id}`} className="font-medium text-primary hover:underline">
                        {f.nome}
                      </Link>
                    </TableCell>
                    <TableCell>{f.cidade} — {f.estado}</TableCell>
                    <TableCell>
                      <Badge variant={f.ativo ? "default" : "secondary"}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/retiros?fazenda=${f.id}`)} title="Ver Retiros">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fazenda" : "Nova Fazenda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Fazenda Boa Vista"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  placeholder="Ex: Palmas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  placeholder="Ex: TO"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
              />
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
