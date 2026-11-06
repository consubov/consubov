import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfileProvisioningError, PARTIAL_PROFILE_MESSAGE, provisionProfileUser } from "@/lib/profileProvisioning";
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Users, ChevronDown, Scale, Beef } from "lucide-react";
import { toast } from "sonner";

type Tipo = "pesador" | "pecuarista";

interface Usuario {
  id: string;
  tipo: Tipo;
  nome: string;
  nome_empresa: string | null;
  telefone: string | null;
  email: string | null;
  user_id: string;
  ativo: boolean | null;
}

interface Form {
  tipo: Tipo;
  nome: string;
  nome_empresa: string;
  telefone: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  ativo: boolean;
}
const emptyForm = (tipo: Tipo): Form => ({
  tipo, nome: "", nome_empresa: "", telefone: "", email: "", senha: "", confirmarSenha: "", ativo: true,
});

export default function PesadoresPage() {
  const uiText = useStaticUiText();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<Form>(emptyForm("pesador"));
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [pes, pec] = await Promise.all([
      supabase.from("pesadores").select("id, nome, nome_empresa, telefone, email, user_id, ativo").order("nome"),
      supabase.from("pecuaristas").select("id, nome, nome_empresa, telefone, email, user_id").order("nome"),
    ]);
    const rows: Usuario[] = [
      ...((pes.data as any[]) ?? []).map(r => ({ ...r, tipo: "pesador" as Tipo })),
      ...((pec.data as any[]) ?? []).map(r => ({ ...r, ativo: true, tipo: "pecuarista" as Tipo })),
    ];
    rows.sort((a, b) => a.nome.localeCompare(b.nome));
    setUsuarios(rows);
    setLoading(false);
  }

  function openNew(tipo: Tipo) {
    setEditing(null);
    setForm(emptyForm(tipo));
    setDialogOpen(true);
  }

  function openEdit(u: Usuario) {
    setEditing(u);
    setForm({
      tipo: u.tipo,
      nome: u.nome,
      nome_empresa: u.nome_empresa ?? "",
      telefone: u.telefone ?? "",
      email: u.email ?? "",
      senha: "",
      confirmarSenha: "",
      ativo: u.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error(uiText("Nome é obrigatório"));
    if (form.tipo === "pesador" && !form.nome_empresa.trim()) return toast.error(uiText("Nome da empresa é obrigatório"));
    if (!editing) {
      if (!form.email.trim()) return toast.error(uiText("Email é obrigatório"));
      if (form.senha.length < 12) return toast.error(uiText("Senha mínima de 12 caracteres"));
      if (form.senha !== form.confirmarSenha) return toast.error(uiText("As senhas não coincidem"));
    }
    setSaving(true);
    let accountCreated = false;
    try {
      const table = form.tipo === "pesador" ? "pesadores" : "pecuaristas";
      if (editing) {
        const patch: any = {
          nome: form.nome.trim(),
          nome_empresa: form.nome_empresa.trim() || null,
          telefone: form.telefone.trim() || null,
        };
        if (form.tipo === "pesador") patch.ativo = form.ativo;
        const { error } = await supabase.from(table).update(patch).eq("id", editing.id);
        if (error) throw error;
        toast.success(uiText("Atualizado!"));
      } else {
        const userId = await provisionProfileUser({
          email: form.email,
          senha: form.senha,
          role: "usuario",
        });
        accountCreated = true;

        const insertRow: any = {
          nome: form.nome.trim(),
          nome_empresa: form.nome_empresa.trim() || null,
          telefone: form.telefone.trim() || null,
          email: form.email.trim(),
          user_id: userId,
        };
        if (form.tipo === "pesador") insertRow.ativo = form.ativo;

        const { error } = await supabase.from(table).insert(insertRow);
        if (error) throw error;
        toast.success(uiText(form.tipo === "pesador" ? "Pesador criado!" : "Pecuarista criado!"));
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(accountCreated ? PARTIAL_PROFILE_MESSAGE
        : err instanceof ProfileProvisioningError ? err.message : "Não foi possível salvar o perfil.");
    } finally { setSaving(false); }
  }

  async function handleDelete(u: Usuario) {
    if (!confirm(uiText(u.tipo === "pesador" ? "Excluir este pesador?" : "Excluir este pecuarista?"))) return;
    const table = u.tipo === "pesador" ? "pesadores" : "pecuaristas";
    const { error } = await supabase.from(table).delete().eq("id", u.id);
    if (error) toast.error(uiText("Erro: ") + error.message);
    else { toast.success(uiText("Excluído")); load(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const titulo = uiText(editing
    ? editing.tipo === "pesador" ? "Editar Pesador" : "Editar Pecuarista"
    : form.tipo === "pesador" ? "Novo Pesador" : "Novo Pecuarista");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" /> <LocalizedText source={"Usuários"} /></h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> <LocalizedText source={"Novo"} />{" "}<ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openNew("pesador")}><Scale className="w-4 h-4 mr-2" /> <LocalizedText source={"Pesador"} /></DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNew("pecuarista")}><Beef className="w-4 h-4 mr-2" /> <LocalizedText source={"Pecuarista"} /></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText source={"Tipo"} /></TableHead>
                <TableHead><LocalizedText source={"Nome"} /></TableHead>
                <TableHead><LocalizedText source={"Empresa"} /></TableHead>
                <TableHead><LocalizedText source={"Telefone"} /></TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24 text-right"><LocalizedText source={"Ações"} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8"><LocalizedText source={"Nenhum usuário cadastrado"} /></TableCell></TableRow>
              ) : usuarios.map(u => (
                <TableRow key={`${u.tipo}-${u.id}`}>
                  <TableCell>
                    <Badge variant={u.tipo === "pesador" ? "default" : "secondary"}>
                      {uiText(u.tipo === "pesador" ? "Pesador" : "Pecuarista")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.nome_empresa ?? "—"}</TableCell>
                  <TableCell>{u.telefone ?? "—"}</TableCell>
                  <TableCell>{u.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} aria-label={uiText("Editar usuário")}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} aria-label={uiText("Excluir usuário")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              {uiText(form.tipo === "pesador"
                ? "O pesador terá acesso ao módulo de pesagem de compra."
                : "O pecuarista terá acesso ao módulo de gestão de fazendas e lotes.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{uiText(form.tipo === "pesador" ? "Nome da empresa *" : "Nome da empresa")}</Label>
              <Input value={form.nome_empresa} onChange={e => setForm(f => ({ ...f, nome_empresa: e.target.value }))} />
            </div>
            <div><Label><LocalizedText source={"Nome *"} /></Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label><LocalizedText source={"Telefone"} /></Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} inputMode="tel" /></div>
            {!editing ? (
              <>
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label><LocalizedText source={"Senha *"} /></Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 12 caracteres" /></div>
                <div><Label>Confirmar senha *</Label><Input type="password" autoComplete="new-password" value={form.confirmarSenha} onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))} placeholder="Repita a senha" /></div>
              </>
            ) : (
              <div><Label>Email</Label><Input type="email" value={form.email} disabled /></div>
            )}
            {form.tipo === "pesador" && (
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label><LocalizedText source={"Ativo"} /></Label></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><LocalizedText source={"Cancelar"} /></Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<LocalizedText source={"Salvar"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
