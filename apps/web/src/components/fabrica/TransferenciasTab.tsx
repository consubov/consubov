import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Loader2, Camera, X, AlertTriangle, Truck, History,
  CheckCircle2, PackageCheck, Clock, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { compressImageDataUrl } from "@/lib/imageCompression";
import { sendPush } from "@/lib/pushService";

interface Produto { id: string; nome: string; peso_saco_kg: number | null; }
interface EstoqueProd {
  id: string; produto_id: string; quantidade_sacos: number | null; quantidade_kg: number | null;
}
interface Destino {
  id: string; fabrica_id: string; fazenda_id: string | null; retiro_id: string | null;
}
interface Fazenda { id: string; nome: string; }
interface Retiro { id: string; nome: string; fazenda_id: string; }
interface Transferencia {
  id: string; fabrica_id: string; produto_id: string;
  fazenda_destino_id: string | null; retiro_destino_id: string | null;
  quantidade_sacos: number; quantidade_kg: number; status: string | null;
  registrado_por: string | null; observacao: string | null; foto_url: string | null;
  criado_em: string | null;
}
interface Recebimento {
  id: string; transferencia_id: string; quantidade_recebida: number;
  recebido_por: string | null; status: string | null; foto_url: string | null;
  observacao: string | null; divergencia_sacos: number | null; divergencia_percentual: number | null;
  data_recebimento: string | null; hora_recebimento: string | null; criado_em: string | null;
}

export default function TransferenciasTab({ fabricaId }: { fabricaId: string }) {
  return (
    <Tabs defaultValue="nova" className="w-full">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="nova"><Truck className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Nova</span></TabsTrigger>
        <TabsTrigger value="transito"><Clock className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Em Trânsito</span><span className="sm:hidden">Trânsito</span></TabsTrigger>
        <TabsTrigger value="historico"><History className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Histórico</span></TabsTrigger>
      </TabsList>
      <TabsContent value="nova" className="mt-4"><NovaSection fabricaId={fabricaId} /></TabsContent>
      <TabsContent value="transito" className="mt-4"><TransitoSection fabricaId={fabricaId} /></TabsContent>
      <TabsContent value="historico" className="mt-4"><HistoricoSection fabricaId={fabricaId} /></TabsContent>
    </Tabs>
  );
}

