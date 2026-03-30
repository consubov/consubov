import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Map } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Retiro = Tables<"retiros">;
type Fazenda = Tables<"fazendas">;

interface RetiroForm {
  nome: string;
  fazenda_id: string;
  capataz: string;
  ativo: boolean;
}

const emptyForm: RetiroForm = { nome: "", fazenda_id: "", capataz: "", ativo: true };

export default function RetirosPage() {
  const [searchParams] = useSearchParams();
  const filterFazendaId = searchParams.get("fazenda");
  const [retiros, setRetiros] = useState<(Retiro & { fazenda_nome?: string })[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RetiroForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const [retirosRes, fazendasRes] = await Promise.all([
      supabase.from("retiros").select("*").order("nome"),
      supabase.from("fazendas").select("*").eq("ativo", true).order("nome"),
    ]);

    if (retirosRes.error) {
      toast.error("Erro ao carregar retiros.");
      return;
    }

    const fazendasList = fazendasRes.data ?? [];
    const fazendasMap: Record<string, string> = {};
    fazendasList.forEach((f) => { fazendasMap[f.id] = f.nome; });
    const allRetiros = (retirosRes.data ?? []).map((r) => ({
      ...r,
      fazenda_nome: fazendasMap[r.fazenda_id] ?? "—",
    }));
    const filtered = filterFazendaId
      ? allRetiros.filter((r) => r.fazenda_id === filterFazendaId)
      : allRetiros;

    setRetiros(filtered);
    setFazendas(fazendasRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(r: Retiro) {
    setEditingId(r.id);
    setForm({
      nome: r.nome,
      fazenda_id: r.fazenda_id,
      capataz: r.capataz,
      ativo: r.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    if (!form.fazenda_id) {
      toast.error("Selecione uma fazenda.");
      return;
    }
    if (!form.capataz.trim()) {
      toast.error("O nome do capataz é obrigatório.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("retiros")
        .update({
          nome: form.nome.trim(),
          fazenda_id: form.fazenda_id,
          capataz: form.capataz.trim(),
          ativo: form.ativo,
        })
        .eq("id", editingId);

      if (error) {
        toast.error("Erro ao atualizar retiro.");
        setSaving(false);
        return;
      }
      toast.success("Retiro atualizado com sucesso!");
    } else {
      const { error } = await supabase.from("retiros").insert({
        nome: form.nome.trim(),
        fazenda_id: form.fazenda_id,
        capataz: form.capataz.trim(),
        ativo: form.ativo,
      });

      if (error) {
        toast.error("Erro ao criar retiro.");
        setSaving(false);
        return;
      }
      toast.success("Retiro criado com sucesso!");
    }

    setSaving(false);
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este retiro?")) return;

    const { error } = await supabase.from("retiros").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir retiro. Verifique se não há pastos vinculados.");
      return;
    }
    toast.success("Retiro excluído.");
    loadData();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Retiros</h1>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo Retiro
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : retiros.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Map className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum retiro cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Capataz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retiros.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.fazenda_nome}</TableCell>
                    <TableCell>{r.capataz}</TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? "default" : "secondary"}>
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
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
            <DialogTitle>{editingId ? "Editar Retiro" : "Novo Retiro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Retiro Norte"
              />
            </div>
            <div className="space-y-2">
              <Label>Fazenda *</Label>
              <Select value={form.fazenda_id} onValueChange={(val) => setForm({ ...form, fazenda_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capataz">Capataz *</Label>
              <Input
                id="capataz"
                value={form.capataz}
                onChange={(e) => setForm({ ...form, capataz: e.target.value })}
                placeholder="Nome do capataz responsável"
              />
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
