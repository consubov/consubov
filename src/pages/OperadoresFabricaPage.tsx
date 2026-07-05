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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface Fabrica { id: string; nome: string; codigo: string | null; }
interface Operador {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  fabrica_id: string;
  user_id: string | null;
  ativo: boolean | null;
}

interface Form {
  nome: string; email: string; telefone: string; senha: string;
  fabrica_id: string; ativo: boolean;
}

const emptyForm: Form = { nome: "", email: "", telefone: "", senha: "", fabrica_id: "", ativo: true };

export default function OperadoresFabricaPage() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [op, fb] = await Promise.all([
      supabase.from("operadores_fabrica").select("*").order("nome"),
      supabase.from("fabricas").select("id, nome, codigo").eq("ativo", true).order("nome"),
    ]);
    setOperadores((op.data as Operador[]) || []);
    setFabricas((fb.data as Fabrica[]) || []);
    setLoading(false);
  }

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(o: Operador) {
    setEditingId(o.id);
    setForm({
      nome: o.nome, email: o.email || "", telefone: o.telefone || "",
      senha: "", fabrica_id: o.fabrica_id, ativo: o.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.fabrica_id) return toast.error("Selecione uma fábrica");
    if (!editingId) {
      if (!form.email.trim()) return toast.error("Email é obrigatório");
      if (form.senha.length < 6) return toast.error("Senha mínima de 6 caracteres");
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("operadores_fabrica").update({
          nome: form.nome.trim(),
          telefone: form.telefone.trim() || null,
          fabrica_id: form.fabrica_id,
          ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Operador atualizado!");
      } else {
        const res = await supabase.functions.invoke("create-user", {
          body: { email: form.email.trim(), password: form.senha, role: "usuario" },
        });
        if (res.error) throw new Error(res.error.message || "Falha ao criar usuário");
        const respData: any = res.data;
        if (respData?.error) throw new Error(respData.error);
        const userId = respData?.user?.id;
        if (!userId) throw new Error("ID do usuário não retornado");

        const { error } = await supabase.from("operadores_fabrica").insert({
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim() || null,
          fabrica_id: form.fabrica_id,
          user_id: userId,
          ativo: form.ativo,
        });
        if (error) throw error;
        toast.success("Operador criado!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este operador?")) return;
    const { error } = await supabase.from("operadores_fabrica").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Operador excluído"); load(); }
  }

  const fabMap = Object.fromEntries(fabricas.map(f => [f.id, f.nome]));

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" /> Operadores de Fábrica
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Operador
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Fábrica</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operadores.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum operador cadastrado</TableCell></TableRow>
              ) : operadores.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.nome}</TableCell>
                  <TableCell>{o.email || "—"}</TableCell>
                  <TableCell>{o.telefone || "—"}</TableCell>
                  <TableCell>{fabMap[o.fabrica_id] || "—"}</TableCell>
                  <TableCell><Badge variant={o.ativo ? "default" : "secondary"}>{o.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Operador" : "Novo Operador"}</DialogTitle>
            <DialogDescription>{editingId ? "Atualize os dados do operador." : "O operador poderá acessar apenas a fábrica selecionada."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Email {editingId ? "" : "*"}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingId} /></div>
            {!editingId && (
              <div><Label>Senha *</Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
            )}
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            <div>
              <Label>Fábrica *</Label>
              <Select value={form.fabrica_id} onValueChange={v => setForm(f => ({ ...f, fabrica_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma fábrica" /></SelectTrigger>
                <SelectContent>
                  {fabricas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
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
    </div>
  );
}
