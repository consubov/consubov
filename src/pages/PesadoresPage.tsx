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
import { Plus, Pencil, Trash2, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";

interface Pesador {
  id: string;
  nome: string;
  nome_empresa: string | null;
  telefone: string | null;
  email: string | null;
  user_id: string;
  ativo: boolean | null;
  created_at: string;
}

interface Form {
  nome: string;
  nome_empresa: string;
  telefone: string;
  email: string;
  senha: string;
  ativo: boolean;
}
const emptyForm: Form = { nome: "", nome_empresa: "", telefone: "", email: "", senha: "", ativo: true };

export default function PesadoresPage() {
  const [pesadores, setPesadores] = useState<Pesador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("pesadores").select("*").order("nome");
    setPesadores((data as Pesador[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Pesador) {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      nome_empresa: p.nome_empresa ?? "",
      telefone: p.telefone ?? "",
      email: p.email ?? "",
      senha: "",
      ativo: p.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.nome_empresa.trim()) return toast.error("Nome da empresa é obrigatório");
    if (!editingId) {
      if (!form.email.trim()) return toast.error("Email é obrigatório");
      if (form.senha.length < 6) return toast.error("Senha mínima de 6 caracteres");
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("pesadores").update({
          nome: form.nome.trim(),
          nome_empresa: form.nome_empresa.trim(),
          telefone: form.telefone.trim() || null,
          ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Pesador atualizado!");
      } else {
        const res = await supabase.functions.invoke("create-user", {
          body: { email: form.email.trim(), password: form.senha, role: "usuario" },
        });
        if (res.error) throw new Error(res.error.message || "Falha ao criar usuário");
        const respData: any = res.data;
        if (respData?.error) throw new Error(respData.error);
        const userId = respData?.user?.id;
        if (!userId) throw new Error("ID do usuário não retornado");

        const { error } = await supabase.from("pesadores").insert({
          nome: form.nome.trim(),
          nome_empresa: form.nome_empresa.trim(),
          telefone: form.telefone.trim() || null,
          email: form.email.trim(),
          user_id: userId,
          ativo: form.ativo,
        });
        if (error) throw error;
        toast.success("Pesador criado!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pesador?")) return;
    const { error } = await supabase.from("pesadores").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Pesador excluído"); load(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Scale className="w-5 h-5" /> Pesadores
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Pesador
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pesadores.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum pesador cadastrado</TableCell></TableRow>
              ) : pesadores.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.nome_empresa ?? "—"}</TableCell>
                  <TableCell>{p.telefone ?? "—"}</TableCell>
                  <TableCell>{p.email ?? "—"}</TableCell>
                  <TableCell><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editingId ? "Editar Pesador" : "Novo Pesador"}</DialogTitle>
            <DialogDescription>{editingId ? "Atualize os dados do pesador." : "O pesador terá acesso ao módulo de pesagem de compra."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da empresa *</Label><Input value={form.nome_empresa} onChange={e => setForm(f => ({ ...f, nome_empresa: e.target.value }))} /></div>
            <div><Label>Nome do pesador *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} inputMode="tel" /></div>
            {!editingId ? (
              <>
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Senha *</Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
              </>
            ) : (
              <div><Label>Email</Label><Input type="email" value={form.email} disabled /></div>
            )}
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
