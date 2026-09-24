import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Loader2, ArrowLeft, Archive, ChevronRight, Pencil, Trash2, Search, Users, Settings } from "lucide-react";
import { toast } from "sonner";
import FazendaPecuaristaConfigModal from "@/components/FazendaPecuaristaConfigModal";
import { enqueueMa, getMaPendingRows, mergeMaRows, nextMaLoteCodigo } from "@/lib/maisArrobasQueue";

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split("?")[0];
}

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
  qtd_animais?: number | null;
}

interface CatCustom { id: string; nome: string; }

export default function PecuaristaFazendaDetalhePage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const { user, roleData } = useAuth();
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
  const [query, setQuery] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [loteParaApagar, setLoteParaApagar] = useState<Lote | null>(null);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    if (!user || !fazendaId) return;
    (async () => {
      const pid = roleData.roleId ?? (await supabase.from("pecuaristas").select("id").eq("user_id", user.id).maybeSingle()).data?.id ?? null;
      setPecuaristaId(pid);
      if (!pid) { setLoading(false); return; }
      const [{ data: fz }, fazendasPendentes] = await Promise.all([
        supabase.from("fazendas_pecuarista").select("nome_fazenda").eq("id", fazendaId).maybeSingle(),
        getMaPendingRows("fazendas_pecuarista"),
      ]);
      const fazendaLocal = fazendasPendentes.find((row) => row.id === fazendaId);
      setFazendaNome((fz as any)?.nome_fazenda ?? fazendaLocal?.nome_fazenda ?? "");
      await Promise.all([loadLotes(), loadCats(pid)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fazendaId, roleData.roleId]);

  async function loadLotes() {
    if (!fazendaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("lotes_pecuarista")
      .select("id, codigo, nome_lote, categoria, categoria_customizada_id, identificado, status, encerrado_at")
      .eq("fazenda_id", fazendaId)
      .order("created_at", { ascending: false });
    const pending = await getMaPendingRows("lotes_pecuarista");
    const base = mergeMaRows((data as Lote[]) || [], pending as Lote[])
      .filter((lote: any) => lote.fazenda_id === fazendaId);
    // fetch last pesagem por lote
    const ids = base.map((l) => l.id);
    let mapa: Record<string, { data: string; gmd: number | null; qtd: number | null }> = {};
    if (ids.length > 0) {
      const { data: ps } = await supabase
        .from("pesagens_lote_pecuarista")
        .select("lote_id, data_pesagem, gmd, quantidade_animais")
        .in("lote_id", ids)
        .gt("quantidade_animais", 0)
        .order("data_pesagem", { ascending: false });
      for (const row of (ps as any[]) ?? []) {
        if (!mapa[row.lote_id]) {
          mapa[row.lote_id] = {
            data: row.data_pesagem,
            gmd: row.gmd != null ? Number(row.gmd) : null,
            qtd: row.quantidade_animais != null ? Number(row.quantidade_animais) : null,
          };
        }
      }
    }
    setLotes(base.map((l) => ({
      ...l,
      ultima_data: mapa[l.id]?.data ?? null,
      ultimo_gmd: mapa[l.id]?.gmd ?? null,
      qtd_animais: mapa[l.id]?.qtd ?? null,
    })));
    setLoading(false);
  }

  async function loadCats(pid: string) {
    const [{ data }, pending] = await Promise.all([
      supabase.from("categorias_pecuarista").select("id, nome").eq("pecuarista_id", pid).order("nome"),
      getMaPendingRows("categorias_pecuarista"),
    ]);
    setCustomCats(mergeMaRows((data as CatCustom[]) || [], pending as CatCustom[])
      .filter((cat: any) => cat.pecuarista_id === pid)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
  }

  function labelCategoria(l: Lote) {
    if (l.categoria === "customizada") {
      return customCats.find(c => c.id === l.categoria_customizada_id)?.nome ?? "Personalizada";
    }
    return CATEGORIAS_PADRAO.find(c => c.slug === l.categoria)?.label ?? l.categoria;
  }

  async function nextCodigo(pid: string): Promise<string> {
    const [{ data }, pending] = await Promise.all([
      supabase
      .from("lotes_pecuarista")
      .select("codigo")
      .eq("pecuarista_id", pid),
      getMaPendingRows("lotes_pecuarista"),
    ]);
    const codigos = [
      ...(data ?? []).map((r: any) => r.codigo),
      ...pending.filter((r) => r.pecuarista_id === pid).map((r) => r.codigo),
    ];
    return nextMaLoteCodigo(codigos);
  }

  function resetForm() {
    setEditingId(null);
    setEditingHasPesagens(false);
    setForm({ nome: "", categoriaSlug: "boi_gordo", categoriaCustomizadaId: "", novaCategoria: "", criandoNova: false, identificado: "sim" });
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  async function openEdit(l: Lote) {
    const { count } = await supabase
      .from("pesagens_lote_pecuarista")
      .select("id", { count: "exact", head: true })
      .eq("lote_id", l.id);
    setEditingId(l.id);
    setEditingHasPesagens((count ?? 0) > 0);
    setForm({
      nome: l.nome_lote,
      categoriaSlug: l.categoria,
      categoriaCustomizadaId: l.categoria_customizada_id ?? "",
      novaCategoria: "",
      criandoNova: false,
      identificado: l.identificado ? "sim" : "nao",
    });
    setDialogOpen(true);
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
        const categoriaId = crypto.randomUUID();
        enqueueMa(categoriaId, { kind: "insert", table: "categorias_pecuarista", row: { id: categoriaId, pecuarista_id: pecuaristaId, nome: nomeNova } });
        categoria = "customizada";
        categoria_customizada_id = categoriaId;
      } else if (form.categoriaSlug === "customizada") {
        if (!form.categoriaCustomizadaId) throw new Error("Selecione uma categoria personalizada");
        categoria_customizada_id = form.categoriaCustomizadaId;
      }

      if (editingId) {
        const payload: any = {
          nome_lote: form.nome.trim(),
          categoria,
          categoria_customizada_id,
        };
        if (!editingHasPesagens) {
          payload.identificado = form.identificado === "sim";
        }
        const { error } = await supabase.from("lotes_pecuarista").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Lote atualizado!");
      } else {
        const codigo = await nextCodigo(pecuaristaId);
        const loteId = crypto.randomUUID();
        const novo = {
          id: loteId,
          pecuarista_id: pecuaristaId,
          fazenda_id: fazendaId,
          nome_lote: form.nome.trim(),
          codigo,
          categoria,
          categoria_customizada_id,
          identificado: form.identificado === "sim",
          status: "ativo",
          encerrado_at: null,
        };
        enqueueMa(loteId, { kind: "insert", table: "lotes_pecuarista", row: novo });
        setLotes((prev) => [{ ...novo, ultima_data: null, ultimo_gmd: null, qtd_animais: null }, ...prev]);
        toast.success(`Lote ${codigo} criado!`);
      }
      setDialogOpen(false);
      resetForm();
      if (editingId) await Promise.all([loadLotes(), loadCats(pecuaristaId)]);
      else void loadCats(pecuaristaId);
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

  async function apagar(l: Lote) {
    const [{ count: cPes }, { count: cOri }, { count: cDest }] = await Promise.all([
      supabase.from("pesagens_lote_pecuarista").select("id", { count: "exact", head: true }).eq("lote_id", l.id),
      supabase.from("apartacoes_pecuarista").select("id", { count: "exact", head: true }).eq("lote_origem_id", l.id),
      supabase.from("apartacao_destinos_pecuarista").select("id", { count: "exact", head: true }).eq("lote_destino_id", l.id),
    ]);
    const temHistorico = (cPes ?? 0) > 0 || (cOri ?? 0) > 0 || (cDest ?? 0) > 0;
    if (temHistorico) {
      setLoteParaApagar(l);
      return;
    }
    if (!confirm(`Tem certeza que deseja apagar o lote ${l.nome_lote}? Essa ação não pode ser desfeita.`)) return;
    await executarApagar(l);
  }

  async function executarApagar(l: Lote) {
    setApagando(true);
    try {
      const sb = supabase as any;
      const pdfPaths: string[] = [];

      // 1) Pesagens vinculadas diretamente ao lote
      const { data: pesagensLote } = await sb
        .from("pesagens_lote_pecuarista")
        .select("id, pdf_url")
        .eq("lote_id", l.id);
      const pesIdsLote = (pesagensLote ?? []).map((r: any) => r.id);
      for (const r of pesagensLote ?? []) {
        if (r.pdf_url) {
          const p = extractStoragePath(r.pdf_url, "relatorios");
          if (p) pdfPaths.push(p);
        }
      }

      // 2) Apartações onde o lote é origem
      const { data: apartOrigem } = await sb
        .from("apartacoes_pecuarista")
        .select("id, pdf_url")
        .eq("lote_origem_id", l.id);
      const apartIds = (apartOrigem ?? []).map((r: any) => r.id);
      for (const r of apartOrigem ?? []) {
        if (r.pdf_url) {
          const p = extractStoragePath(r.pdf_url, "relatorios");
          if (p) pdfPaths.push(p);
        }
      }

      // 3) Pesagens filhas das apartações
      let pesIdsApart: string[] = [];
      if (apartIds.length > 0) {
        const { data: pesFilhas } = await sb
          .from("pesagens_lote_pecuarista")
          .select("id, pdf_url")
          .in("apartacao_id", apartIds);
        pesIdsApart = (pesFilhas ?? []).map((r: any) => r.id);
        for (const r of pesFilhas ?? []) {
          if (r.pdf_url) {
            const p = extractStoragePath(r.pdf_url, "relatorios");
            if (p) pdfPaths.push(p);
          }
        }
      }

      const todasPesIds = Array.from(new Set([...pesIdsLote, ...pesIdsApart]));

      // 4) Apagar pesos individuais
      if (todasPesIds.length > 0) {
        await sb.from("pesos_animais_pecuarista").delete().in("pesagem_lote_id", todasPesIds);
        await sb.from("pesagens_lote_pecuarista").delete().in("id", todasPesIds);
      }

      // 5) Apagar destinos e apartações onde este lote participou
      if (apartIds.length > 0) {
        await sb.from("apartacao_destinos_pecuarista").delete().in("apartacao_id", apartIds);
        await sb.from("apartacao_lotes").delete().in("apartacao_id", apartIds);
        await sb.from("apartacoes_pecuarista").delete().in("id", apartIds);
      }
      // destinos onde este lote é destino (apartações que geraram este lote)
      await sb.from("apartacao_destinos_pecuarista").delete().eq("lote_destino_id", l.id);

      // 6) Animais vinculados a este lote
      await sb.from("animais_pecuarista").delete().eq("lote_atual_id", l.id);

      // 7) O próprio lote
      const { error } = await sb.from("lotes_pecuarista").delete().eq("id", l.id);
      if (error) throw error;

      // 8) Arquivos de Storage
      if (pdfPaths.length > 0) {
        await supabase.storage.from("relatorios").remove(pdfPaths);
      }

      toast.success("Lote e histórico apagados.");
      setLoteParaApagar(null);
      await loadLotes();
    } catch (e: any) {
      toast.error("Erro ao apagar: " + (e?.message || "desconhecido"));
    } finally {
      setApagando(false);
    }
  }



  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pecuarista/fazendas")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold text-foreground flex-1">{fazendaNome || "Fazenda"}</h1>
        <Button variant="ghost" size="icon" onClick={() => setConfigOpen(true)} title="Configurações da fazenda">
          <Settings className="w-4 h-4" />
        </Button>
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Adicionar Lote
        </Button>
      </div>

      <FazendaPecuaristaConfigModal open={configOpen} onOpenChange={setConfigOpen} fazendaId={fazendaId ?? null} />

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar lote pelo nome..."
          className="pl-9"
        />
      </div>

      {lotes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum lote cadastrado.</Card>
      ) : (() => {
        const q = query.trim().toLowerCase();
        const filtrados = q ? lotes.filter(l => l.nome_lote.toLowerCase().includes(q)) : lotes;
        if (filtrados.length === 0) {
          return <Card className="p-8 text-center text-muted-foreground">Nenhum lote encontrado para "{query}".</Card>;
        }
        return (
          <div className="space-y-2">
            {filtrados.map(l => (
              <Card key={l.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/pecuarista/fazendas/${fazendaId}/lotes/${l.id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{l.nome_lote}</span>
                      <Badge variant={l.status === "ativo" ? "default" : "secondary"}>{l.status === "ativo" ? "Ativo" : "Encerrado"}</Badge>
                      {!l.identificado && <Badge variant="outline">Sem identificação</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span>{labelCategoria(l)}</span>
                      {l.qtd_animais != null && l.qtd_animais > 0 && (
                        <span className="inline-flex items-center gap-1 text-foreground/80">
                          <Users className="w-3.5 h-3.5" /> {l.qtd_animais} animais
                        </span>
                      )}
                    </div>
                    {l.ultima_data && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Última pesagem: {new Date(l.ultima_data).toLocaleDateString("pt-BR")}
                        {l.ultimo_gmd != null && ` • GMD ${l.ultimo_gmd.toFixed(3)} kg/dia`}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)} title="Editar lote">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {l.status === "ativo" && (
                      <Button variant="ghost" size="icon" onClick={() => encerrar(l.id)} title="Encerrar lote">
                        <Archive className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => apagar(l)} title="Apagar lote">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        );
      })()}


      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Lote" : "Adicionar Lote"}</DialogTitle></DialogHeader>

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
              <RadioGroup value={form.identificado} onValueChange={(v) => setForm(f => ({ ...f, identificado: v as "sim" | "nao" }))} disabled={!!editingId && editingHasPesagens}>
                <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="ident-sim" /><Label htmlFor="ident-sim" className="font-normal cursor-pointer">Lote identificado</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="ident-nao" /><Label htmlFor="ident-nao" className="font-normal cursor-pointer">Lote sem identificação</Label></div>
              </RadioGroup>
              {editingId && editingHasPesagens && (
                <p className="text-xs text-muted-foreground mt-1">A identificação fica travada após a primeira pesagem para preservar o histórico.</p>
              )}
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

      <AlertDialog open={!!loteParaApagar} onOpenChange={(v) => { if (!v && !apagando) setLoteParaApagar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar lote {loteParaApagar?.nome_lote}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este lote tem pesagens registradas. Ao apagar, todo o histórico de peso e GMD desse lote será perdido permanentemente. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={apagando}
              onClick={(e) => { e.preventDefault(); if (loteParaApagar) void executarApagar(loteParaApagar); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {apagando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Apagar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
