import { useEffect, useState } from "react";
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
import { Loader2, Plus, Pencil, Trash2, Snowflake } from "lucide-react";

type Semen = {
  id: string;
  touro: string;
  central: string | null;
  raca: string | null;
  codigo: string | null;
  lote: string | null;
  observacoes: string | null;
};

export default function SyncVetSemenPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [rows, setRows] = useState<Semen[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Semen | null>(null);
  const [saving, setSaving] = useState(false);

  const [touro, setTouro] = useState("");
  const [central, setCentral] = useState("");
  const [raca, setRaca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [lote, setLote] = useState("");
  const [obs, setObs] = useState("");

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_semen")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("touro");
    if (error) toast.error(error.message);
    setRows((data as Semen[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  function reset() {
    setEditing(null);
    setTouro(""); setCentral(""); setRaca(""); setCodigo(""); setLote(""); setObs("");
  }
  function openNew() { reset(); setOpen(true); }
  function openEdit(s: Semen) {
    setEditing(s);
    setTouro(s.touro);
    setCentral(s.central ?? "");
    setRaca(s.raca ?? "");
    setCodigo(s.codigo ?? "");
    setLote(s.lote ?? "");
    setObs(s.observacoes ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (!empresaId) return;
    if (!touro.trim()) { toast.error("Touro é obrigatório"); return; }
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      touro: touro.trim(),
      central: central || null,
      raca: raca || null,
      codigo: codigo || null,
      lote: lote || null,
      observacoes: obs || null,
    };
    if (editing) {
      const { error } = await supabase.from("syncvet_semen").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else { toast.success("Sêmen atualizado"); setOpen(false); load(); }
    } else {
      const { error } = await supabase.from("syncvet_semen").insert(payload as any);
      if (error) toast.error(error.message);
      else { toast.success("Sêmen adicionado"); setOpen(false); load(); }
    }
    setSaving(false);
  }

  async function handleDelete(s: Semen) {
    if (!confirm(`Remover ${s.touro}?`)) return;
    const { error } = await supabase.from("syncvet_semen").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sêmen</h1>
          <p className="text-sm text-muted-foreground">Biblioteca da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar sêmen" : "Novo sêmen"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Touro*</Label><Input value={touro} onChange={(e) => setTouro(e.target.value)} /></div>
              <div><Label className="text-xs">Central</Label><Input value={central} onChange={(e) => setCentral(e.target.value)} /></div>
              <div><Label className="text-xs">Raça</Label><Input value={raca} onChange={(e) => setRaca(e.target.value)} /></div>
              <div><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
              <div><Label className="text-xs">Lote</Label><Input value={lote} onChange={(e) => setLote(e.target.value)} /></div>
              <div><Label className="text-xs">Observações</Label><Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
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
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum sêmen cadastrado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Snowflake className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{s.touro}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[s.raca, s.central].filter(Boolean).join(" • ") || "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[s.codigo && `Cód. ${s.codigo}`, s.lote && `Lote ${s.lote}`].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
