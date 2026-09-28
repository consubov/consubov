import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { salvarVinculosProduto } from "@/lib/produtosFazenda";
import { camposProdutoParaRetiro, type ProdutoParaRetiro } from "@/lib/retiroProduto";

interface Fazenda { id: string; nome: string }
interface RetiroRow { id: string; nome: string; produto_id: string | null; fazenda_id: string }
interface PastoRow { id: string; nome: string; produto_id: string | null; retiro_id: string }
interface ProdutoLite extends ProdutoParaRetiro { nome: string; marca: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  produto: ProdutoLite | null;
  fazendas: Fazenda[]; // fazendas do gerente (gerentes_fazendas)
  onSaved: () => void;
}

const byNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });

export default function VincularProdutoGerenteModal({ open, onClose, produto, fazendas, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filtroFaz, setFiltroFaz] = useState("todas");
  const [nomesProdutos, setNomesProdutos] = useState<Record<string, string>>({});
  const [vincAtual, setVincAtual] = useState<string[]>([]);
  const [retiros, setRetiros] = useState<RetiroRow[]>([]);
  const [pastos, setPastos] = useState<PastoRow[]>([]);
  const [fazSel, setFazSel] = useState<Set<string>>(new Set());
  const [retSel, setRetSel] = useState<Set<string>>(new Set());
  const [pastoSel, setPastoSel] = useState<Set<string>>(new Set());
  const [seguirRetiro, setSeguirRetiro] = useState(true);

  const pid = produto?.id ?? "";
  const fazIds = useMemo(() => fazendas.map((f) => f.id), [fazendas]);

  useEffect(() => {
    if (!open || !pid || fazIds.length === 0) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [vRes, rRes, prRes] = await Promise.all([
        (supabase as any).from("produtos_fazendas").select("fazenda_id").eq("produto_id", pid).in("fazenda_id", fazIds),
        supabase.from("retiros").select("id, nome, produto_id, fazenda_id").in("fazenda_id", fazIds).eq("ativo", true),
        supabase.from("produtos").select("id, nome, marca"),
      ]);
      const rets = ((rRes.data ?? []) as RetiroRow[]).sort(byNome);
      const { data: pData } = rets.length
        ? await supabase.from("pastos").select("id, nome, produto_id, retiro_id").in("retiro_id", rets.map((r) => r.id)).eq("ativo", true)
        : { data: [] as PastoRow[] };
      if (cancel) return;
      const ps = ((pData ?? []) as PastoRow[]).sort(byNome);
      const v = ((vRes.data ?? []) as { fazenda_id: string }[]).map((x) => x.fazenda_id);
      setNomesProdutos(Object.fromEntries(((prRes.data ?? []) as any[]).map((p) => [p.id, p.marca ? `${p.marca} — ${p.nome}` : p.nome])));
      setVincAtual(v);
      setRetiros(rets);
      setPastos(ps);
      setFazSel(new Set(v));
      setRetSel(new Set(rets.filter((r) => r.produto_id === pid).map((r) => r.id)));
      setPastoSel(new Set(ps.filter((p) => p.produto_id === pid).map((p) => p.id)));
      setSeguirRetiro(true);
      setFiltroFaz("todas");
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, pid, fazIds]);

  const nomeProd = (id: string | null) => (id ? nomesProdutos[id] ?? "outro produto" : "sem produto");
  const retiroById = useMemo(() => Object.fromEntries(retiros.map((r) => [r.id, r])), [retiros]);
  const usaNaFazenda = (fid: string) =>
    retiros.some((r) => r.fazenda_id === fid && r.produto_id === pid) ||
    pastos.some((p) => p.produto_id === pid && retiroById[p.retiro_id]?.fazenda_id === fid);

  // Retiros que passam a usar este produto
  const retirosNovos = retiros.filter((r) => retSel.has(r.id) && r.produto_id !== pid && fazSel.has(r.fazenda_id));
  // Pastos que passam a usar / deixam de usar este produto (produto próprio)
  const pastosNovos = pastos.filter((p) => pastoSel.has(p.id) && p.produto_id !== pid && fazSel.has(retiroById[p.retiro_id]?.fazenda_id));
  const pastosRemovidos = pastos.filter((p) => !pastoSel.has(p.id) && p.produto_id === pid);
  // Aviso reaproveitado do card da aba Retiros
  const conflitos = pastos.filter((p) => {
    if (!retirosNovos.some((r) => r.id === p.retiro_id)) return false;
    const efetivo = pastoSel.has(p.id) ? pid : (p.produto_id === pid ? null : p.produto_id);
    return !!efetivo && efetivo !== pid;
  });
  const conflitosALimpar = seguirRetiro ? conflitos : [];
  const fazAdd = fazendas.filter((f) => fazSel.has(f.id) && !vincAtual.includes(f.id));
  const fazRem = fazendas.filter((f) => !fazSel.has(f.id) && vincAtual.includes(f.id));
  const temMudanca = fazAdd.length + fazRem.length + retirosNovos.length + pastosNovos.length + pastosRemovidos.length + conflitosALimpar.length > 0;

  function toggle(set: Set<string>, id: string, fn: (s: Set<string>) => void) {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); fn(n);
  }

  async function executar() {
    if (!produto) return;
    setSaving(true);
    try {
      await salvarVinculosProduto(pid, Array.from(fazSel), fazIds);
      if (retirosNovos.length > 0) {
        const campos = camposProdutoParaRetiro(produto, pid, {
          peso_saco_kg: null, preco_por_kg: null,
          consumo_recria1: null, consumo_recria2: null, consumo_engorda: null,
          margem_recria1: null, margem_recria2: null, margem_engorda: null,
        });
        const { error } = await supabase.from("retiros").update(campos as any)
          .in("id", retirosNovos.map((r) => r.id)).in("fazenda_id", fazIds);
        if (error) throw new Error(`retiros: ${error.message}`);
      }
      if (pastosNovos.length > 0) {
        const { error } = await supabase.from("pastos").update({ produto_id: pid }).in("id", pastosNovos.map((p) => p.id));
        if (error) throw new Error(`pastos: ${error.message}`);
      }
      const limpar = [...pastosRemovidos, ...conflitosALimpar].map((p) => p.id);
      if (limpar.length > 0) {
        const { error } = await supabase.from("pastos").update({ produto_id: null }).in("id", limpar);
        if (error) throw new Error(`pastos seguindo o retiro: ${error.message}`);
      }
      toast.success("Vínculos salvos!");
      setConfirmOpen(false);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Erro ao vincular produto:", err);
      toast.error(`Erro ao salvar: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  const resumo = fazendas.flatMap((f) => {
    const partes: string[] = [];
    if (fazAdd.some((x) => x.id === f.id)) partes.push(`${f.nome}: disponível`);
    if (fazRem.some((x) => x.id === f.id)) partes.push(`${f.nome}: deixa de estar disponível`);
    retirosNovos.filter((r) => r.fazenda_id === f.id).forEach((r) =>
      partes.push(`Retiro ${r.nome}: ${nomeProd(r.produto_id)} → este produto`));
    const nNovos = pastosNovos.filter((p) => retiroById[p.retiro_id]?.fazenda_id === f.id).length;
    if (nNovos) partes.push(`${nNovos} pasto(s) passam a usar este produto`);
    const nRem = pastosRemovidos.filter((p) => retiroById[p.retiro_id]?.fazenda_id === f.id).length;
    if (nRem) partes.push(`${nRem} pasto(s) voltam a seguir o retiro`);
    const nConf = conflitosALimpar.filter((p) => retiroById[p.retiro_id]?.fazenda_id === f.id).length;
    if (nConf) partes.push(`${nConf} pasto(s) passam a seguir o produto do retiro`);
    return partes.length ? [partes.join(" · ")] : [];
  });

  const fazendasVisiveis = fazendas.filter((f) => filtroFaz === "todas" || f.id === filtroFaz);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular produto</DialogTitle>
            <DialogDescription>{produto ? nomeProd(produto.id) : ""}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {fazendas.length > 1 && (
                <Select value={filtroFaz} onValueChange={setFiltroFaz}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as fazendas</SelectItem>
                    {fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {fazendasVisiveis.map((f) => {
                const marcada = fazSel.has(f.id);
                const travada = marcada && usaNaFazenda(f.id);
                const rets = retiros.filter((r) => r.fazenda_id === f.id);
                return (
                  <div key={f.id} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`f-${f.id}`} checked={marcada} disabled={travada}
                        onCheckedChange={() => toggle(fazSel, f.id, setFazSel)} />
                      <Label htmlFor={`f-${f.id}`} className="font-semibold cursor-pointer">{f.nome}</Label>
                      <span className="text-xs text-muted-foreground ml-auto">{marcada ? "disponível" : "indisponível"}</span>
                    </div>
                    {travada && <p className="text-xs text-muted-foreground">Em uso por retiros ou pastos desta fazenda.</p>}

                    {rets.length === 0 && <p className="text-xs text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
                    {rets.map((r) => {
                      const usa = r.produto_id === pid;
                      const ps = pastos.filter((p) => p.retiro_id === r.id);
                      return (
                        <div key={r.id} className="pl-4 border-l space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox id={`r-${r.id}`} checked={retSel.has(r.id)} disabled={!marcada || usa}
                              onCheckedChange={() => toggle(retSel, r.id, setRetSel)} />
                            <Label htmlFor={`r-${r.id}`} className="text-sm cursor-pointer">Retiro {r.nome}</Label>
                            <span className="text-xs text-muted-foreground ml-auto text-right">{usa ? "usa este produto" : nomeProd(r.produto_id)}</span>
                          </div>
                          {ps.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 pl-6">
                              <Checkbox id={`p-${p.id}`} checked={pastoSel.has(p.id)} disabled={!marcada}
                                onCheckedChange={() => toggle(pastoSel, p.id, setPastoSel)} />
                              <Label htmlFor={`p-${p.id}`} className="text-xs cursor-pointer">{p.nome}</Label>
                              <span className="text-xs text-muted-foreground ml-auto text-right">
                                {p.produto_id ? nomeProd(p.produto_id) : "Seguir o retiro"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {conflitos.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-amber-800"><AlertTriangle className="w-4 h-4" /> Pastos com produto próprio diferente do novo produto:</p>
                  <ul className="text-xs text-amber-900 list-disc pl-5">
                    {conflitos.map((c) => (
                      <li key={c.id}>{c.nome} ({retiroById[c.retiro_id]?.nome}) — {nomeProd(c.produto_id)}</li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2">
                    <Checkbox id="vinc-seguir-retiro" checked={seguirRetiro} onCheckedChange={(c) => setSeguirRetiro(c === true)} />
                    <Label htmlFor="vinc-seguir-retiro" className="text-sm font-normal cursor-pointer">Fazer esses pastos seguirem o produto do retiro</Label>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" disabled={saving || !temMudanca} onClick={() => setConfirmOpen(true)}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                {resumo.map((l, i) => <p key={i}>{l}</p>)}
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
    </>
  );
}