async function uploadFoto(fabricaId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `fabrica/${fabricaId}/transferencias/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from("relatorios").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
  return pub.publicUrl;
}

function useDestinos(fabricaId: string) {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [fazendas, setFazendas] = useState<Record<string, Fazenda>>({});
  const [retiros, setRetiros] = useState<Record<string, Retiro>>({});

  useEffect(() => { load(); }, [fabricaId]);
  async function load() {
    const { data: d } = await supabase.from("fabrica_destinos").select("*").eq("fabrica_id", fabricaId);
    const dests = (d as Destino[]) || [];
    setDestinos(dests);
    const fazIds = Array.from(new Set(dests.map(x => x.fazenda_id).filter(Boolean))) as string[];
    const retIds = Array.from(new Set(dests.map(x => x.retiro_id).filter(Boolean))) as string[];
    // also include the fazenda of each retiro (for display)
    let allFazIds = fazIds;
    let retMap: Record<string, Retiro> = {};
    if (retIds.length) {
      const { data: rs } = await supabase.from("retiros").select("id,nome,fazenda_id").in("id", retIds);
      retMap = Object.fromEntries(((rs as Retiro[]) || []).map(r => [r.id, r]));
      allFazIds = Array.from(new Set([...allFazIds, ...Object.values(retMap).map(r => r.fazenda_id)]));
    }
    setRetiros(retMap);
    if (allFazIds.length) {
      const { data: fs } = await supabase.from("fazendas").select("id,nome").in("id", allFazIds);
      setFazendas(Object.fromEntries(((fs as Fazenda[]) || []).map(f => [f.id, f])));
    }
  }
  return { destinos, fazendas, retiros };
}

function destinoLabel(t: { fazenda_destino_id: string | null; retiro_destino_id: string | null }, fazendas: Record<string, Fazenda>, retiros: Record<string, Retiro>) {
  if (t.retiro_destino_id) {
    const r = retiros[t.retiro_destino_id];
    const f = r ? fazendas[r.fazenda_id] : null;
    return `${f?.nome || "Fazenda"} • Retiro ${r?.nome || "?"}`;
  }
  if (t.fazenda_destino_id) {
    return `Fazenda ${fazendas[t.fazenda_destino_id]?.nome || "?"}`;
  }
  return "—";
}

/* ============================ NOVA ============================ */
function NovaSection({ fabricaId }: { fabricaId: string }) {
  const { user } = useAuth();
  const { destinos, fazendas, retiros } = useDestinos(fabricaId);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoques, setEstoques] = useState<EstoqueProd[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [produtoId, setFormulaId] = useState("");
  const [destinoKey, setDestinoKey] = useState(""); // "faz:UUID" | "ret:UUID"
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [fabricaId]);
  async function load() {
    setLoading(true);
    const [{ data: eq }, { data: fx }] = await Promise.all([
      supabase.from("estoque_produto_acabado").select("*").eq("fabrica_id", fabricaId),
      supabase.from("produtos").select("id,nome,peso_saco_kg").eq("ativo", true),
    ]);
    setEstoques((eq as EstoqueProd[]) || []);
    setProdutos((fx as Produto[]) || []);
    setLoading(false);
  }

  const estoqueMap = useMemo(() => Object.fromEntries(estoques.map(e => [e.produto_id, e])), [estoques]);
  const produtoSel = produtos.find(f => f.id === produtoId);
  const estoqueDisp = produtoId ? estoqueMap[produtoId] : null;
  const sacosDisp = Number(estoqueDisp?.quantidade_sacos || 0);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(reader.result as string, { maxDimension: 1280, quality: 0.75 });
      setFoto(compressed);
    };
    reader.readAsDataURL(f);
  }

  function reset() {
    setFormulaId(""); setDestinoKey(""); setQtd(""); setObs(""); setFoto(null);
  }

  async function confirmar() {
    if (!produtoId) return toast.error("Selecione um produto");
    if (!destinoKey) return toast.error("Selecione um destino");
    const q = parseFloat(qtd);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    if (q > sacosDisp) return toast.error(`Estoque insuficiente (disponível: ${sacosDisp} sc)`);

    setSaving(true);
    try {
      const fotoUrl = foto ? await uploadFoto(fabricaId, foto) : null;
      const [tipo, destId] = destinoKey.split(":");
      const pesoPorSaco = Number(produtoSel?.peso_saco_kg || 0);
      const kg = q * pesoPorSaco;

      // Fazenda_id para a notificação
      let fazendaIdNotif: string | null = null;
      if (tipo === "faz") fazendaIdNotif = destId;
      else if (tipo === "ret") fazendaIdNotif = retiros[destId]?.fazenda_id ?? null;

      const { data: tRow, error: tErr } = await supabase.from("transferencias_fabrica").insert({
        fabrica_id: fabricaId,
        produto_id: produtoId,
        fazenda_destino_id: tipo === "faz" ? destId : null,
        retiro_destino_id: tipo === "ret" ? destId : null,
        quantidade_sacos: q,
        quantidade_kg: kg,
        status: "em_transito",
        registrado_por: user?.id ?? null,
        observacao: obs.trim() || null,
        foto_url: fotoUrl,
      }).select().single();
      if (tErr) throw tErr;

      // Baixar estoque produto acabado
      if (estoqueDisp) {
        await supabase.from("estoque_produto_acabado").update({
          quantidade_sacos: Math.max(0, Number(estoqueDisp.quantidade_sacos || 0) - q),
          quantidade_kg: Math.max(0, Number(estoqueDisp.quantidade_kg || 0) - kg),
        }).eq("id", estoqueDisp.id);
      }

      // Notificação in-app + push são disparados pelo trigger
      // trg_notificar_transferencia_fabrica no banco (mesmo padrão de observações de pasto).

      toast.success("Transferência registrada e notificações enviadas");
      reset();
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Registrar Transferência</h3>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Estoque de Produto Acabado</CardTitle></CardHeader>
        <CardContent>
          {estoques.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto em estoque.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Sacos</TableHead><TableHead className="text-right">Kg</TableHead></TableRow></TableHeader>
              <TableBody>
                {estoques.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{produtos.find(f => f.id === e.produto_id)?.nome || "—"}</TableCell>
                    <TableCell className="text-right">{Number(e.quantidade_sacos || 0)}</TableCell>
                    <TableCell className="text-right">{Number(e.quantidade_kg || 0).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transferência</DialogTitle>
            <DialogDescription>Baixa automática do estoque e envio de notificação ao destino.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produto *</Label>
              <Select value={produtoId} onValueChange={setFormulaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {produtos.filter(f => Number(estoqueMap[f.id]?.quantidade_sacos || 0) > 0).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">Nenhum produto disponível para transferência</div>
                  ) : (
                    produtos
                      .filter(f => Number(estoqueMap[f.id]?.quantidade_sacos || 0) > 0)
                      .map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>

                      ))
                  )}
                </SelectContent>
              </Select>
              {produtoId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível: {sacosDisp} sacos • {Number(estoqueDisp?.quantidade_kg || 0).toFixed(1)} kg
                </p>
              )}
            </div>
            <div>
              <Label>Destino *</Label>
              <Select value={destinoKey} onValueChange={setDestinoKey}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {destinos.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum destino vinculado</div>}
                  {destinos.map(d => {
                    const key = d.fazenda_id ? `faz:${d.fazenda_id}` : `ret:${d.retiro_id}`;
                    const label = destinoLabel(
                      { fazenda_destino_id: d.fazenda_id, retiro_destino_id: d.retiro_id },
                      fazendas, retiros,
                    );
                    return <SelectItem key={d.id} value={key}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade de Sacos *</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max={sacosDisp || undefined}
                value={qtd}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "") return setQtd("");
                  const n = parseInt(v, 10);
                  if (isNaN(n)) return;
                  if (sacosDisp > 0 && n > sacosDisp) return setQtd(String(sacosDisp));
                  setQtd(String(Math.max(0, n)));
                }}
              />

              {produtoId && qtd && parseFloat(qtd) > sacosDisp && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Excede estoque disponível
                </p>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Foto (opcional)</Label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
              {foto ? (
                <div className="relative">
                  <img src={foto} alt="foto" className="w-full rounded border" />
                  <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={() => setFoto(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
                  <Camera className="w-4 h-4 mr-1" /> Capturar / Enviar
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar Transferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================ TRÂNSITO / RECEBIMENTO ============================ */
function TransitoSection({ fabricaId }: { fabricaId: string }) {
  const { user, roleData } = useAuth();
  const podeReceber = roleData.role !== "operador_fabrica";
  const { fazendas, retiros } = useDestinos(fabricaId);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [produtos, setProdutos] = useState<Record<string, Produto>>({});
  const [loading, setLoading] = useState(true);

  const [detalhe, setDetalhe] = useState<Transferencia | null>(null);
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [saving, setSaving] = useState(false);

  const [qtdReceb, setQtdReceb] = useState("");
  const [obsReceb, setObsReceb] = useState("");
  const [fotoReceb, setFotoReceb] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [fabricaId]);

  useEffect(() => {
    const ch = supabase
      .channel(`transf-fab-${fabricaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transferencias_fabrica", filter: `fabrica_id=eq.${fabricaId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "recebimentos_transferencia" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fabricaId]);

  async function load() {
    setLoading(true);
    const { data: t } = await supabase.from("transferencias_fabrica")
      .select("*").eq("fabrica_id", fabricaId).in("status", ["em_transito", "em_recebimento"])
      .order("criado_em", { ascending: false });
    const list = (t as Transferencia[]) || [];
    setTransferencias(list);
    const fIds = Array.from(new Set(list.map(x => x.produto_id)));
    if (fIds.length) {
      const { data: fs } = await supabase.from("produtos").select("id,nome,peso_saco_kg").in("id", fIds);
      setProdutos(Object.fromEntries(((fs as Produto[]) || []).map(f => [f.id, f])));
    }
    setLoading(false);
  }

  async function abrirDetalhe(t: Transferencia) {
    setDetalhe(t); setBloqueado(false); setRecebimento(null);
    setQtdReceb(""); setObsReceb(""); setFotoReceb(null);

    // Operador de fábrica NÃO pode confirmar recebimento — apenas visualizar
    if (!podeReceber) {
      const { data: existente } = await supabase.from("recebimentos_transferencia")
        .select("*").eq("transferencia_id", t.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      setRecebimento((existente as Recebimento) || null);
      setBloqueado(true);
      return;
    }

    // "Primeiro que abre assume": tentar transitar em_transito -> em_recebimento atomicamente
    if (t.status === "em_transito") {
      const { data: upd, error } = await supabase.from("transferencias_fabrica")
        .update({ status: "em_recebimento" })
        .eq("id", t.id).eq("status", "em_transito")
        .select().maybeSingle();
      if (error) { toast.error("Erro: " + error.message); return; }
      if (!upd) {
        // outro assumiu
        setBloqueado(true);
        const { data: existente } = await supabase.from("recebimentos_transferencia")
          .select("*").eq("transferencia_id", t.id).eq("status", "em_recebimento").maybeSingle();
        setRecebimento((existente as Recebimento) || null);
        return;
      }
      // criar recebimento em andamento
      const { data: recIns } = await supabase.from("recebimentos_transferencia").insert({
        transferencia_id: t.id,
        quantidade_recebida: 0,
        recebido_por: user?.id ?? null,
        status: "em_recebimento",
      }).select().single();
      setRecebimento(recIns as Recebimento);
    } else {
      // status já em_recebimento
      const { data: existente } = await supabase.from("recebimentos_transferencia")
        .select("*").eq("transferencia_id", t.id).eq("status", "em_recebimento").maybeSingle();
      if (existente && (existente as Recebimento).recebido_por && (existente as Recebimento).recebido_por !== user?.id) {
        setBloqueado(true);
      }
      setRecebimento((existente as Recebimento) || null);
    }
  }

  function fecharDetalhe() {
    setDetalhe(null); setRecebimento(null); setBloqueado(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(reader.result as string, { maxDimension: 1280, quality: 0.75 });
      setFotoReceb(compressed);
    };
    reader.readAsDataURL(f);
  }

  async function confirmarRecebimento() {
    if (!detalhe || !recebimento) return;
    const q = parseFloat(qtdReceb);
    if (!q || q <= 0) return toast.error("Quantidade recebida inválida");

    setSaving(true);
    try {
      const fotoUrl = fotoReceb ? await uploadFoto(detalhe.fabrica_id, fotoReceb) : null;
      const now = new Date();
      const divergSacos = detalhe.quantidade_sacos - q;
      const divergPct = detalhe.quantidade_sacos > 0
        ? (divergSacos / detalhe.quantidade_sacos) * 100 : 0;

      await supabase.from("recebimentos_transferencia").update({
        status: "finalizado",
        quantidade_recebida: q,
        recebido_por: user?.id ?? null,
        foto_url: fotoUrl,
        observacao: obsReceb.trim() || null,
        data_recebimento: now.toISOString().slice(0, 10),
        hora_recebimento: now.toTimeString().slice(0, 8),
        divergencia_sacos: divergSacos,
        divergencia_percentual: Number(divergPct.toFixed(2)),
      }).eq("id", recebimento.id);

      await supabase.from("transferencias_fabrica").update({ status: "concluida" }).eq("id", detalhe.id);

      // Somar ao estoque_retiro (destino retiro) — ciclo mês/ano atual
      if (detalhe.retiro_destino_id) {
        const mes = now.getMonth() + 1;
        const ano = now.getFullYear();
        const { data: existing } = await supabase.from("estoque_retiro")
          .select("id,quantidade_atual")
          .eq("retiro_id", detalhe.retiro_destino_id)
          .eq("mes", mes).eq("ano", ano).maybeSingle();
        if (existing) {
          await supabase.from("estoque_retiro").update({
            quantidade_atual: Number(existing.quantidade_atual || 0) + q,
          }).eq("id", existing.id);
        } else {
          await supabase.from("estoque_retiro").insert({
            retiro_id: detalhe.retiro_destino_id,
            mes, ano, quantidade_atual: q,
          });
        }
      }

      // Remover notificações relacionadas (não lidas ou lidas) — filtro pelo dados.transferencia_id
      const { data: notifs } = await supabase.from("notificacoes")
        .select("id,dados").eq("tipo", "transferencia_fabrica");
      const ids = (notifs || []).filter((n: any) => n?.dados?.transferencia_id === detalhe.id).map((n: any) => n.id);
      if (ids.length) await supabase.from("notificacoes").delete().in("id", ids);

      const alerta = Math.abs(divergPct) > 5
        ? ` (divergência ${divergPct >= 0 ? "-" : "+"}${Math.abs(divergPct).toFixed(1)}%)`
        : "";
      toast.success("Recebimento concluído" + alerta);
      fecharDetalhe();
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {transferencias.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma transferência em trânsito.</CardContent></Card>
      ) : transferencias.map(t => (
        <Card key={t.id} className="cursor-pointer hover:border-primary" onClick={() => abrirDetalhe(t)}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{produtos[t.produto_id]?.nome || "—"}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {destinoLabel(t, fazendas, retiros)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.quantidade_sacos} sc • {Number(t.quantidade_kg).toFixed(1)} kg • {t.criado_em ? new Date(t.criado_em).toLocaleString("pt-BR") : ""}
                </p>
              </div>
            </div>
            <Badge variant={t.status === "em_recebimento" ? "default" : "secondary"}>
              {t.status === "em_recebimento" ? "Em recebimento" : "Em trânsito"}
            </Badge>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!detalhe} onOpenChange={o => !o && fecharDetalhe()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receber Transferência</DialogTitle>
            <DialogDescription>
              {detalhe && `${produtos[detalhe.produto_id]?.nome || "—"} • ${destinoLabel(detalhe, fazendas, retiros)}`}
            </DialogDescription>
          </DialogHeader>
          {bloqueado ? (
            <div className="p-4 rounded border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                {!podeReceber
                  ? "Apenas usuários da fazenda de destino (gerente, capataz ou administrador) podem confirmar o recebimento."
                  : "Recebimento em andamento por outro responsável."}
              </div>
            </div>
          ) : detalhe && (
            <div className="space-y-3">
              <div className="rounded border p-3 text-sm bg-muted/30 space-y-1">
                <div><span className="text-muted-foreground">Enviado:</span> <strong>{detalhe.quantidade_sacos} sacos</strong> ({Number(detalhe.quantidade_kg).toFixed(1)} kg)</div>
                <div><span className="text-muted-foreground">Data envio:</span> {detalhe.criado_em ? new Date(detalhe.criado_em).toLocaleString("pt-BR") : "—"}</div>
                {detalhe.observacao && <div><span className="text-muted-foreground">Obs. envio:</span> {detalhe.observacao}</div>}
              </div>
              <div>
                <Label>Quantidade Recebida (sacos) *</Label>
                <Input type="number" step="1" value={qtdReceb} onChange={e => setQtdReceb(e.target.value)} />
                {qtdReceb && parseFloat(qtdReceb) > 0 && (
                  (() => {
                    const q = parseFloat(qtdReceb);
                    const d = detalhe.quantidade_sacos - q;
                    const pct = detalhe.quantidade_sacos > 0 ? (d / detalhe.quantidade_sacos) * 100 : 0;
                    return (
                      <p className={`text-xs mt-1 ${Math.abs(pct) > 5 ? "text-destructive" : "text-muted-foreground"}`}>
                        Divergência: {d >= 0 ? "-" : "+"}{Math.abs(d)} sc ({Math.abs(pct).toFixed(1)}%)
                      </p>
                    );
                  })()
                )}
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea value={obsReceb} onChange={e => setObsReceb(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Foto (opcional)</Label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
                {fotoReceb ? (
                  <div className="relative">
                    <img src={fotoReceb} alt="foto" className="w-full rounded border" />
                    <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={() => setFotoReceb(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
                    <Camera className="w-4 h-4 mr-1" /> Capturar / Enviar
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={fecharDetalhe} disabled={saving}>Fechar</Button>
            {!bloqueado && (
              <Button onClick={confirmarRecebimento} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <PackageCheck className="w-4 h-4 mr-1" /> Confirmar Recebimento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================ HISTÓRICO ============================ */
function HistoricoSection({ fabricaId }: { fabricaId: string }) {
  const { fazendas, retiros } = useDestinos(fabricaId);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [produtos, setProdutos] = useState<Record<string, Produto>>({});
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<Transferencia | null>(null);
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null);

  useEffect(() => { load(); }, [fabricaId]);
  async function load() {
    setLoading(true);
    const { data: t } = await supabase.from("transferencias_fabrica")
      .select("*").eq("fabrica_id", fabricaId).order("criado_em", { ascending: false });
    const list = (t as Transferencia[]) || [];
    setTransferencias(list);
    const fIds = Array.from(new Set(list.map(x => x.produto_id)));
    if (fIds.length) {
      const { data: fs } = await supabase.from("produtos").select("id,nome,peso_saco_kg").in("id", fIds);
      setProdutos(Object.fromEntries(((fs as Produto[]) || []).map(f => [f.id, f])));
    }
    setLoading(false);
  }

  async function abrir(t: Transferencia) {
    setDetalhe(t);
    const { data: r } = await supabase.from("recebimentos_transferencia")
      .select("*").eq("transferencia_id", t.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    setRecebimento((r as Recebimento) || null);
  }

  function statusBadge(s: string | null) {
    switch (s) {
      case "concluida": return <Badge className="bg-green-600">Concluída</Badge>;
      case "em_recebimento": return <Badge>Em recebimento</Badge>;
      case "em_transito": return <Badge variant="secondary">Em trânsito</Badge>;
      default: return <Badge variant="outline">{s || "—"}</Badge>;
    }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {transferencias.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma transferência registrada.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Produto</TableHead>
                <TableHead>Destino</TableHead><TableHead className="text-right">Sacos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transferencias.map(t => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => abrir(t)}>
                    <TableCell className="text-xs">{t.criado_em ? new Date(t.criado_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-sm">{produtos[t.produto_id]?.nome || "—"}</TableCell>
                    <TableCell className="text-xs">{destinoLabel(t, fazendas, retiros)}</TableCell>
                    <TableCell className="text-right">{t.quantidade_sacos}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detalhe} onOpenChange={o => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes da Transferência</DialogTitle></DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Produto:</span> {produtos[detalhe.produto_id]?.nome || "—"}</div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(detalhe.status)}</div>
                <div><span className="text-muted-foreground">Destino:</span> {destinoLabel(detalhe, fazendas, retiros)}</div>
                <div><span className="text-muted-foreground">Enviado:</span> {detalhe.quantidade_sacos} sc / {Number(detalhe.quantidade_kg).toFixed(1)} kg</div>
                <div><span className="text-muted-foreground">Enviado em:</span> {detalhe.criado_em ? new Date(detalhe.criado_em).toLocaleString("pt-BR") : "—"}</div>
                {recebimento?.data_recebimento && <div><span className="text-muted-foreground">Recebido em:</span> {recebimento.data_recebimento} {recebimento.hora_recebimento || ""}</div>}
              </div>
              {detalhe.observacao && <div className="p-2 rounded border bg-muted/30"><span className="text-muted-foreground">Obs. envio:</span> {detalhe.observacao}</div>}
              {recebimento?.observacao && <div className="p-2 rounded border bg-muted/30"><span className="text-muted-foreground">Obs. recebimento:</span> {recebimento.observacao}</div>}
              {recebimento && recebimento.status === "finalizado" && (
                <div className={`p-2 rounded border ${Math.abs(Number(recebimento.divergencia_percentual || 0)) > 5 ? "border-destructive bg-destructive/10 text-destructive" : "bg-muted/30"}`}>
                  Recebido: <strong>{recebimento.quantidade_recebida} sc</strong>
                  {" • "}Divergência: {recebimento.divergencia_sacos} sc ({Number(recebimento.divergencia_percentual || 0).toFixed(1)}%)
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {detalhe.foto_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Foto envio</p>
                    <img src={detalhe.foto_url} alt="envio" className="w-full rounded border" />
                  </div>
                )}
                {recebimento?.foto_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Foto recebimento</p>
                    <img src={recebimento.foto_url} alt="recebimento" className="w-full rounded border" />
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
