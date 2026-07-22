import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, DollarSign } from "lucide-react";

type Preco = {
  id: string;
  tipo_servico: string;
  descricao: string | null;
  valor: number;
  unidade: string;
};

const TIPOS = [
  { v: "dg", label: "DG (Diagnóstico de gestação)" },
  { v: "iatf", label: "IATF" },
  { v: "km", label: "Km rodado" },
  { v: "diaria", label: "Diária" },
  { v: "visita", label: "Visita" },
  { v: "outro", label: "Outro" },
];
const UNIDADES = [
  { v: "por_cabeca", label: "por cabeça" },
  { v: "por_km", label: "por km" },
  { v: "por_dia", label: "por dia" },
  { v: "por_visita", label: "por visita" },
];

export default function SyncVetPrecosPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [vetId, setVetId] = useState<string | null>(null);
  const [rows, setRows] = useState<Preco[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preco | null>(null);

  const [tipo, setTipo] = useState("dg");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState("por_cabeca");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data: eq } = await supabase.from("syncvet_equipe")
      .select("id").eq("empresa_id", empresaId).eq("user_id", user.id).eq("ativo", true).maybeSingle();
    const id = (eq as { id: string } | null)?.id ?? null;
    setVetId(id);
    if (!id) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase.from("syncvet_tabela_precos")
      .select("id, tipo_servico, descricao, valor, unidade")
      .eq("veterinario_id", id)
      .order("tipo_servico");
    if (error) toast.error(error.message);
    setRows((data as Preco[]) ?? []);
    setLoading(false);
  }, [user?.id, empresaId]);

  useEffect(() => { void load(); }, [load]);

  function reset() {
    setEditing(null); setTipo("dg"); setDescricao(""); setValor(""); setUnidade("por_cabeca");
  }
  function openEdit(r: Preco) {
    setEditing(r); setTipo(r.tipo_servico); setDescricao(r.descricao ?? "");
    setValor(String(r.valor)); setUnidade(r.unidade); setOpen(true);
  }

  async function save() {
    if (!vetId) return;
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      const payload = { veterinario_id: vetId, tipo_servico: tipo, descricao: descricao || null, valor: v, unidade };
      if (editing) {
        const { error } = await supabase.from("syncvet_tabela_precos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("syncvet_tabela_precos").insert(payload);
        if (error) throw error;
      }
      toast.success("Salvo");
      setOpen(false); reset(); void load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Excluir este preço?")) return;
    const { error } = await supabase.from("syncvet_tabela_precos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); void load();
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Preco[]>();
    rows.forEach(r => {
      const arr = m.get(r.tipo_servico) || [];
      arr.push(r); m.set(r.tipo_servico, arr);
    });
    return Array.from(m.entries());
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Tabela de Preços
        </h1>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }} disabled={!vetId}>
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !vetId ? (
        <Card className="p-6 text-sm text-center text-muted-foreground">Seu usuário não está vinculado a nenhuma equipe syncvet.</Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-center text-muted-foreground">Nenhum preço cadastrado. Adicione o primeiro.</Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([tipoV, items]) => (
            <div key={tipoV} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {TIPOS.find(t => t.v === tipoV)?.label ?? tipoV}
              </div>
              {items.map(r => (
                <Card key={r.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.descricao || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {UNIDADES.find(u => u.v === r.unidade)?.label ?? r.unidade}
                    </div>
                  </div>
                  <div className="text-base font-bold text-primary">
                    {r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar preço" : "Novo preço"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de serviço</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: DG por US" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u.v} value={u.v}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
