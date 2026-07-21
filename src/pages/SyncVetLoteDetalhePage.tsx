import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ArrowLeft, Trash2 } from "lucide-react";

type Animal = {
  id: string;
  brinco: string | null;
  numero: string | null;
  categoria: string | null;
  raca: string | null;
  idade: number | null;
};

export default function SyncVetLoteDetalhePage() {
  const { fazendaId, loteId } = useParams<{ fazendaId: string; loteId: string }>();
  const navigate = useNavigate();
  const [loteNome, setLoteNome] = useState("");
  const [rows, setRows] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [brinco, setBrinco] = useState("");
  const [numero, setNumero] = useState("");
  const [categoria, setCategoria] = useState("");
  const [raca, setRaca] = useState("");
  const [idade, setIdade] = useState("");

  async function load() {
    if (!loteId) return;
    setLoading(true);
    const [{ data: l }, { data: as, error }] = await Promise.all([
      supabase.from("syncvet_lotes").select("nome").eq("id", loteId).maybeSingle(),
      supabase.from("syncvet_animais").select("*").eq("lote_id", loteId).order("created_at"),
    ]);
    if (error) toast.error(error.message);
    setLoteNome((l as any)?.nome ?? "");
    setRows((as as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [loteId]);

  function openNew() {
    setBrinco(""); setNumero(""); setCategoria(""); setRaca(""); setIdade("");
    setOpen(true);
  }

  async function handleSave() {
    if (!loteId) return;
    setSaving(true);
    const { error } = await supabase.from("syncvet_animais").insert({
      lote_id: loteId,
      brinco: brinco || null,
      numero: numero || null,
      categoria: categoria || null,
      raca: raca || null,
      idade: idade ? Number(idade) : null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Animal cadastrado"); setOpen(false); load(); }
    setSaving(false);
  }

  async function handleDelete(a: Animal) {
    if (!confirm(`Remover animal ${a.brinco || a.numero || ""}?`)) return;
    const { error } = await supabase.from("syncvet_animais").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/syncvet/fazendas/${fazendaId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{loteNome || "Lote"}</h1>
          <p className="text-sm text-muted-foreground">Animais</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo animal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo animal</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Brinco</Label><Input value={brinco} onChange={(e) => setBrinco(e.target.value)} /></div>
              <div><Label className="text-xs">Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
              <div><Label className="text-xs">Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
              <div><Label className="text-xs">Raça</Label><Input value={raca} onChange={(e) => setRaca(e.target.value)} /></div>
              <div><Label className="text-xs">Idade (meses)</Label><Input type="number" value={idade} onChange={(e) => setIdade(e.target.value)} /></div>
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
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum animal cadastrado neste lote.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Card key={a.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {a.brinco || a.numero || "—"}
                  {a.brinco && a.numero ? <span className="text-muted-foreground font-normal"> • {a.numero}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[a.categoria, a.raca, a.idade ? `${a.idade} m` : null].filter(Boolean).join(" • ")}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
