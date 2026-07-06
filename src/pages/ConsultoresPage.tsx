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
import { Plus, Pencil, Trash2, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

interface Consultor {
  id: string;
  nome: string;
  user_id: string;
  ativo: boolean | null;
  created_at: string;
}

interface Form { nome: string; email: string; senha: string; ativo: boolean; }
const emptyForm: Form = { nome: "", email: "", senha: "", ativo: true };

export default function ConsultoresPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("consultores").select("*").order("nome");
    setConsultores((data as Consultor[]) || []);
    setLoading(false);
  }

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(c: Consultor) {
    setEditingId(c.id);
    setForm({ nome: c.nome, email: "", senha: "", ativo: c.ativo ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!editingId) {
      if (!form.email.trim()) return toast.error("Email é obrigatório");
      if (form.senha.length < 6) return toast.error("Senha mínima de 6 caracteres");
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("consultores").update({
          nome: form.nome.trim(), ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Consultor atualizado!");
      } else {
        const res = await supabase.functions.invoke("create-user", {
          body: { email: form.email.trim(), password: form.senha, role: "usuario" },
        });
        if (res.error) throw new Error(res.error.message || "Falha ao criar usuário");
        const respData: any = res.data;
        if (respData?.error) throw new Error(respData.error);
        const userId = respData?.user?.id;
        if (!userId) throw new Error("ID do usuário não retornado");

        const { error } = await supabase.from("consultores").insert({
          nome: form.nome.trim(), user_id: userId, ativo: form.ativo,
        });
        if (error) throw error;
        toast.success("Consultor criado!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este consultor?")) return;
    const { error } = await supabase.from("consultores").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Consultor excluído"); load(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Stethoscope className="w-5 h-5" /> Consultores
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Consultor
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultores.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum consultor cadastrado</TableCell></TableRow>
              ) : consultores.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editingId ? "Editar Consultor" : "Novo Consultor"}</DialogTitle>
            <DialogDescription>{editingId ? "Atualize os dados do consultor." : "O consultor terá acesso ao painel de visitas técnicas."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            {!editingId && (
              <>
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Senha *</Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
              </>
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
