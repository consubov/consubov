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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { ForcarSyncButton } from "@/components/ForcarSyncButton";
import FazendasMultiSelect from "@/components/produtos/FazendasMultiSelect";

interface Retiro {
  id: string;
  nome: string;
}

interface Capataz {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  retiro_id: string | null;
  user_id: string | null;
  ativo: boolean | null;
}

interface CapatazForm {
  nome: string;
  email: string;
  telefone: string;
  retiro_ids: string[];
  ativo: boolean;
}

const emptyForm: CapatazForm = { nome: "", email: "", telefone: "", retiro_ids: [], ativo: true };

export default function CapatazesPage() {
  const [capatazes, setCapatazes] = useState<Capataz[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CapatazForm>(emptyForm);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [cRes, rRes, vRes, fRes] = await Promise.all([
      supabase.from("capatazes").select("*").order("nome"),
      supabase.from("retiros").select("id, nome, fazenda_id").eq("ativo", true).order("nome"),
      supabase.from("capatazes_retiros").select("capataz_id, retiro_id, principal"),
      supabase.from("fazendas").select("id, nome"),
    ]);
    if (cRes.data) setCapatazes(cRes.data as Capataz[]);

    const fazendaNome = Object.fromEntries(((fRes.data || []) as { id: string; nome: string }[]).map(f => [f.id, f.nome]));
    const lista = ((rRes.data || []) as { id: string; nome: string; fazenda_id: string | null }[]).map(r => ({
      id: r.id,
      nome: r.fazenda_id && fazendaNome[r.fazenda_id] ? `${r.nome} — ${fazendaNome[r.fazenda_id]}` : r.nome,
    }));
    setRetiros(lista);

    const map: Record<string, string[]> = {};
    for (const row of (vRes.data || []) as { capataz_id: string; retiro_id: string; principal: boolean }[]) {
      if (!map[row.capataz_id]) map[row.capataz_id] = [];
      if (row.principal) map[row.capataz_id].unshift(row.retiro_id);
      else map[row.capataz_id].push(row.retiro_id);
    }
    setVinculos(map);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Capataz) {
    setEditingId(c.id);
    const ids = vinculos[c.id] && vinculos[c.id].length > 0
      ? vinculos[c.id]
      : (c.retiro_id ? [c.retiro_id] : []);
    setForm({
      nome: c.nome,
      email: c.email,
      telefone: c.telefone || "",
      retiro_ids: ids,
      ativo: c.ativo ?? true,
    });
    setDialogOpen(true);
  }

  /** Grava os vínculos em capatazes_retiros e devolve o retiro principal. */
  async function salvarVinculos(capatazId: string, ids: string[], retiroAtual: string | null) {
    const principal = retiroAtual && ids.includes(retiroAtual) ? retiroAtual : ids[0];

    const { error: delErr } = await supabase
      .from("capatazes_retiros")
      .delete()
      .eq("capataz_id", capatazId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from("capatazes_retiros").insert(
      ids.map((rid) => ({ capataz_id: capatazId, retiro_id: rid, principal: rid === principal })),
    );
    if (insErr) throw insErr;

    return principal;
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (form.retiro_ids.length === 0) {
      toast.error("Selecione pelo menos um retiro");
      return;
    }
    setSaving(true);

    try {
      if (editingId) {
        const atual = capatazes.find((c) => c.id === editingId)?.retiro_id ?? null;
        const principal = await salvarVinculos(editingId, form.retiro_ids, atual);

        const { error } = await supabase.from("capatazes").update({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          retiro_id: principal,
          ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Capataz atualizado!");
      } else {
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
        const { data: novo, error } = await supabase.from("capatazes").insert({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          retiro_id: form.retiro_ids[0],
          user_id: userId || null,
          ativo: form.ativo,
        }).select("id").single();
        if (error) {
          console.error("Erro ao salvar capataz:", error);
          toast.error("Erro ao salvar: " + error.message);
          setSaving(false);
          return;
        }

        await salvarVinculos(novo.id, form.retiro_ids, form.retiro_ids[0]);
        toast.success("Capataz criado! Senha padrão: Consubov@2025");
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
    if (!confirm("Excluir este capataz?")) return;
    await supabase.from("capatazes_retiros").delete().eq("capataz_id", id);
    const { error } = await supabase.from("capatazes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Capataz excluído");
      fetchData();
    }
  }

  async function handleResetPassword(c: Capataz) {
    if (!c.user_id) {
      toast.error("Este capataz não possui usuário vinculado no Auth");
      return;
    }
    if (!confirm(`Redefinir a senha de ${c.nome} para "Consubov@2025"?`)) return;

    try {
      const res = await supabase.functions.invoke("reset-password", {
        body: { user_id: c.user_id, password: "Consubov@2025" },
      });
      if (res.error) {
        toast.error("Erro ao redefinir senha: " + (res.error.message || JSON.stringify(res.error)));
        return;
      }
      const responseData = res.data;
      if (responseData?.error) {
        toast.error("Erro: " + responseData.error);
        return;
      }
      toast.success(`Senha de ${c.nome} redefinida para Consubov@2025`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
  }

  const retiroMap = Object.fromEntries(retiros.map(r => [r.id, r.nome]));

  function nomesRetiros(c: Capataz) {
    const ids = vinculos[c.id] && vinculos[c.id].length > 0
      ? vinculos[c.id]
      : (c.retiro_id ? [c.retiro_id] : []);
    const nomes = ids.map((id) => retiroMap[id]).filter(Boolean);
    return nomes.length > 0 ? nomes.join(", ") : "—";
  }

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
        <h1 className="text-2xl font-bold text-foreground">Capatazes</h1>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Capataz
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Retiros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {capatazes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum capataz cadastrado
                </TableCell>
              </TableRow>
            ) : (
              capatazes.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.telefone || "—"}</TableCell>
                  <TableCell>{nomesRetiros(c)}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? "default" : "secondary"}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ForcarSyncButton targetUserId={c.user_id} targetName={c.nome} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleResetPassword(c)} title="Redefinir Senha">
                        <KeyRound className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} title="Excluir">
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
            <DialogTitle>{editingId ? "Editar Capataz" : "Novo Capataz"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados do capataz." : "Preencha os dados. Senha padrão: Consubov@2025"}
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
              <FazendasMultiSelect
                fazendas={retiros}
                selected={form.retiro_ids}
                onChange={(ids) => setForm(f => ({ ...f, retiro_ids: ids }))}
                label="Retiros *"
                searchPlaceholder="Pesquisar retiro..."
                emptyMessage="Nenhum retiro disponível."
              />
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
