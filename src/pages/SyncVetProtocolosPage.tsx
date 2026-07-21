import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronRight, Workflow } from "lucide-react";

type Proto = { id: string; nome: string; descricao: string | null };

export default function SyncVetProtocolosPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Proto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_protocolos")
      .select("id, nome, descricao")
      .eq("empresa_id", empresaId)
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as Proto[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  async function handleCreate() {
    if (!empresaId) return;
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("syncvet_protocolos")
      .insert({ empresa_id: empresaId, nome: nome.trim(), descricao: descricao || null } as any)
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Protocolo criado");
    setOpen(false); setNome(""); setDescricao("");
    navigate(`/syncvet/protocolos/${data!.id}`);
  }

  async function handleDelete(p: Proto) {
    if (!confirm(`Remover protocolo "${p.nome}"?`)) return;
    const { error } = await supabase.from("syncvet_protocolos").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Protocolos</h1>
          <p className="text-sm text-muted-foreground">Montador de protocolos reprodutivos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Novo Protocolo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo protocolo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: IATF Padrão 10 dias" /></div>
              <div><Label className="text-xs">Descrição</Label><Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum protocolo cadastrado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Workflow className="w-5 h-5" />
              </div>
              <button className="flex-1 text-left min-w-0" onClick={() => navigate(`/syncvet/protocolos/${p.id}`)}>
                <div className="font-semibold truncate">{p.nome}</div>
                {p.descricao && <div className="text-xs text-muted-foreground truncate">{p.descricao}</div>}
              </button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}><Trash2 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/syncvet/protocolos/${p.id}`)}><ChevronRight className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
