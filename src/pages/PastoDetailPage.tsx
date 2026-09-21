import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, TreePine, ClipboardList, Package, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { fetchProdutoIdsDaFazenda, MSG_FAZENDA_SEM_PRODUTO } from "@/lib/produtosFazenda";

type Pasto = Tables<"pastos">;
type Retiro = Tables<"retiros">;
type Fazenda = Tables<"fazendas">;
type Produto = Tables<"produtos">;

export default function PastoDetailPage() {
  const { fazendaId, retiroId, pastoId } = useParams<{ fazendaId: string; retiroId: string; pastoId: string }>();
  const navigate = useNavigate();
  const [pasto, setPasto] = useState<Pasto | null>(null);
  const [retiro, setRetiro] = useState<Retiro | null>(null);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pastosDoRetiro, setPastosDoRetiro] = useState<Pasto[]>([]);
  const [loading, setLoading] = useState(true);

  // Product override
  const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [savingProduto, setSavingProduto] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferQtd, setTransferQtd] = useState("");
  const [transferDestino, setTransferDestino] = useState("");
  const [savingTransfer, setSavingTransfer] = useState(false);

  async function loadData() {
    if (!pastoId || !retiroId || !fazendaId) return;
    const produtoIds = await fetchProdutoIdsDaFazenda(fazendaId);
    let produtosQuery = supabase.from("produtos").select("*").eq("ativo", true).order("nome");
    if (produtoIds) produtosQuery = produtosQuery.in("id", produtoIds);
    const [pastoRes, retiroRes, fazendaRes, produtosRes, pastosRes] = await Promise.all([
      supabase.from("pastos").select("*").eq("id", pastoId).single(),
      supabase.from("retiros").select("*").eq("id", retiroId).single(),
      supabase.from("fazendas").select("*").eq("id", fazendaId).single(),
      produtosQuery,
      supabase.from("pastos").select("*").eq("retiro_id", retiroId).eq("ativo", true).order("nome"),
    ]);
    if (pastoRes.error) {
      toast.error("Pasto não encontrado.");
      navigate(`/admin/fazendas/${fazendaId}/retiros/${retiroId}`);
      return;
    }
    setPasto(pastoRes.data);
    setRetiro(retiroRes.data);
    setFazenda(fazendaRes.data);
    setProdutos(produtosRes.data ?? []);
    setPastosDoRetiro(pastosRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [pastoId]);

  // Derived
  const produtoRetiro = retiro?.produto_id ? produtos.find(p => p.id === retiro.produto_id) : null;
  const produtoPasto = pasto?.produto_id ? produtos.find(p => p.id === pasto.produto_id) : null;
  const hasOverride = !!pasto?.produto_id && pasto.produto_id !== retiro?.produto_id;
  const produtoAtivo = produtoPasto ?? produtoRetiro;

  // --- Product override handlers ---
  function openProdutoDialog() {
    setSelectedProdutoId(pasto?.produto_id ?? "");
    setProdutoDialogOpen(true);
  }

  async function saveProdutoOverride() {
    if (!pasto) return;
    setSavingProduto(true);
    const newProdutoId = selectedProdutoId || null;
    const { error } = await supabase.from("pastos").update({ produto_id: newProdutoId }).eq("id", pasto.id);
    if (error) {
      toast.error("Erro ao salvar produto.");
    } else {
      setPasto({ ...pasto, produto_id: newProdutoId });
      toast.success("Produto atualizado!");
      setProdutoDialogOpen(false);
    }
    setSavingProduto(false);
  }

  async function resetProduto() {
    if (!pasto) return;
    const { error } = await supabase.from("pastos").update({ produto_id: null }).eq("id", pasto.id);
    if (error) {
      toast.error("Erro ao resetar produto.");
    } else {
      setPasto({ ...pasto, produto_id: null });
      toast.success("Produto resetado para o padrão do retiro.");
    }
  }

  // --- Transfer handlers ---
  function openTransfer() {
    setTransferQtd("");
    setTransferDestino("");
    setTransferOpen(true);
  }

  async function handleTransfer() {
    if (!pasto || !retiro || !fazenda) return;
    const qtd = parseInt(transferQtd);
    if (!qtd || qtd <= 0) { toast.error("Quantidade inválida."); return; }
    if (qtd > pasto.num_animais) { toast.error("Quantidade maior que o total disponível."); return; }
    if (!transferDestino) { toast.error("Selecione o pasto destino."); return; }
    if (transferDestino === pasto.id) { toast.error("Não é possível transferir para o mesmo pasto."); return; }

    const destino = pastosDoRetiro.find(p => p.id === transferDestino);
    if (!destino) { toast.error("Pasto destino não encontrado."); return; }

    setSavingTransfer(true);
    try {
      // Get current cycle
      const { data: cicloId, error: cicloErr } = await supabase.rpc("ensure_ciclo_atual", { p_fazenda_id: fazendaId! });
      if (cicloErr) throw cicloErr;

      // Update origin pasto
      const newOrigem = pasto.num_animais - qtd;
      const { error: errOrigem } = await supabase.from("pastos").update({ num_animais: newOrigem }).eq("id", pasto.id);
      if (errOrigem) throw errOrigem;

      // Update destination pasto
      const newDestino = destino.num_animais + qtd;
      const { error: errDestino } = await supabase.from("pastos").update({ num_animais: newDestino }).eq("id", destino.id);
      if (errDestino) throw errDestino;

      // Record lancamento
      const now = new Date();
      await supabase.from("lancamentos").insert({
        fazenda_id: fazendaId!,
        retiro_id: retiroId!,
        pasto_id: pasto.id,
        mes_referencia: now.getMonth() + 1,
        ano_referencia: now.getFullYear(),
        num_animais: qtd,
        num_sacos: 0,
        dias_no_pasto: 1,
        origem: "transferencia",
        categoria: pasto.categoria,
        sexo: pasto.sexo,
        peso_medio_kg: pasto.peso_medio_kg,
      } as any);

      setPasto({ ...pasto, num_animais: newOrigem });
      setPastosDoRetiro(prev => prev.map(p => {
        if (p.id === pasto.id) return { ...p, num_animais: newOrigem };
        if (p.id === destino.id) return { ...p, num_animais: newDestino };
        return p;
      }));

      toast.success(`${qtd} animais transferidos para ${destino.nome}.`);
      setTransferOpen(false);
    } catch (err: any) {
      console.error("Erro na transferência:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSavingTransfer(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!pasto || !retiro || !fazenda) return null;

  const destinosDisponiveis = pastosDoRetiro.filter(p => p.id !== pasto.id);
  const destinoSelecionado = destinosDisponiveis.find(p => p.id === transferDestino);
  const qtdNum = parseInt(transferQtd) || 0;

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}`}>{fazenda.nome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/admin/fazendas/${fazendaId}/retiros/${retiroId}`}>{retiro.nome}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{pasto.nome}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(`/admin/fazendas/${fazendaId}/retiros/${retiroId}`)}>
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TreePine className="w-5 h-5" /> {pasto.nome}</CardTitle>
            <div className="flex gap-2">
              {hasOverride && <Badge variant="outline" className="border-amber-500 text-amber-600">Produto personalizado</Badge>}
              <Badge variant={pasto.ativo ? "default" : "secondary"}>{pasto.ativo ? "Ativo" : "Inativo"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Retiro:</span> {retiro.nome}</div>
            <div><span className="text-muted-foreground">Fazenda:</span> {fazenda.nome}</div>
            <div
              className="cursor-pointer hover:text-primary transition-colors"
              onClick={openTransfer}
            >
              <span className="text-muted-foreground">Animais:</span>{" "}
              <span className="underline decoration-dashed">{pasto.num_animais}</span>
              <ArrowRightLeft className="w-3 h-3 inline ml-1 text-muted-foreground" />
            </div>
            <div><span className="text-muted-foreground">Peso Médio:</span> {pasto.peso_medio_kg ? `${pasto.peso_medio_kg} kg` : "—"}</div>
            <div><span className="text-muted-foreground">Categoria:</span> {pasto.categoria ?? "—"}</div>
            <div><span className="text-muted-foreground">Sexo:</span> {pasto.sexo ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Produto do Pasto */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="w-4 h-4" /> Produto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="text-muted-foreground">Produto atual: </span>
              <span className="font-medium">
                {produtoAtivo ? produtoAtivo.nome : "Nenhum definido"}
                {!hasOverride && produtoRetiro && <span className="text-muted-foreground ml-1">(padrão do retiro)</span>}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openProdutoDialog} className="gap-1.5">
                <Package className="w-3 h-3" />
                Definir produto específico
              </Button>
              {hasOverride && (
                <Button size="sm" variant="ghost" onClick={resetProduto} className="text-muted-foreground">
                  Usar produto do retiro
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Lançamentos</h2>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Módulo de lançamentos em breve.</p>
        </CardContent>
      </Card>

      {/* Dialog: Produto Override */}
      <Dialog open={produtoDialogOpen} onOpenChange={setProdutoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Definir Produto do Pasto</DialogTitle>
            <DialogDescription>
              Selecione um produto específico para este pasto. Se não definido, será usado o produto do retiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}{p.marca ? ` (${p.marca})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {produtos.length === 0 && (
                <p className="text-xs text-amber-700">{MSG_FAZENDA_SEM_PRODUTO}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdutoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProdutoOverride} disabled={savingProduto || !selectedProdutoId}>
              {savingProduto ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Transferência */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transferir Animais</DialogTitle>
            <DialogDescription>
              Transfira animais de <strong>{pasto.nome}</strong> para outro pasto do mesmo retiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantidade a transferir (máx: {pasto.num_animais})</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={pasto.num_animais}
                value={transferQtd}
                onChange={e => setTransferQtd(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Pasto destino</Label>
              <Select value={transferDestino} onValueChange={setTransferDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione o pasto" /></SelectTrigger>
                <SelectContent>
                  {destinosDisponiveis.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.num_animais} animais)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {qtdNum > 0 && destinoSelecionado && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <strong>{qtdNum}</strong> animais saem de <strong>{pasto.nome}</strong> → <strong>{destinoSelecionado.nome}</strong>
              </div>
            )}
            {qtdNum > pasto.num_animais && (
              <p className="text-sm text-destructive font-medium">Quantidade maior que o total disponível.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleTransfer}
              disabled={savingTransfer || !transferDestino || qtdNum <= 0 || qtdNum > pasto.num_animais}
            >
              {savingTransfer ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
