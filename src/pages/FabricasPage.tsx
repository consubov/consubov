import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, Factory, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Fabrica {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  qr_code: string | null;
  ativo: boolean | null;
}

const emptyForm = { nome: "", descricao: "", ativo: true };

export default function FabricasPage() {
  const navigate = useNavigate();
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Fabrica | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("fabricas").select("*").order("codigo");
    setFabricas((data as Fabrica[]) || []);
    setLoading(false);
  }

  function openNew() { setForm(emptyForm); setDialogOpen(true); }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("fabricas").insert({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      }).select().single();
      if (error) throw error;
      if (data && !data.qr_code) {
        await supabase.from("fabricas").update({ qr_code: data.id }).eq("id", data.id);
      }
      toast.success(`Fábrica criada: ${data?.codigo || ""}`);
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const fabricaId = confirmDel.id;
      // Apaga operadores vinculados
      const { error: opErr } = await supabase.from("operadores_fabrica").delete().eq("fabrica_id", fabricaId);
      if (opErr) throw opErr;
      // Apaga a fábrica
      const { error } = await supabase.from("fabricas").delete().eq("id", fabricaId);
      if (error) throw error;
      toast.success("Fábrica e operadores removidos.");
      setConfirmDel(null);
      load();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err?.message || "desconhecido"));
    } finally { setDeleting(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Factory className="w-5 h-5" /> Fábrica
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Fábrica
        </Button>
      </div>

      {fabricas.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma fábrica cadastrada.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fabricas.map(f => (
            <div key={f.id} className="relative">
              <button
                onClick={() => navigate(`/admin/fabricas/${f.id}`)}
                className="text-left w-full"
              >
                <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Factory className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight">{f.nome}</CardTitle>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{f.codigo || "—"}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                    {f.descricao && <p className="text-xs text-muted-foreground truncate ml-2 flex-1 text-right">{f.descricao}</p>}
                  </CardContent>
                </Card>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); setConfirmDel(f); }}
                title="Excluir fábrica"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Fábrica</DialogTitle>
            <DialogDescription>O código e QR Code são gerados automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
