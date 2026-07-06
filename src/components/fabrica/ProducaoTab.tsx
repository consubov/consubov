import { useEffect, useRef, useState, useMemo } from "react";
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
  Plus, Loader2, Play, CheckCircle2, Camera, X, AlertTriangle,
  TrendingUp, History, Factory, Package, Clock, QrCode,
} from "lucide-react";


import { toast } from "sonner";
import QrScanner from "@/components/capataz/QrScanner";


const TOLERANCIA_PCT = 5;

interface MateriaPrima {
  id: string; nome: string; unidade: string; estoque_atual: number | null; peso_por_saco: number | null;
}
interface Produto { id: string; nome: string; peso_saco_kg: number | null; }
interface Formula {
  id: string; nome: string; peso_batida: number | null;
  peso_por_saco: number | null; producao_esperada: number | null; ativo: boolean | null;
  produto_id: string | null;
}
interface Ingrediente {
  formula_id: string; materia_prima_id: string; quantidade: number;
}
interface Batida {
  id: string; fabrica_id: string; formula_id: string; operador_id: string | null;
  data_inicio: string; hora_inicio: string;
  data_finalizacao: string | null; hora_finalizacao: string | null;
  quantidade_produzida: number | null; status: string;
  foto_inicio_url: string | null; foto_finalizacao_url: string | null;
  observacao: string | null; criado_em: string;
}
interface BatidaProd {
  id: string; batida_id: string; materia_prima_id: string;
  quantidade_esperada: number | null; quantidade_utilizada: number | null;
}
type FotoBatida = { blob: Blob; fileName: string; type: string; size: number };

