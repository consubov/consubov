import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, BarChart3, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";
import { camposProdutoParaRetiro, type ProdutoParaRetiro } from "@/lib/retiroProduto";

interface Produto extends ProdutoParaRetiro {
  nome: string;
  marca: string | null;
}

interface RetiroRow { id: string; nome: string; produto_id: string | null; fazenda_id: string }
interface PastoRow { id: string; nome: string; produto_id: string | null; retiro_id: string }

interface Props {
  retiroId: string;
  retiroNome: string;
  fazendaId: string;
}

const SEGUIR = "__seguir__";

/**
 * Troca de produto pelo Gerente: retiro (opção A, igual ao Admin) e pastos
 * (mesma gravação da PastoDetailPage). Escopo: fazenda ativa do painel
 * (gerentes_fazendas); tudo é filtrado por fazenda_id/retiro_id.
 */
export default function GerenteProdutoRetiroCard({ retiroId, retiroNome, fazendaId }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [retiros, setRetiros] = useState<RetiroRow[]>([]);
  const [pastosFazenda, setPastosFazenda] = useState<PastoRow[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [pastoSel, setPastoSel] = useState<Record<string, string>>({});
  const [aplicarTodos, setAplicarTodos] = useState(false);
  const [seguirRetiro, setSeguirRetiro] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  const retiroAtual = retiros.find((r) => r.id === retiroId);
  const pastosRetiro = useMemo(
    () => pastosFazenda.filter((p) => p.retiro_id === retiroId).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })),
    [pastosFazenda, retiroId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [retRes, produtoIds] = await Promise.all([
      supabase.from("retiros").select("id, nome, produto_id, fazenda_id").eq("fazenda_id", fazendaId),
      fetchProdutoIdsDaFazenda(fazendaId),
    ]);
    const rets = (retRes.data ?? []) as RetiroRow[];
    // Retiro precisa pertencer à fazenda ativa do painel do gerente.
    if (!rets.some((r) => r.id === retiroId)) {
      setBloqueado(true);
      setLoading(false);
      return;
    }
    const retIds = rets.map((r) => r.id);
    let prodQuery = supabase.from("produtos").select("*").eq("ativo", true).order("nome");
    if (produtoIds) prodQuery = prodQuery.in("id", produtoIds);
    const [prodRes, pastosRes] = await Promise.all([
      prodQuery,
      supabase.from("pastos").select("id, nome, produto_id, retiro_id").in("retiro_id", retIds),
    ]);
    const pastos = (pastosRes.data ?? []) as PastoRow[];
    setProdutos((prodRes.data ?? []) as Produto[]);
    setRetiros(rets);
    setPastosFazenda(pastos);
    setProdutoId(rets.find((r) => r.id === retiroId)?.produto_id ?? "");
    setPastoSel(Object.fromEntries(pastos.filter((p) => p.retiro_id === retiroId).map((p) => [p.id, p.produto_id ?? SEGUIR])));
    setAplicarTodos(false);
    setSeguirRetiro(true);
    setBloqueado(false);
    setLoading(false);
  }, [retiroId, fazendaId]);

  useEffect(() => { load(); }, [load]);

  const nomeProduto = (id: string | null | undefined) => {
    if (!id) return "sem produto";
    const p = produtos.find((x) => x.id === id);
    return p ? (p.marca ? `${p.marca} — ${p.nome}` : p.nome) : "produto não vinculado";
  };

  const retiroMudou = !!produtoId && produtoId !== (retiroAtual?.produto_id ?? "");
  const retirosAlvo = retiroMudou ? (aplicarTodos ? retiros : retiros.filter((r) => r.id === retiroId)) : [];

  // Pastos com produto próprio diferente do novo produto do retiro,
  // considerando a escolha em edição para os pastos deste retiro.
  const conflitos = useMemo(() => {
    if (!retiroMudou) return [] as PastoRow[];
    const alvo = new Set(retirosAlvo.map((r) => r.id));
    return pastosFazenda.filter((p) => {
      if (!alvo.has(p.retiro_id)) return false;
      const efetivo = p.retiro_id === retiroId ? (pastoSel[p.id] === SEGUIR ? null : pastoSel[p.id]) : p.produto_id;
      return !!efetivo && efetivo !== produtoId;
    });
  }, [retiroMudou, retirosAlvo, pastosFazenda, pastoSel, produtoId, retiroId]);

  const pastosAlterados = pastosRetiro.filter((p) => {
    const novo = pastoSel[p.id] === SEGUIR ? null : pastoSel[p.id];
    const limpar = seguirRetiro && conflitos.some((c) => c.id === p.id);
    return !limpar && (novo ?? null) !== (p.produto_id ?? null);
  });

  const conflitosALimpar = seguirRetiro ? conflitos : [];
  const temMudanca = retiroMudou || pastosAlterados.length > 0 || conflitosALimpar.length > 0;

  function cancelarEdicao() {
    setEditing(false);
    load();
  }

  async function executar() {
    setSaving(true);
    try {
      if (retiroMudou) {
        const prod = produtos.find((p) => p.id === produtoId);
        const campos = camposProdutoParaRetiro(prod, produtoId, {
          peso_saco_kg: null, preco_por_kg: null,
          consumo_recria1: null, consumo_recria2: null, consumo_engorda: null,
          margem_recria1: null, margem_recria2: null, margem_engorda: null,
        });
        const ids = retirosAlvo.map((r) => r.id);
        const { error } = await supabase.from("retiros").update(campos as any).eq("fazenda_id", fazendaId).in("id", ids);
        if (error) throw new Error(`retiro: ${error.message}`);
      }
      // Pastos deste retiro: mesma gravação da PastoDetailPage (produto_id ou null).
      for (const p of pastosAlterados) {
        const novo = pastoSel[p.id] === SEGUIR ? null : pastoSel[p.id];
        const { error } = await supabase.from("pastos").update({ produto_id: novo }).eq("id", p.id).eq("retiro_id", retiroId);
        if (error) throw new Error(`pasto ${p.nome}: ${error.message}`);
      }
      if (conflitosALimpar.length > 0) {
        const retIds = retiros.map((r) => r.id);
        const { error } = await supabase.from("pastos").update({ produto_id: null })
          .in("id", conflitosALimpar.map((c) => c.id)).in("retiro_id", retIds);
        if (error) throw new Error(`pastos seguindo o retiro: ${error.message}`);
      }
      toast.success("Produtos atualizados!");
      setConfirmOpen(false);
      setEditing(false);
      await load();
    } catch (err: any) {
      console.error("Erro ao trocar produto:", err);
      toast.error(`Erro ao salvar ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  if (bloqueado) return null;

  const prodSel = produtos.find((p) => p.id === produtoId);

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Produto Ativo do Retiro</CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Produto do retiro</Label>
            {editing ? (
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{nomeProduto(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">{nomeProduto(retiroAtual?.produto_id)}</p>
            )}
            {produtos.length === 0 && <p className="text-xs text-amber-700">{MSG_FAZENDA_SEM_PRODUTO}</p>}
            {prodSel && (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                <p>Peso do saco: <strong>{prodSel.peso_saco_kg} kg</strong> · Custo: <strong>R$ {Number(prodSel.preco_por_kg ?? 0).toFixed(2)}/kg</strong></p>
                {prodSel.consumo_recria1 != null && <p>Consumo R1: {prodSel.consumo_recria1} (±{prodSel.margem_recria1 ?? 0}) · R2: {prodSel.consumo_recria2 ?? "—"} (±{prodSel.margem_recria2 ?? 0}) · Eng: {prodSel.consumo_engorda ?? "—"} (±{prodSel.margem_engorda ?? 0})</p>}
              </div>
            )}
          </div>

          {editing && (
            <div className="flex items-center gap-2">
              <Checkbox id="aplicar-todos-retiros" checked={aplicarTodos} onCheckedChange={(c) => setAplicarTodos(c === true)} />
              <Label htmlFor="aplicar-todos-retiros" className="text-sm font-normal cursor-pointer">Aplicar a todos os retiros da fazenda</Label>
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <Label>Produto por pasto</Label>
            {pastosRetiro.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pasto neste retiro.</p>}
            {pastosRetiro.map((p) => {
              const heranca = `Herdado do retiro: ${nomeProduto(editing ? produtoId : retiroAtual?.produto_id)}`;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium shrink-0">{p.nome}</span>
                  {editing ? (
                    <Select value={pastoSel[p.id] ?? SEGUIR} onValueChange={(v) => setPastoSel((s) => ({ ...s, [p.id]: v }))}>
                      <SelectTrigger className="h-8 max-w-[60%]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEGUIR}>Seguir o retiro</SelectItem>
                        {produtos.map((pr) => <SelectItem key={pr.id} value={pr.id}>{nomeProduto(pr.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground text-right">{p.produto_id ? nomeProduto(p.produto_id) : heranca}</span>
                  )}
                </div>
              );
            })}
          </div>

          {editing && conflitos.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-amber-800"><AlertTriangle className="w-4 h-4" /> Pastos com produto próprio diferente do novo produto:</p>
              <ul className="text-xs text-amber-900 list-disc pl-5">
                {conflitos.map((c) => (
                  <li key={c.id}>{c.nome}{aplicarTodos ? ` (${retiros.find((r) => r.id === c.retiro_id)?.nome ?? ""})` : ""} — {nomeProduto(c.retiro_id === retiroId ? pastoSel[c.id] : c.produto_id)}</li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Checkbox id="seguir-retiro" checked={seguirRetiro} onCheckedChange={(c) => setSeguirRetiro(c === true)} />
                <Label htmlFor="seguir-retiro" className="text-sm font-normal cursor-pointer">Fazer esses pastos seguirem o produto do retiro</Label>
              </div>
            </div>
          )}

          {editing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={cancelarEdicao} disabled={saving}>Cancelar</Button>
              <Button size="sm" className="flex-1" disabled={saving || !temMudanca} onClick={() => setConfirmOpen(true)}>Salvar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                {retirosAlvo.map((r) => (
                  <p key={r.id}>Retiro {r.nome}: {nomeProduto(r.produto_id)} → {nomeProduto(produtoId)}</p>
                ))}
                {pastosAlterados.map((p) => (
                  <p key={p.id}>Pasto {p.nome}: {p.produto_id ? nomeProduto(p.produto_id) : "seguia o retiro"} → {pastoSel[p.id] === SEGUIR ? "seguir o retiro" : nomeProduto(pastoSel[p.id])}</p>
                ))}
                {conflitosALimpar.length > 0 && (
                  <p>{conflitosALimpar.length} pasto(s) passam a seguir o retiro</p>
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
    </>
  );
}
