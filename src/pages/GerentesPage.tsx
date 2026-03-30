import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Fazenda {
  id: string;
  nome: string;
}

interface Gerente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  fazenda_id: string | null;
  user_id: string | null;
  ativo: boolean | null;
}

interface GerenteForm {
  nome: string;
  email: string;
  telefone: string;
  fazenda_id: string;
  ativo: boolean;
}

const emptyForm: GerenteForm = { nome: "", email: "", telefone: "", fazenda_id: "", ativo: true };

export default function GerentesPage() {
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GerenteForm>(emptyForm);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [gRes, fRes] = await Promise.all([
      supabase.from("gerentes").select("*").order("nome"),
      supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    if (gRes.data) setGerentes(gRes.data as Gerente[]);
    if (fRes.data) setFazendas(fRes.data);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(g: Gerente) {
    setEditingId(g.id);
    setForm({
      nome: g.nome,
      email: g.email,
      telefone: g.telefone || "",
      fazenda_id: g.fazenda_id || "",
      ativo: g.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (!form.fazenda_id) {
      toast.error("Selecione uma fazenda");
      return;
    }
    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase.from("gerentes").update({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          fazenda_id: form.fazenda_id,
          ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Gerente atualizado!");
      } else {
        // Create auth user first
        const res = await supabase.functions.invoke("create-user", {
          body: { email: form.email, password: "Consubov@2025" },
        });
        if (res.error) {
          console.error("Erro ao criar usuário:", res.error);
          toast.error("Erro ao criar usuário: " + (res.error.message || JSON.stringify(res.error)));
          setSaving(false);
          return;
        }
        const responseData = res.data;
        if (responseData?.error) {
          console.error("Erro ao criar usuário:", responseData.error);
          toast.error("Erro ao criar usuário: " + responseData.error);
          setSaving(false);
          return;
        }

        const userId = responseData?.user?.id;
        const { error } = await supabase.from("gerentes").insert({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          fazenda_id: form.fazenda_id,
          user_id: userId || null,
          ativo: form.ativo,
        });
        if (error) {
          console.error("Erro ao salvar gerente:", error);
          toast.error("Erro ao salvar: " + error.message);
          setSaving(false);
          return;
        }
        toast.success("Gerente criado! Acessa todos os retiros da fazenda selecionada.");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este gerente?")) return;
    const { error } = await supabase.from("gerentes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Gerente excluído");
      fetchData();
    }
  }

  const fazendaMap = Object.fromEntries(fazendas.map(f => [f.id, f.nome]));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gerentes</h1>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Gerente
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Fazenda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gerentes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum gerente cadastrado
                </TableCell>
              </TableRow>
            ) : (
              gerentes.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.nome}</TableCell>
                  <TableCell>{g.email}</TableCell>
                  <TableCell>{g.telefone || "—"}</TableCell>
                  <TableCell>{g.fazenda_id ? fazendaMap[g.fazenda_id] || "—" : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={g.ativo ? "default" : "secondary"}>
                      {g.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(g.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Gerente" : "Novo Gerente"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados do gerente." : "Preencha os dados. O gerente terá acesso a todos os retiros da fazenda."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingId} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <Label>Fazenda *</Label>
              <Select value={form.fazenda_id} onValueChange={v => setForm(f => ({ ...f, fazenda_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma fazenda" /></SelectTrigger>
                <SelectContent>
                  {fazendas.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">O gerente terá acesso a todos os retiros desta fazenda.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
