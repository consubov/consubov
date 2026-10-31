import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";
import { camposProdutoParaRetiro, type ProdutoParaRetiro } from "@/lib/retiroProduto";
import { executarEmLotes } from "@/lib/execucaoEmLotes";

interface Produto extends ProdutoParaRetiro { id: string; nome: string; marca: string | null }
interface RetiroRow { id: string; nome: string; produto_id: string | null }
interface PastoRow { id: string; nome: string; produto_id: string | null; retiro_id: string; num_animais: number; categoria: string | null }

const SEGUIR = "__seguir__";
const TODOS = "__todos__";
const byNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
const cor = (i: number) => (i < 0 ? "hsl(var(--muted-foreground))" : `hsl(var(--produto-${(i % 8) + 1}))`);

interface Props { fazendaId: string; retiroInicial?: string | null; onDirtyChange?: (d: boolean) => void }

export default function OndeUsarGerente({ fazendaId, retiroInicial, onDirtyChange }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [disponiveis, setDisponiveis] = useState<string[]>([]);
  const [retiros, setRetiros] = useState<RetiroRow[]>([]);
  const [pastos, setPastos] = useState<PastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fRetiro, setFRetiro] = useState(retiroInicial || TODOS);
  const [fProduto, setFProduto] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set(retiroInicial ? [retiroInicial] : []));
  const [retPend, setRetPend] = useState<Record<string, string>>({});
  const [pastoPend, setPastoPend] = useState<Record<string, string | null>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loteProduto, setLoteProduto] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seguirRetiro, setSeguirRetiro] = useState(true);
  const [saving, setSaving] = useState(false);


  const load = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    const [rRes, ids, prRes] = await Promise.all([
      supabase.from("retiros").select("id, nome, produto_id").eq("fazenda_id", fazendaId).eq("ativo", true),
      fetchProdutoIdsDaFazenda(fazendaId),
      supabase.from("produtos").select("*").order("nome"),
    ]);
    const rets = ((rRes.data ?? []) as RetiroRow[]).sort(byNome);
    const { data: pData } = rets.length
      ? await supabase.from("pastos").select("id, nome, produto_id, retiro_id, num_animais, categoria").in("retiro_id", rets.map((r) => r.id)).eq("ativo", true)
      : { data: [] };
    setRetiros(rets);
    setPastos(((pData ?? []) as PastoRow[]).sort(byNome));
    setProdutos((prRes.data ?? []) as Produto[]);
    setDisponiveis(ids ?? []);
    setRetPend({}); setPastoPend({}); setSel(new Set()); setSeguirRetiro(true);
    setLoading(false);
  }, [fazendaId]);

  useEffect(() => { load(); }, [load]);

  const prodById = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos]);
  const nomeProd = (id: string | null | undefined) => {
    if (!id) return "sem produto";
    const p = prodById[id];
    return p ? p.nome : "outro produto";
  };
  const produtosDisp = useMemo(() => produtos.filter((p) => disponiveis.includes(p.id) && (p as any).ativo !== false), [produtos, disponiveis]);
  // Cor fixa por produto: ordem estável por nome entre todos os produtos usados/disponíveis.
  const corIdx = useMemo(() => {
    const usados = new Set<string>([...disponiveis, ...retiros.map((r) => r.produto_id), ...pastos.map((p) => p.produto_id)].filter(Boolean) as string[]);
    const lista = produtos.filter((p) => usados.has(p.id)).sort(byNome);
    return Object.fromEntries(lista.map((p, i) => [p.id, i])) as Record<string, number>;
  }, [produtos, disponiveis, retiros, pastos]);
  const corDe = (id: string | null | undefined) => cor(id ? corIdx[id] ?? -1 : -1);

  const retProd = (r: RetiroRow) => retPend[r.id] ?? r.produto_id;
  const retiroById = useMemo(() => Object.fromEntries(retiros.map((r) => [r.id, r])), [retiros]);
  const proprio = (p: PastoRow) => (p.id in pastoPend ? pastoPend[p.id] : p.produto_id);
  const efetivo = (p: PastoRow) => proprio(p) ?? (retiroById[p.retiro_id] ? retProd(retiroById[p.retiro_id]) : null);

  const pastosFiltrados = pastos.filter((p) =>
    (fRetiro === TODOS || p.retiro_id === fRetiro) &&
    (fProduto === TODOS || efetivo(p) === fProduto) &&
    (!busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())));

  const resumo = useMemo(() => {
    const c: Record<string, number> = {};
    pastos.forEach((p) => { if (fRetiro !== TODOS && p.retiro_id !== fRetiro) return; const e = efetivo(p); if (e) c[e] = (c[e] ?? 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastos, retiros, retPend, pastoPend, fRetiro]);

  // Mudanças pendentes
  const retirosMudados = retiros.filter((r) => retPend[r.id] && retPend[r.id] !== r.produto_id);
  const pastosMudados = pastos.filter((p) => p.id in pastoPend && (pastoPend[p.id] ?? null) !== (p.produto_id ?? null));
  const conflitos = pastos.filter((p) => {
    const r = retirosMudados.find((x) => x.id === p.retiro_id);
    if (!r) return false;
    const own = proprio(p);
    return !!own && own !== retPend[r.id];
  });
  const conflitosALimpar = seguirRetiro ? conflitos : [];
  const qtdPend = retirosMudados.length + pastosMudados.length;
  useEffect(() => { onDirtyChange?.(qtdPend > 0); }, [qtdPend, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function setPastoProduto(ids: string[], valor: string) {
    setPastoPend((prev) => {
      const n = { ...prev };
      ids.forEach((id) => { n[id] = valor === SEGUIR ? null : valor; });
      return n;
    });
  }

  function aplicarLote() {
    if (!loteProduto) return;
    setPastoProduto(Array.from(sel), loteProduto);
    setSel(new Set()); setLoteProduto("");
  }

  const linhasResumo = retiros.flatMap((r) => {
    const partes: string[] = [];
    if (retirosMudados.includes(r)) partes.push(`Retiro ${r.nome}: ${nomeProd(r.produto_id)} → ${nomeProd(retPend[r.id])}`);
    const conf = new Set(conflitosALimpar.filter((p) => p.retiro_id === r.id).map((p) => p.id));
    const mud = pastosMudados.filter((p) => p.retiro_id === r.id && !conf.has(p.id));
    const seguir = [...mud.filter((p) => pastoPend[p.id] === null), ...pastos.filter((p) => conf.has(p.id))].map((p) => p.nome);
    const porProd: Record<string, string[]> = {};
    mud.filter((p) => pastoPend[p.id]).forEach((p) => { (porProd[pastoPend[p.id]!] ??= []).push(p.nome); });
    if (seguir.length) partes.push(`${seguir.join(", ")} ${seguir.length > 1 ? "passam" : "passa"} a seguir o retiro`);
    Object.entries(porProd).forEach(([pid, nomes]) => partes.push(`${nomes.join(", ")} → ${nomeProd(pid)}`));
    if (!partes.length) return [];
    if (!retirosMudados.includes(r)) partes[0] = `Retiro ${r.nome}: ${partes[0]}`;
    return [partes.join(" · ")];
  });

  async function executar() {
    setSaving(true);
    try {
      // Gravações independentes em lotes limitados; só avançar depois que
      // todas as gravações iniciadas terminarem, inclusive em caso de erro.
      await executarEmLotes(retirosMudados, async (r) => {
        const pid = retPend[r.id];
        const campos = camposProdutoParaRetiro(prodById[pid], pid, {
          peso_saco_kg: null, preco_por_kg: null,
          consumo_recria1: null, consumo_recria2: null, consumo_engorda: null,
          margem_recria1: null, margem_recria2: null, margem_engorda: null,
        });
        const { error } = await supabase.from("retiros").update(campos as any).eq("id", r.id).eq("fazenda_id", fazendaId);
        if (error) throw new Error(`retiro ${r.nome}: ${error.message}`);
      });
      const conf = new Set(conflitosALimpar.map((p) => p.id));
      // Pastos: mesma gravação da PastoDetailPage (produto_id ou null).
      await executarEmLotes(pastosMudados.filter((p) => !conf.has(p.id)), async (p) => {
        const { error } = await supabase.from("pastos").update({ produto_id: pastoPend[p.id] ?? null }).eq("id", p.id).eq("retiro_id", p.retiro_id);
        if (error) throw new Error(`pasto ${p.nome}: ${error.message}`);
      });
      if (conf.size > 0) {
        const { error } = await supabase.from("pastos").update({ produto_id: null }).in("id", Array.from(conf)).in("retiro_id", retiros.map((r) => r.id));
        if (error) throw new Error(`pastos seguindo o retiro: ${error.message}`);
      }
      toast.success("Alterações salvas!");
      setConfirmOpen(false);
      await load();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  const Chip = ({ id, heranca }: { id: string | null; heranca?: boolean }) => (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary-foreground max-w-[10rem] truncate"
      style={{ backgroundColor: corDe(id) }}>
      <span className="truncate">{nomeProd(id)}</span>{heranca && <span className="opacity-80">(retiro)</span>}
    </span>
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const retirosVisiveis = retiros.filter((r) => fRetiro === TODOS || r.id === fRetiro)
    .filter((r) => pastosFiltrados.some((p) => p.retiro_id === r.id) || (fProduto === TODOS && !busca.trim()));
  const todosSel = pastosFiltrados.length > 0 && pastosFiltrados.every((p) => sel.has(p.id));
  const barra = sel.size > 0 || qtdPend > 0;

  return (
    <div className={barra ? "pb-36" : ""}>
      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <Select value={fRetiro} onValueChange={setFRetiro}>
          <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os retiros</SelectItem>
            {retiros.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fProduto} onValueChange={setFProduto}>
          <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os produtos</SelectItem>
            {produtosDisp.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-44 shrink-0">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pasto" className="pl-8" />
        </div>
      </div>

      {produtosDisp.length === 0 && <p className="text-xs text-muted-foreground mb-2">{MSG_FAZENDA_SEM_PRODUTO}</p>}

      {/* Resumo */}
      <div className="flex flex-wrap gap-1.5 my-2">
        {resumo.map(([pid, n]) => (
          <button key={pid} type="button" onClick={() => setFProduto(fProduto === pid ? TODOS : pid)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity ${fProduto !== TODOS && fProduto !== pid ? "opacity-40" : ""}`}
            style={{ backgroundColor: corDe(pid) }}>
            {nomeProd(pid)} · {n} {n === 1 ? "pasto" : "pastos"}
          </button>
        ))}
      </div>

      {pastosFiltrados.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Checkbox id="sel-todos" checked={todosSel}
            onCheckedChange={() => setSel(todosSel ? new Set() : new Set(pastosFiltrados.map((p) => p.id)))} />
          <Label htmlFor="sel-todos" className="text-sm cursor-pointer">Selecionar todos (filtrados)</Label>
        </div>
      )}

      <div className="space-y-2">
        {retirosVisiveis.map((r) => {
          const ps = pastosFiltrados.filter((p) => p.retiro_id === r.id);
          const rp = retProd(r);
          const nProd = new Set(pastos.filter((p) => p.retiro_id === r.id).map(efetivo).filter(Boolean)).size;
          const aberto = abertos.has(r.id) || fProduto !== TODOS || !!busca.trim();
          return (
            <div key={r.id} className={`rounded-lg border bg-card ${retirosMudados.includes(r) ? "border-secondary" : ""}`}>
              <div className="p-3 space-y-2">
                <button type="button" className="w-full flex items-center gap-2 text-left"
                  onClick={() => setAbertos((prev) => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>
                  <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? "" : "-rotate-90"}`} />
                  <span className="font-semibold text-sm">{r.nome}</span>
                  {nProd > 1 && <Badge variant="outline" className="text-[10px]">Usa {nProd} produtos</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{pastos.filter((p) => p.retiro_id === r.id).length} pastos</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Produto do retiro:</span>
                  <Select value={rp ?? ""} onValueChange={(v) => setRetPend((prev) => ({ ...prev, [r.id]: v }))}>
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mr-1.5" style={{ backgroundColor: corDe(rp) }} />
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosDisp.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      {rp && !produtosDisp.some((p) => p.id === rp) && <SelectItem value={rp} disabled>{nomeProd(rp)}</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {aberto && (
                <div className="border-t divide-y">
                  {ps.length === 0 && <p className="text-xs text-muted-foreground p-3">Nenhum pasto.</p>}
                  {ps.map((p) => {
                    const own = proprio(p);
                    const pend = pastosMudados.includes(p);
                    return (
                      <div key={p.id} className={`flex items-center gap-2 px-3 py-2 ${pend ? "bg-secondary/15" : ""}`}>
                        <Checkbox checked={sel.has(p.id)}
                          onCheckedChange={() => setSel((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.num_animais} cab · {p.categoria || "sem categoria"}</p>
                        </div>
                        <Select value={own ?? SEGUIR} onValueChange={(v) => setPastoProduto([p.id], v)}>
                          <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                            <Chip id={efetivo(p)} heranca={!own} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEGUIR}>Seguir o retiro</SelectItem>
                            {produtosDisp.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra fixa */}
      {barra && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-card p-3 space-y-2 shadow-lg">
          {sel.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium shrink-0">{sel.size} {sel.size === 1 ? "pasto selecionado" : "pastos selecionados"}</span>
              <Select value={loteProduto} onValueChange={setLoteProduto}>
                <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue placeholder="Aplicar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEGUIR}>Seguir o retiro</SelectItem>
                  {produtosDisp.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!loteProduto} onClick={aplicarLote}>Aplicar</Button>
            </div>
          )}
          {qtdPend > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setRetPend({}); setPastoPend({}); }}>Descartar</Button>
              <Button size="sm" className="flex-1" onClick={() => { setSeguirRetiro(true); setConfirmOpen(true); }}>Salvar alterações ({qtdPend})</Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {linhasResumo.map((l, i) => <p key={i}>{l}</p>)}
                {conflitos.length > 0 && (
                  <div className="rounded-md border p-2 space-y-1">
                    <p className="text-xs">Pastos com produto próprio diferente do novo produto do retiro: {conflitos.map((c) => c.nome).join(", ")}</p>
                    <div className="flex items-center gap-2">
                      <Checkbox id="ou-seguir" checked={seguirRetiro} onCheckedChange={(c) => setSeguirRetiro(c === true)} />
                      <Label htmlFor="ou-seguir" className="text-sm font-normal cursor-pointer">Fazer esses pastos seguirem o produto do retiro</Label>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); executar(); }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
