import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Loader2, ArrowLeft, Archive, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS_PADRAO: Array<{ slug: string; label: string }> = [
  { slug: "boi_gordo", label: "Boi Gordo" },
  { slug: "vaca_gorda", label: "Vaca Gorda" },
  { slug: "vaca_magra", label: "Vaca Magra" },
  { slug: "boi_magro", label: "Boi Magro" },
  { slug: "garrote", label: "Garrote" },
  { slug: "novilha", label: "Novilha" },
  { slug: "bezerro", label: "Bezerro" },
  { slug: "bezerra", label: "Bezerra" },
];

interface Lote {
  id: string;
  codigo: string;
  nome_lote: string;
  categoria: string;
  categoria_customizada_id: string | null;
  identificado: boolean;
  status: string;
  encerrado_at: string | null;
  ultima_data?: string | null;
  ultimo_gmd?: number | null;
}

interface CatCustom { id: string; nome: string; }

export default function PecuaristaFazendaDetalhePage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pecuaristaId, setPecuaristaId] = useState<string | null>(null);
  const [fazendaNome, setFazendaNome] = useState("");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [customCats, setCustomCats] = useState<CatCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasPesagens, setEditingHasPesagens] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    categoriaSlug: "boi_gordo" as string,
    categoriaCustomizadaId: "" as string,
    novaCategoria: "" as string,
    criandoNova: false,
    identificado: "sim" as "sim" | "nao",
  });

  useEffect(() => {
    if (!user || !fazendaId) return;
    (async () => {
      const { data: p } = await supabase.from("pecuaristas").select("id").eq("user_id", user.id).maybeSingle();
      const pid = (p as any)?.id ?? null;
      setPecuaristaId(pid);
      if (!pid) { setLoading(false); return; }
      const { data: fz } = await supabase.from("fazendas_pecuarista").select("nome_fazenda").eq("id", fazendaId).maybeSingle();
      setFazendaNome((fz as any)?.nome_fazenda ?? "");
      await Promise.all([loadLotes(), loadCats(pid)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fazendaId]);

  async function loadLotes() {
    if (!fazendaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("lotes_pecuarista")
      .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, status, encerrado_at")
      .eq("fazenda_id", fazendaId)
      .order("created_at", { ascending: false });
    const base = (data as Lote[]) || [];
    // fetch last pesagem por lote
    const ids = base.map((l) => l.id);
    let mapa: Record<string, { data: string; gmd: number | null }> = {};
    if (ids.length > 0) {
      const { data: ps } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("lote_id, data_pesagem, gmd")
        .in("lote_id", ids)
        .gt("quantidade_animais", 0)
        .order("data_pesagem", { ascending: false });
      for (const row of (ps as any[]) ?? []) {
        if (!mapa[row.lote_id]) {
          mapa[row.lote_id] = { data: row.data_pesagem, gmd: row.gmd != null ? Number(row.gmd) : null };
        }
      }
    }
    setLotes(base.map((l) => ({
      ...l,
      ultima_data: mapa[l.id]?.data ?? null,
      ultimo_gmd: mapa[l.id]?.gmd ?? null,
    })));
    setLoading(false);
  }

  async function loadCats(pid: string) {
    const { data } = await supabase.from("categorias_pecuarista").select("id, nome").eq("pecuarista_id", pid).order("nome");
    setCustomCats((data as CatCustom[]) || []);
  }

  function labelCategoria(l: Lote) {
    if (l.categoria === "customizada") {
      return customCats.find(c => c.id === l.categoria_customizada_id)?.nome ?? "Personalizada";
    }
    return CATEGORIAS_PADRAO.find(c => c.slug === l.categoria)?.label ?? l.categoria;
  }

  async function nextCodigo(pid: string): Promise<string> {
    const { data } = await supabase
      .from("lotes_pecuarista")
      .select("codigo")
      .eq("pecuarista_id", pid);
    const usados = new Set((data ?? []).map((r: any) => r.codigo));
    for (let i = 1; i <= 999; i++) {
      const c = String(i).padStart(3, "0");
      if (!usados.has(c)) return c;
    }
    throw new Error("Limite de 999 lotes atingido");
  }

  async function handleSave() {
    if (!pecuaristaId || !fazendaId) return;
    if (!form.nome.trim()) return toast.error("Nome do lote é obrigatório");

    setSaving(true);
    try {
      let categoria = form.categoriaSlug;
      let categoria_customizada_id: string | null = null;

      if (form.criandoNova) {
        const nomeNova = form.novaCategoria.trim();
        if (!nomeNova) throw new Error("Informe o nome da nova categoria");
        const { data: cat, error: e1 } = await supabase
          .from("categorias_pecuarista")
          .insert({ pecuarista_id: pecuaristaId, nome: nomeNova })
          .select("id")
          .single();
        if (e1) throw e1;
        categoria = "customizada";
        categoria_customizada_id = (cat as any).id;
      } else if (form.categoriaSlug === "customizada") {
        if (!form.categoriaCustomizadaId) throw new Error("Selecione uma categoria personalizada");
        categoria_customizada_id = form.categoriaCustomizadaId;
      }

      const codigo = await nextCodigo(pecuaristaId);

      const { error } = await supabase.from("lotes_pecuarista").insert({
        pecuarista_id: pecuaristaId,
        fazenda_id: fazendaId,
        nome_lote: form.nome.trim(),
        codigo,
        categoria,
        categoria_customizada_id,
        identificado: form.identificado === "sim",
        status: "ativo",
      });
      if (error) throw error;
      toast.success(`Lote ${codigo} criado!`);
      setDialogOpen(false);
      setForm({ nome: "", categoriaSlug: "boi_gordo", categoriaCustomizadaId: "", novaCategoria: "", criandoNova: false, identificado: "sim" });
      await Promise.all([loadLotes(), loadCats(pecuaristaId)]);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function encerrar(id: string) {
    if (!confirm("Encerrar este lote?")) return;
    const { error } = await supabase
      .from("lotes_pecuarista")
      .update({ status: "encerrado", encerrado_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Lote encerrado"); loadLotes(); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pecuarista/fazendas")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold text-foreground flex-1">{fazendaNome || "Fazenda"}</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Adicionar Lote
        </Button>
      </div>

      {lotes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum lote cadastrado.</Card>
      ) : (
        <div className="space-y-2">
          {lotes.map(l => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${l.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{l.nome_lote}</span>
                    <Badge variant="outline" className="font-mono">#{l.codigo}</Badge>
                    <Badge variant={l.status === "ativo" ? "default" : "secondary"}>{l.status === "ativo" ? "Ativo" : "Encerrado"}</Badge>
                    {!l.identificado && <Badge variant="outline">Sem identificação</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{labelCategoria(l)}</div>
                  {l.ultima_data && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Última pesagem: {new Date(l.ultima_data).toLocaleDateString("pt-BR")}
                      {l.ultimo_gmd != null && ` • GMD ${l.ultimo_gmd.toFixed(3)} kg/dia`}
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {l.status === "ativo" && (
                    <Button variant="ghost" size="icon" onClick={() => encerrar(l.id)} title="Encerrar lote">
                      <Archive className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>

      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar Lote</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do lote *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>

            <div>
              <Label className="mb-2 block">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_PADRAO.map(c => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, categoriaSlug: c.slug, criandoNova: false, categoriaCustomizadaId: "" }))}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${!form.criandoNova && form.categoriaSlug === c.slug ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >{c.label}</button>
                ))}
                {customCats.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, categoriaSlug: "customizada", categoriaCustomizadaId: c.id, criandoNova: false }))}
                    className={`px-3 py-1.5 rounded-full text-xs border ${!form.criandoNova && form.categoriaSlug === "customizada" && form.categoriaCustomizadaId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >{c.nome}</button>
                ))}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, criandoNova: true }))}
                  className={`px-3 py-1.5 rounded-full text-xs border ${form.criandoNova ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >+ Criar nova categoria</button>
              </div>
              {form.criandoNova && (
                <Input className="mt-2" placeholder="Nome da nova categoria" value={form.novaCategoria} onChange={e => setForm(f => ({ ...f, novaCategoria: e.target.value }))} />
              )}
            </div>

            <div>
              <Label className="mb-2 block">Identificação</Label>
              <RadioGroup value={form.identificado} onValueChange={(v) => setForm(f => ({ ...f, identificado: v as "sim" | "nao" }))}>
                <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="ident-sim" /><Label htmlFor="ident-sim" className="font-normal cursor-pointer">Lote identificado</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="ident-nao" /><Label htmlFor="ident-nao" className="font-normal cursor-pointer">Lote sem identificação</Label></div>
              </RadioGroup>
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