function isMateriaEmSaco(mp?: MateriaPrima) {
  return mp?.unidade === "saco" && Number(mp.peso_por_saco ?? 0) > 0;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatMateriaQuantidade(quantidadeKg: number | null | undefined, mp?: MateriaPrima, arredondarSacos = true) {
  const raw = Number(quantidadeKg ?? 0);
  if (isMateriaEmSaco(mp)) {
    const peso = Number(mp?.peso_por_saco ?? 0);
    const sacos = raw / peso;
    return `${formatNumber(arredondarSacos ? Math.ceil(sacos) : sacos)} sacos`;
  }
  return `${formatNumber(raw)} ${mp?.unidade || ""}`.trim();
}

function formatMateriaEstoque(estoqueKg: number | null | undefined, mp?: MateriaPrima) {
  const raw = Number(estoqueKg ?? 0);
  if (isMateriaEmSaco(mp)) {
    return `${formatNumber(raw)} sacos`;
  }
  return `${formatNumber(raw)} ${mp?.unidade || ""}`.trim();
}

function getMateriaQuantidadeEmEstoque(quantidadeKg: number, mp?: MateriaPrima) {
  if (!isMateriaEmSaco(mp)) return quantidadeKg;
  return Math.ceil(quantidadeKg / Number(mp?.peso_por_saco ?? 1));
}

function hasEstoqueSuficiente(quantidadeKg: number, mp?: MateriaPrima) {
  const estoque = Number(mp?.estoque_atual ?? 0);
  return estoque >= getMateriaQuantidadeEmEstoque(quantidadeKg, mp);
}

export default function ProducaoTab({ fabricaId }: { fabricaId: string }) {
  return (
    <Tabs defaultValue="nova" className="w-full">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="nova"><Play className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Nova / Em andamento</span><span className="sm:hidden">Nova</span></TabsTrigger>
        <TabsTrigger value="historico"><History className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Histórico</span></TabsTrigger>
        <TabsTrigger value="eficiencia"><TrendingUp className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Eficiência</span></TabsTrigger>
      </TabsList>
      <TabsContent value="nova" className="mt-4"><NovaBatidaSection fabricaId={fabricaId} /></TabsContent>
      <TabsContent value="historico" className="mt-4"><HistoricoSection fabricaId={fabricaId} /></TabsContent>
      <TabsContent value="eficiencia" className="mt-4"><EficienciaSection fabricaId={fabricaId} /></TabsContent>
    </Tabs>
  );
}

/* -------------------- NOVA BATIDA + EM ANDAMENTO -------------------- */

function NovaBatidaSection({ fabricaId }: { fabricaId: string }) {
  const { user } = useAuth();
  const [operadorId, setOperadorId] = useState<string | null>(null);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [materias, setMaterias] = useState<MateriaPrima[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [emAndamento, setEmAndamento] = useState<Batida[]>([]);
  const [fabricaQr, setFabricaQr] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(true);



  const [dialogOpen, setDialogOpen] = useState(false);
  const [formulaId, setFormulaId] = useState("");
  const [foto, setFoto] = useState<FotoBatida | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"inicio" | "fim" | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [batidaFinalizando, setBatidaFinalizando] = useState<Batida | null>(null);
  const [prodFinalizar, setProdFinalizar] = useState<BatidaProd[]>([]);
  const [qtdProduzida, setQtdProduzida] = useState("");
  const [fotoFim, setFotoFim] = useState<FotoBatida | null>(null);
  const [obsFim, setObsFim] = useState("");

  useEffect(() => { load(); }, [fabricaId]);

  useEffect(() => {
    let cancelled = false;

    function stopStream() {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function startCamera() {
      if (!cameraTarget) {
        stopStream();
        return;
      }

      setCameraLoading(true);
      setCameraError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Câmera indisponível neste navegador");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 960, max: 1280 },
            height: { ideal: 720, max: 960 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "Não foi possível abrir a câmera");
      } finally {
        if (!cancelled) setCameraLoading(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [cameraTarget]);

  async function load() {
    setLoading(true);
    const [fm, mp, ba, pr, op, fab] = await Promise.all([
      supabase.from("formulas_fabrica").select("*").eq("fabrica_id", fabricaId).eq("ativo", true).order("nome"),
      supabase.from("materias_primas").select("id, nome, unidade, estoque_atual, peso_por_saco").eq("fabrica_id", fabricaId).eq("ativo", true).order("nome"),
      supabase.from("batidas").select("*").eq("fabrica_id", fabricaId).eq("status", "iniciada").order("criado_em", { ascending: false }),
      supabase.from("produtos").select("id, nome, peso_saco_kg").eq("ativo", true),
      user?.id
        ? supabase.from("operadores_fabrica").select("id").eq("user_id", user.id).eq("fabrica_id", fabricaId).eq("ativo", true).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("fabricas").select("qr_code").eq("id", fabricaId).maybeSingle(),
    ]);
    setFormulas((fm.data as Formula[]) || []);
    setMaterias((mp.data as MateriaPrima[]) || []);
    setEmAndamento((ba.data as Batida[]) || []);
    setProdutos((pr.data as Produto[]) || []);
    setOperadorId(((op as any)?.data?.id as string | undefined) ?? null);
    setFabricaQr(((fab as any)?.data?.qr_code as string | undefined) ?? null);

    if (fm.data && fm.data.length > 0) {
      const ids = (fm.data as Formula[]).map(f => f.id);
      const { data: ing } = await supabase.from("formula_ingredientes").select("formula_id, materia_prima_id, quantidade").in("formula_id", ids);
      setIngredientes((ing as Ingrediente[]) || []);
    }
    setLoading(false);
  }


  const mpMap = useMemo(() => Object.fromEntries(materias.map(m => [m.id, m])), [materias]);
  const formulaSel = formulas.find(f => f.id === formulaId);
  const ingsDaFormula = ingredientes.filter(i => i.formula_id === formulaId);

  async function capturarFotoDaCamera() {
    if (!cameraTarget || !videoRef.current) return;
    const video = videoRef.current;
    const videoWidth = video.videoWidth || 960;
    const videoHeight = video.videoHeight || 720;
    if (videoWidth <= 0 || videoHeight <= 0) {
      toast.error("A câmera ainda não está pronta");
      return;
    }

    try {
      const scale = Math.min(1, 960 / videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(videoWidth * scale);
      canvas.height = Math.round(videoHeight * scale);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Não foi possível capturar a foto");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) resolve(result);
          else reject(new Error("Não foi possível salvar a foto"));
        }, "image/jpeg", 0.68);
      });
      const fotoCapturada: FotoBatida = {
        blob,
        fileName: `batida-${cameraTarget}-${Date.now()}.jpg`,
        type: "image/jpeg",
        size: blob.size,
      };

      if (cameraTarget === "inicio") setFoto(fotoCapturada);
      else setFotoFim(fotoCapturada);
      setCameraTarget(null);
      toast.success("Foto capturada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível capturar a foto");
    }
  }

  async function uploadFoto(file: FotoBatida): Promise<string> {
    const path = `fabrica/${fabricaId}/batidas/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.fileName}`;
    const { error } = await supabase.storage.from("relatorios").upload(path, file.blob, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(path);
    return pub.publicUrl;
  }

  function openIniciar() {
    setFormulaId("");
    setFoto(null);
    setDialogOpen(true);
  }

  function handleQrScan(value: string) {
    const scanned = (value || "").trim();
    const esperado = (fabricaQr || fabricaId).trim();
    const alt = fabricaId.trim();
    if (scanned && (scanned === esperado || scanned === alt)) {
      setScannerOpen(false);
      toast.success("Fábrica identificada");
      openIniciar();
    } else {
      setScannerOpen(false);
      toast.error("QR Code não corresponde à sua fábrica");
    }
  }


  async function iniciarBatida() {
    if (!formulaId) return toast.error("Selecione uma fórmula");
    if (!foto) return toast.error("Foto do setup inicial é obrigatória");
    if (ingsDaFormula.length === 0) return toast.error("Fórmula sem ingredientes");

    // Checar estoque
    const faltando = ingsDaFormula.filter(i => !hasEstoqueSuficiente(Number(i.quantidade), mpMap[i.materia_prima_id]));
    if (faltando.length > 0) {
      const nomes = faltando.map(i => mpMap[i.materia_prima_id]?.nome || "?").join(", ");
      if (!confirm(`Estoque insuficiente para: ${nomes}. Continuar mesmo assim?`)) return;
    }

    setSaving(true);
    try {
      const fotoUrl = await uploadFoto(foto);
      const now = new Date();
      const dataInicio = now.toISOString().slice(0, 10);
      const horaInicio = now.toTimeString().slice(0, 8);

      const { data: batida, error: bErr } = await supabase.from("batidas").insert({
        fabrica_id: fabricaId,
        formula_id: formulaId,
        operador_id: operadorId,
        data_inicio: dataInicio,
        hora_inicio: horaInicio,
        status: "iniciada",
        foto_inicio_url: fotoUrl,
      }).select().single();
      if (bErr) throw bErr;

      // Registros de produção
      const prodRows = ingsDaFormula.map(i => ({
        batida_id: batida.id,
        materia_prima_id: i.materia_prima_id,
        quantidade_esperada: i.quantidade,
      }));
      const { error: pErr } = await supabase.from("batidas_producao").insert(prodRows);
      if (pErr) throw pErr;

      // Baixar estoque
      for (const i of ingsDaFormula) {
        const mp = mpMap[i.materia_prima_id];
        const atual = Number(mp?.estoque_atual ?? 0);
        const novo = Math.max(0, atual - getMateriaQuantidadeEmEstoque(Number(i.quantidade), mp));
        await supabase.from("materias_primas").update({ estoque_atual: novo }).eq("id", i.materia_prima_id);
      }

      toast.success("Batida iniciada! Estoque baixado.");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function openFinalizar(b: Batida) {
    setBatidaFinalizando(b);
    setQtdProduzida("");
    setFotoFim(null);
    setObsFim("");
    const { data } = await supabase.from("batidas_producao").select("*").eq("batida_id", b.id);
    setProdFinalizar((data as BatidaProd[]) || []);
    setFinalizarOpen(true);
  }

  async function finalizarBatida() {
    if (!batidaFinalizando) return;
    const qtd = parseFloat(qtdProduzida);
    if (!qtd || qtd <= 0) return toast.error("Quantidade produzida inválida");
    if (!fotoFim) return toast.error("Foto obrigatória");

    setSaving(true);
    try {
      const fotoUrl = await uploadFoto(fotoFim);
      const now = new Date();
      const dataFim = now.toISOString().slice(0, 10);
      const horaFim = now.toTimeString().slice(0, 8);

      // Preencher quantidade_utilizada = esperada (padrão)
      for (const p of prodFinalizar) {
        await supabase.from("batidas_producao").update({
          quantidade_utilizada: p.quantidade_esperada,
        }).eq("id", p.id);
      }

      const { error } = await supabase.from("batidas").update({
        status: "finalizada",
        quantidade_produzida: qtd,
        data_finalizacao: dataFim,
        hora_finalizacao: horaFim,
        foto_finalizacao_url: fotoUrl,
        observacao: obsFim.trim() || null,
      }).eq("id", batidaFinalizando.id);
      if (error) throw error;

      // Atualizar estoque_produto_acabado (por PRODUTO, não por fórmula)
      const formula = formulas.find(f => f.id === batidaFinalizando.formula_id);
      const produto = produtos.find(p => p.id === formula?.produto_id);
      if (!formula?.produto_id) {
        toast.warning("Fórmula sem produto vinculado — estoque de produto acabado NÃO foi atualizado. Edite a fórmula.");
      } else {
        // Preferir peso_saco_kg do produto; fallback para peso_por_saco da fórmula
        const pesoPorSaco = Number(produto?.peso_saco_kg ?? formula.peso_por_saco ?? 0);
        const kg = qtd * pesoPorSaco;

        const { data: existing } = await supabase.from("estoque_produto_acabado")
          .select("id, quantidade_sacos, quantidade_kg")
          .eq("fabrica_id", fabricaId).eq("produto_id", formula.produto_id).maybeSingle();

        if (existing) {
          await supabase.from("estoque_produto_acabado").update({
            quantidade_sacos: Number(existing.quantidade_sacos || 0) + qtd,
            quantidade_kg: Number(existing.quantidade_kg || 0) + kg,
          }).eq("id", existing.id);
        } else {
          await supabase.from("estoque_produto_acabado").insert({
            fabrica_id: fabricaId,
            produto_id: formula.produto_id,
            quantidade_sacos: qtd,
            quantidade_kg: kg,
          });
        }
      }

      // Calcular divergência
      const esperada = formula?.producao_esperada ?? 0;
      const dif = esperada > 0 ? ((qtd - esperada) / esperada) * 100 : 0;
      const msg = esperada > 0
        ? `Batida finalizada! Esperado: ${esperada} sc • Produzido: ${qtd} sc • ${dif >= 0 ? "+" : ""}${dif.toFixed(1)}%`
        : "Batida finalizada!";
      if (Math.abs(dif) > TOLERANCIA_PCT) toast.warning(msg + " (divergência acima da tolerância)");
      else toast.success(msg);

      setFinalizarOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Play className="w-4 h-4" /> Iniciar batida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={() => setScannerOpen(true)} size="lg" className="w-full gap-2 bg-primary hover:bg-primary/90" disabled={formulas.length === 0}>
            <QrCode className="w-5 h-5" /> Escanear QR da fábrica
          </Button>
          <Button onClick={openIniciar} size="sm" variant="outline" className="w-full gap-1.5" disabled={formulas.length === 0}>
            <Plus className="w-4 h-4" /> Iniciar sem QR
          </Button>
          {formulas.length === 0 && (
            <p className="text-sm text-muted-foreground">Cadastre uma fórmula antes de iniciar batidas.</p>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Em andamento ({emAndamento.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {emAndamento.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma batida em andamento.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead><TableHead>Fórmula</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emAndamento.map(b => {
                    const f = formulas.find(x => x.id === b.formula_id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs">
                          {new Date(b.data_inicio).toLocaleDateString("pt-BR")} {b.hora_inicio?.slice(0, 5)}
                        </TableCell>
                        <TableCell className="font-medium">{f?.nome || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openFinalizar(b)}>
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Finalizar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Iniciar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Iniciar nova batida</DialogTitle>
            <DialogDescription>Selecione a fórmula e confirme o setup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fórmula *</Label>
              <Select value={formulaId} onValueChange={setFormulaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a fórmula" /></SelectTrigger>
                <SelectContent>
                  {formulas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formulaSel && ingsDaFormula.length > 0 && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Ingredientes necessários</p>
                {ingsDaFormula.map((i, idx) => {
                  const mp = mpMap[i.materia_prima_id];
                  const qtdExibida = formatMateriaQuantidade(i.quantidade, mp);
                  const estExibido = formatMateriaEstoque(mp?.estoque_atual, mp);
                  const falta = !hasEstoqueSuficiente(Number(i.quantidade), mp);
                  return (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{mp?.nome || "?"}</span>
                      <span className={falta ? "text-destructive font-semibold flex items-center gap-1" : ""}>
                        {falta && <AlertTriangle className="w-3.5 h-3.5" />}
                        {qtdExibida} <span className="text-muted-foreground">(est: {estExibido})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <Label>Foto do setup inicial *</Label>
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setCameraTarget("inicio")}>
                  <Camera className="w-4 h-4" />
                  {foto ? "Trocar foto" : "Tirar foto"}
                </Button>
                {foto && (
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  <span>Foto capturada</span>
                    <button type="button" onClick={() => setFoto(null)} className="rounded-full bg-destructive p-0.5 text-destructive-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={iniciarBatida} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Finalizar */}
      <Dialog open={finalizarOpen} onOpenChange={setFinalizarOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar batida</DialogTitle>
            <DialogDescription>
              {batidaFinalizando && formulas.find(f => f.id === batidaFinalizando.formula_id)?.nome} — iniciada às {batidaFinalizando?.hora_inicio?.slice(0, 5)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {prodFinalizar.length > 0 && (
              <div className="border rounded p-3 bg-muted/30 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Ingredientes utilizados</p>
                {prodFinalizar.map(p => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span>{mpMap[p.materia_prima_id]?.nome || "?"}</span>
                    <span>{formatMateriaQuantidade(p.quantidade_esperada, mpMap[p.materia_prima_id])}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label>Quantidade produzida (sacos) *</Label>
              <Input type="number" step="0.01" value={qtdProduzida} onChange={e => setQtdProduzida(e.target.value)} />
              {batidaFinalizando && (() => {
                const f = formulas.find(x => x.id === batidaFinalizando.formula_id);
                const esp = f?.producao_esperada ?? 0;
                return esp > 0 ? <p className="text-xs text-muted-foreground mt-1">Esperado: {esp} sacos</p> : null;
              })()}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={obsFim} onChange={e => setObsFim(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Foto final *</Label>
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setCameraTarget("fim")}>
                  <Camera className="w-4 h-4" />
                  {fotoFim ? "Trocar foto" : "Tirar foto"}
                </Button>
                {fotoFim && (
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                    <span>Foto capturada</span>
                    <button type="button" onClick={() => setFotoFim(null)} className="rounded-full bg-destructive p-0.5 text-destructive-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizarOpen(false)}>Cancelar</Button>
            <Button onClick={finalizarBatida} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cameraTarget} onOpenChange={open => !open && setCameraTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{cameraTarget === "fim" ? "Foto final" : "Foto do setup inicial"}</DialogTitle>
            <DialogDescription>Capture a foto dentro do aplicativo para evitar reinício do aparelho.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md border bg-muted aspect-[4/3] flex items-center justify-center">
              {cameraLoading && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
              {cameraError ? (
                <div className="p-4 text-center text-sm text-destructive">{cameraError}</div>
              ) : (
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraTarget(null)}>Cancelar</Button>
            <Button onClick={capturarFotoDaCamera} disabled={cameraLoading || !!cameraError} className="bg-primary hover:bg-primary/90">
              <Camera className="w-4 h-4 mr-2" /> Capturar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {scannerOpen && (
        <QrScanner
          onScan={handleQrScan}
          onManualSelect={() => { setScannerOpen(false); openIniciar(); }}
          onBack={() => setScannerOpen(false)}
        />
      )}
    </div>

  );
}

/* -------------------- HISTÓRICO -------------------- */

function HistoricoSection({ fabricaId }: { fabricaId: string }) {
  const [items, setItems] = useState<Batida[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [materias, setMaterias] = useState<Record<string, MateriaPrima>>({});
  const [loading, setLoading] = useState(true);
  const [detOpen, setDetOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Batida | null>(null);
  const [detProd, setDetProd] = useState<BatidaProd[]>([]);

  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const [b, f, m] = await Promise.all([
      supabase.from("batidas").select("*").eq("fabrica_id", fabricaId).order("data_inicio", { ascending: false }).order("hora_inicio", { ascending: false }).limit(100),
      supabase.from("formulas_fabrica").select("*").eq("fabrica_id", fabricaId),
      supabase.from("materias_primas").select("id, nome, unidade, estoque_atual, peso_por_saco").eq("fabrica_id", fabricaId),
    ]);
    setItems((b.data as Batida[]) || []);
    setFormulas((f.data as Formula[]) || []);
    const mMap: Record<string, MateriaPrima> = {};
    ((m.data as MateriaPrima[]) || []).forEach(x => { mMap[x.id] = x; });
    setMaterias(mMap);
    setLoading(false);
  }

  async function openDetalhe(b: Batida) {
    setDetalhe(b);
    const { data } = await supabase.from("batidas_producao").select("*").eq("batida_id", b.id);
    setDetProd((data as BatidaProd[]) || []);
    setDetOpen(true);
  }

  const fMap = Object.fromEntries(formulas.map(f => [f.id, f]));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Histórico de batidas</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma batida registrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead className="text-right">Produzido</TableHead>
                  <TableHead>Divergência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(b => {
                  const f = fMap[b.formula_id];
                  const esp = f?.producao_esperada ?? 0;
                  const prod = Number(b.quantidade_produzida ?? 0);
                  const dif = esp > 0 && prod > 0 ? ((prod - esp) / esp) * 100 : 0;
                  const divAlta = Math.abs(dif) > TOLERANCIA_PCT;
                  return (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetalhe(b)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(b.data_inicio).toLocaleDateString("pt-BR")}<br />
                        <span className="text-muted-foreground">{b.hora_inicio?.slice(0, 5)}</span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {b.data_finalizacao ? (
                          <>
                            {new Date(b.data_finalizacao).toLocaleDateString("pt-BR")}<br />
                            <span className="text-muted-foreground">{b.hora_finalizacao?.slice(0, 5)}</span>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{f?.nome || "—"}</TableCell>
                      <TableCell className="text-right">{b.quantidade_produzida ?? "—"}</TableCell>
                      <TableCell>
                        {b.status === "finalizada" && esp > 0 ? (
                          <span className={divAlta ? "text-destructive font-semibold" : "text-primary"}>
                            {dif >= 0 ? "+" : ""}{dif.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === "finalizada" ? "default" : "secondary"}>
                          {b.status === "finalizada" ? "Finalizada" : "Iniciada"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={detOpen} onOpenChange={setDetOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe da batida</DialogTitle>
            <DialogDescription>{detalhe && fMap[detalhe.formula_id]?.nome}</DialogDescription>
          </DialogHeader>
          {detalhe && (() => {
            const f = fMap[detalhe.formula_id];
            const esp = f?.producao_esperada ?? 0;
            const prod = Number(detalhe.quantidade_produzida ?? 0);
            const dif = esp > 0 && prod > 0 ? ((prod - esp) / esp) * 100 : 0;
            const divAlta = Math.abs(dif) > TOLERANCIA_PCT;
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Início:</span> {new Date(detalhe.data_inicio).toLocaleDateString("pt-BR")} {detalhe.hora_inicio?.slice(0, 5)}</div>
                  {detalhe.data_finalizacao && (
                    <div><span className="text-muted-foreground">Fim:</span> {new Date(detalhe.data_finalizacao).toLocaleDateString("pt-BR")} {detalhe.hora_finalizacao?.slice(0, 5)}</div>
                  )}
                  <div><span className="text-muted-foreground">Esperado:</span> {esp} sc</div>
                  <div><span className="text-muted-foreground">Produzido:</span> {detalhe.quantidade_produzida ?? "—"} sc</div>
                  {detalhe.status === "finalizada" && esp > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Divergência:</span>{" "}
                      <span className={divAlta ? "text-destructive font-semibold" : "text-primary font-semibold"}>
                        {dif >= 0 ? "+" : ""}{dif.toFixed(1)}%
                      </span>
                      {divAlta && <span className="text-xs text-destructive ml-2">(acima da tolerância de ±{TOLERANCIA_PCT}%)</span>}
                    </div>
                  )}
                </div>
                {detalhe.observacao && (
                  <div><span className="text-muted-foreground">Observação:</span> {detalhe.observacao}</div>
                )}
                {detProd.length > 0 && (
                  <div className="border rounded p-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Ingredientes utilizados</p>
                    {detProd.map(p => (
                      <div key={p.id} className="flex justify-between text-xs py-0.5">
                        <span>{materias[p.materia_prima_id]?.nome || "?"}</span>
                        <span>{formatMateriaQuantidade(p.quantidade_utilizada ?? p.quantidade_esperada, materias[p.materia_prima_id])}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {detalhe.foto_inicio_url && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Foto inicial</p>
                      <img src={detalhe.foto_inicio_url} alt="início" className="w-full rounded border" />
                    </div>
                  )}
                  {detalhe.foto_finalizacao_url && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Foto final</p>
                      <img src={detalhe.foto_finalizacao_url} alt="fim" className="w-full rounded border" />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- EFICIÊNCIA -------------------- */

function EficienciaSection({ fabricaId }: { fabricaId: string }) {
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes">("mes");
  const [loading, setLoading] = useState(true);
  const [teorica, setTeorica] = useState(0);
  const [declarada, setDeclarada] = useState(0);
  const [numBatidas, setNumBatidas] = useState(0);

  useEffect(() => { load(); }, [fabricaId, periodo]);

  async function load() {
    setLoading(true);
    const now = new Date();
    let inicio: Date;
    if (periodo === "hoje") {
      inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (periodo === "semana") {
      inicio = new Date(now); inicio.setDate(now.getDate() - 7);
    } else {
      inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const inicioStr = inicio.toISOString().slice(0, 10);

    const { data: batidas } = await supabase.from("batidas")
      .select("id, formula_id, quantidade_produzida, status")
      .eq("fabrica_id", fabricaId).eq("status", "finalizada")
      .gte("data_inicio", inicioStr);

    const { data: formulas } = await supabase.from("formulas_fabrica")
      .select("id, producao_esperada").eq("fabrica_id", fabricaId);

    const fMap = Object.fromEntries((formulas || []).map((f: any) => [f.id, Number(f.producao_esperada ?? 0)]));
    let dec = 0, teo = 0;
    (batidas || []).forEach((b: any) => {
      dec += Number(b.quantidade_produzida ?? 0);
      teo += fMap[b.formula_id] ?? 0;
    });
    setDeclarada(dec);
    setTeorica(teo);
    setNumBatidas((batidas || []).length);
    setLoading(false);
  }

  const dif = teorica - declarada;
  const eficiencia = teorica > 0 ? (declarada / teorica) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["hoje", "semana", "mes"] as const).map(p => (
          <Button key={p} size="sm" variant={periodo === p ? "default" : "outline"} onClick={() => setPeriodo(p)}
            className={periodo === p ? "bg-primary hover:bg-primary/90" : ""}>
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5"><Factory className="w-3.5 h-3.5" /> Batidas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{numBatidas}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Prod. teórica</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{teorica.toFixed(0)}<span className="text-xs text-muted-foreground ml-1">sc</span></p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Prod. declarada</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{declarada.toFixed(0)}<span className="text-xs text-muted-foreground ml-1">sc</span></p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Eficiência</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${eficiencia >= 95 ? "text-primary" : eficiencia >= 85 ? "text-secondary" : "text-destructive"}`}>
                {eficiencia.toFixed(1)}<span className="text-xs ml-1">%</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && teorica > 0 && (
        <Card>
          <CardContent className="p-4 text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Diferença (teórica − declarada):</span>
              <span className={`font-semibold ${dif > 0 ? "text-destructive" : "text-primary"}`}>{dif >= 0 ? "+" : ""}{dif.toFixed(0)} sc</span>
            </div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Tolerância configurada:</span>
              <span>± {TOLERANCIA_PCT}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
