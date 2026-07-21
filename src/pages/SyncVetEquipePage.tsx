import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

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
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_equipe")
      .select("id, nome, perfil, telefone, ativo")
      .eq("empresa_id", empresaId)
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  function openNew() {
    setEditing(null);
    setNome(""); setPerfil("veterinario"); setTelefone("");
    setOpen(true);
  }
  function openEdit(m: Membro) {
    setEditing(m);
    setNome(m.nome); setPerfil(m.perfil); setTelefone(m.telefone ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (!empresaId) return;
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      nome: nome.trim(),
      perfil,
      telefone: telefone || null,
    };
    if (editing) {
      const { error } = await supabase.from("syncvet_equipe").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else { toast.success("Membro atualizado"); setOpen(false); load(); }
    } else {
      const { error } = await supabase.from("syncvet_equipe").insert(payload as any);
      if (error) toast.error(error.message);
      else { toast.success("Membro adicionado"); setOpen(false); load(); }
    }
    setSaving(false);
  }

  async function handleDelete(m: Membro) {
    if (!confirm(`Remover ${m.nome}?`)) return;
    const { error } = await supabase.from("syncvet_equipe").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
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
            <DialogHeader><DialogTitle>{editing ? "Editar membro" : "Novo membro"}</DialogTitle></DialogHeader>
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
            <Card key={m.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{m.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {PERFIL_LABEL[m.perfil]}{m.telefone ? ` • ${m.telefone}` : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
