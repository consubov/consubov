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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import FazendasMultiSelect from "@/components/produtos/FazendasMultiSelect";

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
  fazenda_ids: string[];
  ativo: boolean;
}

const emptyForm: GerenteForm = { nome: "", email: "", telefone: "", fazenda_ids: [], ativo: true };

export default function GerentesPage() {
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({});
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
    const [gRes, fRes, vRes] = await Promise.all([
      supabase.from("gerentes").select("*").order("nome"),
      supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("gerentes_fazendas").select("gerente_id, fazenda_id, principal"),
    ]);
    if (gRes.data) setGerentes(gRes.data as Gerente[]);
    if (fRes.data) setFazendas(fRes.data);

    const map: Record<string, string[]> = {};
    for (const row of (vRes.data || []) as { gerente_id: string; fazenda_id: string; principal: boolean }[]) {
      if (!map[row.gerente_id]) map[row.gerente_id] = [];
      if (row.principal) map[row.gerente_id].unshift(row.fazenda_id);
      else map[row.gerente_id].push(row.fazenda_id);
    }
    setVinculos(map);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(g: Gerente) {
    setEditingId(g.id);
    const ids = vinculos[g.id] && vinculos[g.id].length > 0
      ? vinculos[g.id]
      : (g.fazenda_id ? [g.fazenda_id] : []);
    setForm({
      nome: g.nome,
      email: g.email,
      telefone: g.telefone || "",
      fazenda_ids: ids,
      ativo: g.ativo ?? true,
    });
    setDialogOpen(true);
  }

  /** Grava os vínculos em gerentes_fazendas e devolve a fazenda principal. */
  async function salvarVinculos(gerenteId: string, ids: string[], fazendaAtual: string | null) {
    const principal = fazendaAtual && ids.includes(fazendaAtual) ? fazendaAtual : ids[0];

    const { error: delErr } = await supabase
      .from("gerentes_fazendas")
      .delete()
      .eq("gerente_id", gerenteId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from("gerentes_fazendas").insert(
      ids.map((fid) => ({ gerente_id: gerenteId, fazenda_id: fid, principal: fid === principal })),
    );
    if (insErr) throw insErr;

    return principal;
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (form.fazenda_ids.length === 0) {
      toast.error("Selecione pelo menos uma fazenda");
      return;
    }
    setSaving(true);

    try {
      if (editingId) {
        const atual = gerentes.find((g) => g.id === editingId)?.fazenda_id ?? null;
        const principal = await salvarVinculos(editingId, form.fazenda_ids, atual);

        const { error } = await supabase.from("gerentes").update({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          fazenda_id: principal,
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
        const { data: novo, error } = await supabase.from("gerentes").insert({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          fazenda_id: form.fazenda_ids[0],
          user_id: userId || null,
          ativo: form.ativo,
        }).select("id").single();
        if (error) {
          console.error("Erro ao salvar gerente:", error);
          toast.error("Erro ao salvar: " + error.message);
          setSaving(false);
          return;
        }

        await salvarVinculos(novo.id, form.fazenda_ids, form.fazenda_ids[0]);
        toast.success("Gerente criado! Acessa todos os retiros das fazendas selecionadas.");
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
    await supabase.from("gerentes_fazendas").delete().eq("gerente_id", id);
    const { error } = await supabase.from("gerentes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Gerente excluído");
      fetchData();
    }
  }

  const fazendaMap = Object.fromEntries(fazendas.map(f => [f.id, f.nome]));

  function nomesFazendas(g: Gerente) {
    const ids = vinculos[g.id] && vinculos[g.id].length > 0
      ? vinculos[g.id]
      : (g.fazenda_id ? [g.fazenda_id] : []);
    const nomes = ids.map((id) => fazendaMap[id]).filter(Boolean);
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
              <TableHead>Fazendas</TableHead>
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
                  <TableCell>{nomesFazendas(g)}</TableCell>
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
              {editingId ? "Atualize os dados do gerente." : "Preencha os dados. O gerente terá acesso a todos os retiros das fazendas selecionadas."}
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
                fazendas={fazendas}
                selected={form.fazenda_ids}
                onChange={(ids) => setForm(f => ({ ...f, fazenda_ids: ids }))}
                label="Fazendas *"
              />
              <p className="text-xs text-muted-foreground mt-1">O gerente terá acesso a todos os retiros das fazendas selecionadas.</p>
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
