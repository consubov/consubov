import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, MapPin, ChevronRight, Landmark } from "lucide-react";
import { toast } from "sonner";

interface Fazenda {
  id: string;
  nome_fazenda: string;
  proprietario: string | null;
  responsavel: string | null;
  municipio: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Form {
  nome_fazenda: string;
  proprietario: string;
  responsavel: string;
  municipio: string;
  uf: string;
  latitude: string;
  longitude: string;
}

const emptyForm: Form = { nome_fazenda: "", proprietario: "", responsavel: "", municipio: "", uf: "", latitude: "", longitude: "" };

export default function ConsultorFazendasPage() {
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (roleData?.consultorId) load(); }, [roleData?.consultorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("fazendas_consultor")
      .select("*")
      .eq("consultor_id", roleData.consultorId!)
      .order("nome_fazenda");
    setFazendas((data as Fazenda[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.nome_fazenda.trim()) return toast.error("Nome da fazenda é obrigatório");
    setSaving(true);
    try {
      const { error } = await supabase.from("fazendas_consultor").insert({
        consultor_id: roleData.consultorId!,
        nome_fazenda: form.nome_fazenda.trim(),
        proprietario: form.proprietario.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      if (error) throw error;
      toast.success("Fazenda cadastrada!");
      setDialogOpen(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Minhas Fazendas
        </h1>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      {fazendas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma fazenda cadastrada ainda.<br />Toque em "Nova" para começar.
        </Card>
      ) : (
        <div className="space-y-2">
          {fazendas.map(f => (
            <Card
              key={f.id}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/consultor/fazendas/${f.id}`)}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{f.nome_fazenda}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  {f.proprietario && <span>{f.proprietario}</span>}
                  {f.proprietario && (f.municipio || f.uf) && <span>·</span>}
                  {(f.municipio || f.uf) && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {[f.municipio, f.uf].filter(Boolean).join("/")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Fazenda</DialogTitle>
            <DialogDescription>Cadastre uma fazenda que você atende como consultor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da fazenda *</Label><Input value={form.nome_fazenda} onChange={e => setForm(f => ({ ...f, nome_fazenda: e.target.value }))} /></div>
            <div><Label>Proprietário</Label><Input value={form.proprietario} onChange={e => setForm(f => ({ ...f, proprietario: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
            </div>
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
