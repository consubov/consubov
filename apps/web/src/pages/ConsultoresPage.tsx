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
  profissao: string | null;
  modulo_despesas_ativo: boolean | null;
}

const PROFISSOES = ["Zootecnista", "Médico(a) Veterinário(a)", "Agrônomo(a)"];

interface Form { nome: string; email: string; senha: string; confirmarSenha: string; ativo: boolean; profissao: string; profissaoOutro: string; despesasAtivo: boolean; }
const emptyForm: Form = { nome: "", email: "", senha: "", confirmarSenha: "", ativo: true, profissao: "", profissaoOutro: "", despesasAtivo: false };

export default function ConsultoresPage() {
  const uiText = useStaticUiText();
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
    const prof = c.profissao ?? "";
    const isPreset = PROFISSOES.includes(prof);
    setForm({
      nome: c.nome, email: "", senha: "", confirmarSenha: "", ativo: c.ativo ?? true,
      profissao: prof ? (isPreset ? prof : "Outro") : "",
      profissaoOutro: prof && !isPreset ? prof : "",
      despesasAtivo: c.modulo_despesas_ativo ?? false,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error(uiText("Nome é obrigatório"));
    if (!editingId) {
      if (!form.email.trim()) return toast.error(uiText("Email é obrigatório"));
      if (form.senha.length < 12) return toast.error(uiText("Senha mínima de 12 caracteres"));
      if (form.senha !== form.confirmarSenha) return toast.error(uiText("As senhas não coincidem"));
    }
    setSaving(true);
    let accountCreated = false;
    const profissaoFinal = form.profissao === "Outro"
      ? (form.profissaoOutro.trim() || null)
      : (form.profissao.trim() || null);
    try {
      if (editingId) {
        const { error } = await supabase.from("consultores").update({
          nome: form.nome.trim(), ativo: form.ativo,
          profissao: profissaoFinal, modulo_despesas_ativo: form.despesasAtivo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success(uiText("Consultor atualizado!"));
      } else {
        const userId = await provisionProfileUser({
          email: form.email,
          senha: form.senha,
          role: "usuario",
        });
        accountCreated = true;

        const { error } = await supabase.from("consultores").insert({
          nome: form.nome.trim(), user_id: userId, ativo: form.ativo,
          profissao: profissaoFinal, modulo_despesas_ativo: form.despesasAtivo,
        });
        if (error) throw error;
        toast.success(uiText("Consultor criado!"));
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(accountCreated ? PARTIAL_PROFILE_MESSAGE
        : err instanceof ProfileProvisioningError ? err.message : "Não foi possível salvar o perfil.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(uiText("Excluir este consultor?"))) return;
    const { error } = await supabase.from("consultores").delete().eq("id", id);
    if (error) toast.error(uiText("Erro: ") + error.message);
    else { toast.success(uiText("Consultor excluído")); load(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Stethoscope className="w-5 h-5" /> <LocalizedText source={"Consultores"} /></h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> <LocalizedText source={"Novo Consultor"} /></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText source={"Nome"} /></TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right"><LocalizedText source={"Ações"} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultores.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8"><LocalizedText source={"Nenhum consultor cadastrado"} /></TableCell></TableRow>
              ) : consultores.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><Badge variant={c.ativo ? "default" : "secondary"}>{uiText(c.ativo ? "Ativo" : "Inativo")}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={uiText("Editar consultor")}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} aria-label={uiText("Excluir consultor")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{uiText(editingId ? "Editar Consultor" : "Novo Consultor")}</DialogTitle>
            <DialogDescription>{uiText(editingId ? "Atualize os dados do consultor." : "O consultor terá acesso ao painel de visitas técnicas.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label><LocalizedText source={"Nome *"} /></Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            {!editingId && (
              <>
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label><LocalizedText source={"Senha *"} /></Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 12 caracteres" /></div>
                <div><Label>Confirmar senha *</Label><Input type="password" autoComplete="new-password" value={form.confirmarSenha} onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))} placeholder="Repita a senha" /></div>
              </>
            )}
            <div className="space-y-2">
              <Label><LocalizedText source={"Profissão"} /></Label>
              <div className="flex flex-wrap gap-2">
                {[...PROFISSOES, "Outro"].map(op => (
                  <Button
                    key={op}
                    type="button"
                    size="sm"
                    variant={form.profissao === op ? "default" : "outline"}
                    onClick={() => setForm(f => ({ ...f, profissao: f.profissao === op ? "" : op }))}
                  >
                    {uiText(op)}
                  </Button>
                ))}
              </div>
              {form.profissao === "Outro" && (
                <Input
                  placeholder={uiText("Digite a profissão")}
                  value={form.profissaoOutro}
                  onChange={e => setForm(f => ({ ...f, profissaoOutro: e.target.value }))}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.despesasAtivo} onCheckedChange={v => setForm(f => ({ ...f, despesasAtivo: v }))} />
              <Label><LocalizedText source={"Ativar módulo de Despesas de Combustível"} /></Label>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label><LocalizedText source={"Ativo"} /></Label></div>
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
