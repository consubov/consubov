import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { maFrom, maGetUser } from "@/lib/maOffline";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Search, Landmark, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { enqueueMa, getMaPendingRows, mergeMaRows } from "@/lib/maisArrobasQueue";

interface Fazenda {
  id: string;
  nome_fazenda: string;
  cidade: string | null;
  uf: string | null;
}

export default function PecuaristaFazendasPage() {
  const { user, roleData } = useAuth();
  const navigate = useNavigate();
  const [pecuaristaId, setPecuaristaId] = useState<string | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", cidade: "", uf: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const pid = roleData.roleId ?? (await maFrom("pecuaristas").select("id").eq("user_id", user.id).maybeSingle()).data?.id ?? null;
      setPecuaristaId(pid);
      if (pid) await load(pid);
      else setLoading(false);
    })();
  }, [user, roleData.roleId]);

  async function load(pid: string) {
    setLoading(true);
    const { data } = await maFrom("fazendas_pecuarista")
      .select("id, nome_fazenda, cidade, uf")
      .eq("pecuarista_id", pid)
      .order("nome_fazenda");
    const pending = await getMaPendingRows("fazendas_pecuarista");
    setFazendas(mergeMaRows((data as Fazenda[]) || [], pending as Fazenda[])
      .filter((fazenda: any) => fazenda.pecuarista_id === pid)
      .sort((a, b) => a.nome_fazenda.localeCompare(b.nome_fazenda, "pt-BR")));
    setLoading(false);
  }

  const filtered = useMemo(
    () => fazendas.filter(f => f.nome_fazenda.toLowerCase().includes(search.toLowerCase())),
    [fazendas, search],
  );

  async function handleSave() {
    if (!pecuaristaId) return;
    if (!form.nome.trim()) return toast.error("Nome da fazenda é obrigatório");
    setSaving(true);
    const id = crypto.randomUUID();
    const nova = {
      id,
      pecuarista_id: pecuaristaId,
      nome_fazenda: form.nome.trim(),
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
    };
    enqueueMa(id, { kind: "insert", table: "fazendas_pecuarista", row: nova });
    setFazendas((prev) => [...prev, nova].sort((a, b) => a.nome_fazenda.localeCompare(b.nome_fazenda, "pt-BR")));
    toast.success("Fazenda criada!");
    setDialogOpen(false);
    setForm({ nome: "", cidade: "", uf: "" });
    setSaving(false);
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Fazendas
        </h1>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Fazenda
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar fazenda..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma fazenda cadastrada.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <Card key={f.id} onClick={() => navigate(`/pecuarista/fazendas/${f.id}`)} className="p-4 cursor-pointer hover:border-primary/40 flex items-center justify-between">
              <div>
                <div className="font-semibold">{f.nome_fazenda}</div>
                <div className="text-sm text-muted-foreground">
                  {[f.cidade, f.uf].filter(Boolean).join(" - ") || "—"}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Fazenda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da fazenda *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
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
