import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, KeyRound } from "lucide-react";

type Perfil = "administrador" | "veterinario" | "prestador_servico" | "estagiario" | "auxiliar";
const PERFIL_LABEL: Record<Perfil, string> = {
  administrador: "Administrador",
  veterinario: "Veterinário",
  prestador_servico: "Prestador de Serviço",
  estagiario: "Estagiário",
  auxiliar: "Auxiliar",
};

type Membro = {
  id: string;
  nome: string;
  perfil: Perfil;
  telefone: string | null;
  email: string | null;
  user_id: string | null;
  ativo: boolean;
};

export default function SyncVetEquipePage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [rows, setRows] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Membro | null>(null);
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("veterinario");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_equipe")
      .select("id, nome, perfil, telefone, email, user_id, ativo")
      .eq("empresa_id", empresaId)
      .order("ativo", { ascending: false })
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  function openNew() {
    setEditing(null);
    setNome(""); setPerfil("veterinario"); setTelefone(""); setEmail(""); setSenha("");
    setOpen(true);
  }
  function openEdit(m: Membro) {
    setEditing(m);
    setNome(m.nome); setPerfil(m.perfil); setTelefone(m.telefone ?? "");
    setEmail(m.email ?? ""); setSenha("");
    setOpen(true);
  }

  async function handleSave() {
    if (!empresaId) return;
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }

    const emailNorm = email.trim().toLowerCase();
    const wantsAccess = !!emailNorm;

    if (wantsAccess && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      toast.error("Informe um e-mail válido"); return;
    }
    if (!editing && wantsAccess && senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres"); return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("syncvet_equipe").update({
          nome: nome.trim(),
          perfil,
          telefone: telefone || null,
          email: emailNorm || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Membro atualizado");
        setOpen(false); load();
      } else {
        let userId: string | null = null;
        if (wantsAccess) {
          const { data, error } = await supabase.functions.invoke("create-user", {
            body: { nome: nome.trim(), email: emailNorm, senha, role: "usuario" },
          });
          if (error) throw new Error(error.message || "Falha ao criar acesso");
          if ((data as any)?.error) throw new Error((data as any).error);
          userId = (data as any)?.user?.id ?? null;
          if (!userId) throw new Error("Não foi possível criar o acesso do membro");
        }

        const payload: any = {
          empresa_id: empresaId,
          nome: nome.trim(),
          perfil,
          telefone: telefone || null,
          email: emailNorm || null,
          user_id: userId,
          convite_status: wantsAccess ? "ativo" : "pendente",
        };
        const { error } = await supabase.from("syncvet_equipe").insert(payload);
        if (error) throw error;
        toast.success(wantsAccess ? "Membro adicionado com acesso" : "Membro adicionado");
        setOpen(false); load();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: Membro) {
    if (!confirm(`Remover ${m.nome}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("syncvet-delete-equipe", {
        body: { equipe_id: m.id },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.deactivated) {
        toast.success("Este membro tem histórico de manejos e não pode ser excluído — foi desativado em vez disso.");
      } else {
        toast.success("Removido");
      }
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover");
    }
  }

  async function handleReactivate(m: Membro) {
    const { error } = await supabase.from("syncvet_equipe").update({ ativo: true }).eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Reativado"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">Membros da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar membro" : "Novo membro"}</DialogTitle>
              <DialogDescription>
                Preencha e-mail e senha para dar acesso ao app. Sem acesso, o membro será apenas listado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div>
                <Label className="text-xs">Perfil</Label>
                <Select value={perfil} onValueChange={(v) => setPerfil(v as Perfil)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERFIL_LABEL) as Perfil[]).map((p) => (
                      <SelectItem key={p} value={p}>{PERFIL_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground">
                  <KeyRound className="w-3.5 h-3.5" /> Acesso ao app
                </div>
                <div><Label className="text-xs">E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com"
                    disabled={!!editing && !!editing.user_id} />
                  {editing?.user_id && (
                    <p className="text-[10px] text-muted-foreground mt-1">O e-mail vinculado a um acesso ativo não pode ser alterado aqui.</p>
                  )}
                </div>
                {!editing && (
                  <div className="mt-2">
                    <Label className="text-xs">Senha {email ? "*" : "(opcional)"}</Label>
                    <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum membro cadastrado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Card key={m.id} className={cn("p-3 flex items-center justify-between", !m.ativo && "opacity-60")}>
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {m.nome}
                  {!m.ativo && <span className="inline-flex items-center text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inativo</span>}
                  {m.ativo && m.user_id && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded"><KeyRound className="w-3 h-3" />acesso</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {PERFIL_LABEL[m.perfil]}
                  {m.email ? ` • ${m.email}` : ""}
                  {m.telefone ? ` • ${m.telefone}` : ""}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {m.ativo ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}><Trash2 className="w-4 h-4" /></Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleReactivate(m)}>Reativar</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
