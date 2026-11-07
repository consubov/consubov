import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PARTIAL_PROFILE_MESSAGE, ProfileProvisioningError, provisionProfileUser } from "@/lib/profileProvisioning";
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
  senha: string;
  confirmarSenha: string;
  retiro_ids: string[];
  ativo: boolean;
}

const emptyForm: CapatazForm = { nome: "", email: "", telefone: "", senha: "", confirmarSenha: "", retiro_ids: [], ativo: true };

export default function CapatazesPage() {
  const uiText = useStaticUiText();
  const [capatazes, setCapatazes] = useState<Capataz[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CapatazForm>(emptyForm);
  const [passwordTarget, setPasswordTarget] = useState<Capataz | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

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
      senha: "", confirmarSenha: "",
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
      toast.error(uiText("Nome e email são obrigatórios"));
      return;
    }
    if (form.retiro_ids.length === 0) {
      toast.error(uiText("Selecione pelo menos um retiro"));
      return;
    }
    if (!editingId && (form.senha.length < 12 || form.senha !== form.confirmarSenha)) {
      toast.error(uiText("Defina uma senha de pelo menos 12 caracteres e confirme-a."));
      return;
    }
    setSaving(true);
    let accountCreated = false;

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
        toast.success(uiText("Capataz atualizado!"));
      } else {
        const userId = await provisionProfileUser({
          email: form.email,
          senha: form.senha,
          role: "usuario",
        });
        accountCreated = true;
        const { data: novo, error } = await supabase.from("capatazes").insert({
          nome: form.nome,
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone || null,
          retiro_id: form.retiro_ids[0],
          user_id: userId,
          ativo: form.ativo,
        }).select("id").single();
        if (error || !novo?.id) throw new Error("profile_insert_failed");
        await salvarVinculos(novo.id, form.retiro_ids, form.retiro_ids[0]);
        toast.success(uiText("Capataz criado! A senha foi definida no cadastro."));
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(accountCreated
        ? PARTIAL_PROFILE_MESSAGE
        : err instanceof ProfileProvisioningError ? err.message : "Não foi possível salvar capataz.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(uiText("Excluir este capataz?"))) return;
    await supabase.from("capatazes_retiros").delete().eq("capataz_id", id);
    const { error } = await supabase.from("capatazes").delete().eq("id", id);
    if (error) {
      toast.error(uiText("Erro ao excluir: ") + error.message);
    } else {
      toast.success(uiText("Capataz excluído"));
      fetchData();
    }
  }

  function handleResetPassword(c: Capataz) {
    if (!c.user_id) {
      toast.error(uiText("Este capataz não possui usuário vinculado no Auth"));
      return;
    }
    setPasswordTarget(c);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function confirmResetPassword() {
    if (!passwordTarget?.user_id) return;
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      toast.error(uiText("Defina uma senha de pelo menos 12 caracteres e confirme-a."));
      return;
    }
    setResetting(true);
    try {
      const res = await supabase.functions.invoke("reset-password", {
        body: { user_id: passwordTarget.user_id, password: newPassword },
      });
      if (res.error || res.data?.success !== true) {
        toast.error(uiText("Não foi possível redefinir a senha. Verifique sua sessão e permissões."));
        return;
      }
      toast.success(uiText("Senha redefinida. Entregue a nova senha somente pelo canal privado autorizado."));
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error(uiText("Não foi possível redefinir a senha."));
    } finally {
      setResetting(false);
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
        <h1 className="text-2xl font-bold text-foreground"><LocalizedText source={"Capatazes"} /></h1>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> <LocalizedText source={"Novo Capataz"} /></Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><LocalizedText source={"Nome"} /></TableHead>
              <TableHead>Email</TableHead>
              <TableHead><LocalizedText source={"Telefone"} /></TableHead>
              <TableHead><LocalizedText source={"Retiros"} /></TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"><LocalizedText source={"Ações"} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {capatazes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <LocalizedText source={"Nenhum capataz cadastrado"} /></TableCell>
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
                      {uiText(c.ativo ? "Ativo" : "Inativo")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ForcarSyncButton targetUserId={c.user_id} targetName={c.nome} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title={uiText("Editar")}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleResetPassword(c)} title={uiText("Redefinir Senha")}>
                        <KeyRound className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} title={uiText("Excluir")}>
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

      <Dialog open={!!passwordTarget} onOpenChange={(open) => {
        if (!open && !resetting) {
          setPasswordTarget(null);
          setNewPassword("");
          setConfirmPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha do capataz</DialogTitle>
            <DialogDescription>
              Defina uma nova senha exclusiva. Não reutilize senhas de outros perfis.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="capataz-reset-senha">Nova senha *</Label>
            <PasswordInput id="capataz-reset-senha" autoComplete="new-password"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="capataz-reset-confirmar">Confirmar senha *</Label>
            <PasswordInput id="capataz-reset-confirmar" autoComplete="new-password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Mínimo 12 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={resetting} onClick={() => setPasswordTarget(null)}>Cancelar</Button>
            <Button onClick={confirmResetPassword} disabled={resetting}>Redefinir senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{uiText(editingId ? "Editar Capataz" : "Novo Capataz")}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados do capataz." : "Preencha os dados e defina uma senha exclusiva."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="capataz-nome"><LocalizedText source={"Nome *"} /></Label>
              <Input id="capataz-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="capataz-email">Email *</Label>
              <Input id="capataz-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingId} />
            </div>
            <div>
              <Label htmlFor="capataz-telefone"><LocalizedText source={"Telefone"} /></Label>
              <Input id="capataz-telefone" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            {!editingId && (
              <>
                <div>
                  <Label htmlFor="capataz-password">Senha de acesso *</Label>
                  <PasswordInput id="capataz-password" autoComplete="new-password"
                    value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="capataz-confirm-password">Confirmar senha *</Label>
                  <PasswordInput id="capataz-confirm-password" autoComplete="new-password"
                    value={form.confirmarSenha}
                    onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 12 caracteres. Não compartilhe a senha entre perfis.
                  </p>
                </div>
              </>
            )}
            <div>
              <FazendasMultiSelect
                fazendas={retiros}
                selected={form.retiro_ids}
                onChange={(ids) => setForm(f => ({ ...f, retiro_ids: ids }))}
                label={uiText("Retiros *")}
                searchPlaceholder={uiText("Pesquisar retiro...")}
                emptyMessage={uiText("Nenhum retiro disponível.")}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label><LocalizedText source={"Ativo"} /></Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><LocalizedText source={"Cancelar"} /></Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <LocalizedText source={"Salvar"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
