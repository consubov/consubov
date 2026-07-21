import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ChevronRight, ArrowLeft } from "lucide-react";

type Lote = {
  id: string;
  nome: string;
  categoria: string | null;
  quantidade_animais: number | null;
  observacoes: string | null;
};

export default function SyncVetFazendaDetalhePage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();
  const [fazendaNome, setFazendaNome] = useState("");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");

  async function load() {
    if (!fazendaId) return;
    setLoading(true);
    const [{ data: f }, { data: ls, error: lerr }] = await Promise.all([
      supabase.from("syncvet_fazendas").select("nome").eq("id", fazendaId).maybeSingle(),
      supabase.from("syncvet_lotes").select("*").eq("fazenda_id", fazendaId).order("nome"),
    ]);
    if (lerr) toast.error(lerr.message);
    setFazendaNome((f as any)?.nome ?? "");
    setLotes((ls as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [fazendaId]);

  function openNew() {
    setNome(""); setCategoria(""); setQtd(""); setObs("");
    setOpen(true);
  }

  async function handleSave() {
    if (!fazendaId) return;
    if (!nome.trim()) { toast.error("Nome do lote é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("syncvet_lotes").insert({
      fazenda_id: fazendaId,
      nome: nome.trim(),
      categoria: categoria || null,
      quantidade_animais: qtd ? Number(qtd) : null,
      observacoes: obs || null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Lote criado"); setOpen(false); load(); }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/syncvet/fazendas")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{fazendaNome || "Fazenda"}</h1>
          <p className="text-sm text-muted-foreground">Lotes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo lote</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo lote</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div><Label className="text-xs">Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Novilhas, Vacas em lactação" /></div>
              <div><Label className="text-xs">Quantidade de animais</Label><Input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
              <div><Label className="text-xs">Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
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
      ) : lotes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum lote cadastrado nesta fazenda.</Card>
      ) : (
        <div className="space-y-2">
          {lotes.map((l) => (
            <Card
              key={l.id}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/syncvet/fazendas/${fazendaId}/lotes/${l.id}`)}
            >
              <div>
                <div className="font-semibold">{l.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {[l.categoria, l.quantidade_animais ? `${l.quantidade_animais} animais` : null]
                    .filter(Boolean).join(" • ")}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
