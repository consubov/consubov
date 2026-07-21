import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, ArrowLeft, Trash2, Workflow, Snowflake, Layers } from "lucide-react";

type Estacao = {
  id: string; fazenda_id: string; nome: string;
  data_inicio: string | null; data_fim: string | null;
  status: string; observacoes: string | null;
};
type Proto = { id: string; nome: string; descricao: string | null };
type Etapa = { id: string; protocolo_id: string; dia_offset: number; nome_etapa: string | null };
type EstProto = { id: string; estacao_id: string; protocolo_id: string; preco_por_cabeca: number; observacoes: string | null };
type Semen = { id: string; touro: string; central: string | null; raca: string | null };
type EstSemen = { id: string; estacao_id: string; semen_id: string; valor_unitario: number | null; observacoes: string | null };
type Lote = { id: string; nome: string; categoria: string | null };
type Ciclo = {
  id: string; estacao_id: string; lote_id: string; protocolo_id: string;
  data_d0: string; status: string; observacoes: string | null; created_at: string;
};

const CICLO_STATUS: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const ESTACAO_STATUS: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function SyncVetEstacaoDetalhePage() {
  const { fazendaId, estacaoId } = useParams<{ fazendaId: string; estacaoId: string }>();
  const navigate = useNavigate();
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;

  const [estacao, setEstacao] = useState<Estacao | null>(null);
  const [loading, setLoading] = useState(true);

  const [protocolos, setProtocolos] = useState<Proto[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [estProtos, setEstProtos] = useState<EstProto[]>([]);
  const [semens, setSemens] = useState<Semen[]>([]);
  const [estSemens, setEstSemens] = useState<EstSemen[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);

  // Add protocolo dialog
  const [addProtoOpen, setAddProtoOpen] = useState(false);
  const [addProtoId, setAddProtoId] = useState("");
  const [addProtoPreco, setAddProtoPreco] = useState("");
  const [addProtoObs, setAddProtoObs] = useState("");

  // Add sêmen dialog
  const [addSemOpen, setAddSemOpen] = useState(false);
  const [addSemId, setAddSemId] = useState("");
  const [addSemValor, setAddSemValor] = useState("");
  const [addSemObs, setAddSemObs] = useState("");

  // Novo ciclo dialog
  const [cicloOpen, setCicloOpen] = useState(false);
  const [cicloLote, setCicloLote] = useState<Lote | null>(null);
  const [cicloProtoId, setCicloProtoId] = useState("");
  const [cicloD0, setCicloD0] = useState("");
  const [cicloObs, setCicloObs] = useState("");
  const [cicloStatus, setCicloStatus] = useState("em_andamento");

  // Edit estação status
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusVal, setStatusVal] = useState("planejada");

  async function load() {
    if (!estacaoId || !empresaId || !fazendaId) return;
    setLoading(true);
    const [est, protos, allEtapas, epList, sems, esList, ls, cs] = await Promise.all([
      (supabase as any).from("syncvet_estacoes_monta").select("*").eq("id", estacaoId).maybeSingle(),
      supabase.from("syncvet_protocolos").select("id, nome, descricao").eq("empresa_id", empresaId).order("nome"),
      supabase.from("syncvet_protocolo_etapas").select("*"),
      (supabase as any).from("syncvet_estacao_protocolos").select("*").eq("estacao_id", estacaoId),
      supabase.from("syncvet_semen").select("id, touro, central, raca").eq("empresa_id", empresaId).order("touro"),
      (supabase as any).from("syncvet_estacao_semen").select("*").eq("estacao_id", estacaoId),
      supabase.from("syncvet_lotes").select("id, nome, categoria").eq("fazenda_id", fazendaId).order("nome"),
      (supabase as any).from("syncvet_lote_ciclos").select("*").eq("estacao_id", estacaoId).order("created_at", { ascending: false }),
    ]);
    if ((est as any).error) toast.error((est as any).error.message);
    setEstacao((est as any).data ?? null);
    setStatusVal((est as any).data?.status ?? "planejada");
    setProtocolos(((protos as any).data as Proto[]) ?? []);
    setEtapas(((allEtapas as any).data as Etapa[]) ?? []);
    setEstProtos(((epList as any).data as EstProto[]) ?? []);
    setSemens(((sems as any).data as Semen[]) ?? []);
    setEstSemens(((esList as any).data as EstSemen[]) ?? []);
    setLotes(((ls as any).data as Lote[]) ?? []);
    setCiclos(((cs as any).data as Ciclo[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [estacaoId, empresaId, fazendaId]);

  const protoMap = useMemo(() => {
    const m: Record<string, Proto> = {};
    for (const p of protocolos) m[p.id] = p;
    return m;
  }, [protocolos]);
  const semenMap = useMemo(() => {
    const m: Record<string, Semen> = {};
    for (const s of semens) m[s.id] = s;
    return m;
  }, [semens]);
  const loteMap = useMemo(() => {
    const m: Record<string, Lote> = {};
    for (const l of lotes) m[l.id] = l;
    return m;
  }, [lotes]);
  const etapasPorProto = useMemo(() => {
    const m: Record<string, Etapa[]> = {};
    for (const e of etapas) (m[e.protocolo_id] ||= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.dia_offset - b.dia_offset);
    return m;
  }, [etapas]);
  const ciclosPorLote = useMemo(() => {
    const m: Record<string, Ciclo[]> = {};
    for (const c of ciclos) (m[c.lote_id] ||= []).push(c);
    return m;
  }, [ciclos]);

  const protocolosDisponiveis = protocolos.filter((p) => !estProtos.some((ep) => ep.protocolo_id === p.id));
  const semensDisponiveis = semens.filter((s) => !estSemens.some((es) => es.semen_id === s.id));

  async function saveEstacaoStatus() {
    if (!estacaoId) return;
    const { error } = await (supabase as any)
      .from("syncvet_estacoes_monta")
      .update({ status: statusVal })
      .eq("id", estacaoId);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); setStatusOpen(false); load(); }
  }

  async function deleteEstacao() {
    if (!estacaoId) return;
    if (!confirm("Remover esta estação e todos os seus vínculos?")) return;
    const { error } = await (supabase as any).from("syncvet_estacoes_monta").delete().eq("id", estacaoId);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); navigate(`/syncvet/fazendas/${fazendaId}`); }
  }

  async function addProtocolo() {
    if (!estacaoId) return;
    if (!addProtoId) { toast.error("Selecione um protocolo"); return; }
    const preco = parseFloat(addProtoPreco.replace(",", "."));
    if (isNaN(preco) || preco < 0) { toast.error("Preço por cabeça inválido"); return; }
    const { error } = await (supabase as any).from("syncvet_estacao_protocolos").insert({
      estacao_id: estacaoId,
      protocolo_id: addProtoId,
      preco_por_cabeca: preco,
      observacoes: addProtoObs || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Protocolo vinculado");
      setAddProtoOpen(false); setAddProtoId(""); setAddProtoPreco(""); setAddProtoObs("");
      load();
    }
  }
  async function removeProtocolo(ep: EstProto) {
    if (!confirm(`Remover protocolo "${protoMap[ep.protocolo_id]?.nome ?? ""}" da estação?`)) return;
    const { error } = await (supabase as any).from("syncvet_estacao_protocolos").delete().eq("id", ep.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  async function addSemen() {
    if (!estacaoId) return;
    if (!addSemId) { toast.error("Selecione um sêmen"); return; }
    const valor = addSemValor ? parseFloat(addSemValor.replace(",", ".")) : null;
    if (valor !== null && (isNaN(valor) || valor < 0)) { toast.error("Valor unitário inválido"); return; }
    const { error } = await (supabase as any).from("syncvet_estacao_semen").insert({
      estacao_id: estacaoId,
      semen_id: addSemId,
      valor_unitario: valor,
      observacoes: addSemObs || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Sêmen vinculado");
      setAddSemOpen(false); setAddSemId(""); setAddSemValor(""); setAddSemObs("");
      load();
    }
  }
  async function removeSemen(es: EstSemen) {
    if (!confirm(`Remover ${semenMap[es.semen_id]?.touro ?? ""} da estação?`)) return;
    const { error } = await (supabase as any).from("syncvet_estacao_semen").delete().eq("id", es.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  function openNovoCiclo(l: Lote) {
    setCicloLote(l);
    setCicloProtoId("");
    setCicloD0(new Date().toISOString().slice(0, 10));
    setCicloObs("");
    setCicloStatus("em_andamento");
    setCicloOpen(true);
  }
  async function saveCiclo() {
    if (!estacaoId || !cicloLote) return;
    if (!cicloProtoId) { toast.error("Selecione o protocolo"); return; }
    if (!cicloD0) { toast.error("Informe a data do D-0"); return; }
    const { error } = await (supabase as any).from("syncvet_lote_ciclos").insert({
      estacao_id: estacaoId,
      lote_id: cicloLote.id,
      protocolo_id: cicloProtoId,
      data_d0: cicloD0,
      status: cicloStatus,
      observacoes: cicloObs || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Ciclo criado — agenda calculada");
      setCicloOpen(false);
      load();
    }
  }
  async function updateCicloStatus(c: Ciclo, status: string) {
    const { error } = await (supabase as any).from("syncvet_lote_ciclos").update({ status }).eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  }
  async function deleteCiclo(c: Ciclo) {
    if (!confirm("Remover ciclo?")) return;
    const { error } = await (supabase as any).from("syncvet_lote_ciclos").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!estacao) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Estação não encontrada.</Card>;
  }

  const cicloPreview = cicloProtoId ? (etapasPorProto[cicloProtoId] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/syncvet/fazendas/${fazendaId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{estacao.nome}</h1>
          <p className="text-xs text-muted-foreground">
            {fmtDate(estacao.data_inicio)} → {fmtDate(estacao.data_fim)} • {ESTACAO_STATUS[estacao.status] ?? estacao.status}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>Status</Button>
        <Button variant="ghost" size="icon" onClick={deleteEstacao}><Trash2 className="w-4 h-4" /></Button>
      </div>

      <Tabs defaultValue="protocolos">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="protocolos"><Workflow className="w-4 h-4 mr-1" />Protocolos</TabsTrigger>
          <TabsTrigger value="semen"><Snowflake className="w-4 h-4 mr-1" />Sêmen</TabsTrigger>
          <TabsTrigger value="ciclos"><Layers className="w-4 h-4 mr-1" />Lotes/Ciclos</TabsTrigger>
        </TabsList>

        {/* PROTOCOLOS */}
        <TabsContent value="protocolos" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button onClick={() => setAddProtoOpen(true)} disabled={protocolosDisponiveis.length === 0}>
              <Plus className="w-4 h-4 mr-1" />Adicionar Protocolo
            </Button>
          </div>
          {estProtos.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum protocolo vinculado a esta estação.</Card>
          ) : (
            <div className="space-y-2">
              {estProtos.map((ep) => (
                <Card key={ep.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{protoMap[ep.protocolo_id]?.nome ?? "Protocolo"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      R$ {Number(ep.preco_por_cabeca).toFixed(2)} / cabeça
                      {ep.observacoes ? ` • ${ep.observacoes}` : ""}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeProtocolo(ep)}><Trash2 className="w-4 h-4" /></Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SÊMEN */}
        <TabsContent value="semen" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button onClick={() => setAddSemOpen(true)} disabled={semensDisponiveis.length === 0}>
              <Plus className="w-4 h-4 mr-1" />Adicionar Sêmen
            </Button>
          </div>
          {estSemens.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum sêmen vinculado a esta estação.</Card>
          ) : (
            <div className="space-y-2">
              {estSemens.map((es) => {
                const s = semenMap[es.semen_id];
                return (
                  <Card key={es.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{s?.touro ?? "Sêmen"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s?.raca, s?.central].filter(Boolean).join(" • ")}
                        {es.valor_unitario != null ? ` • R$ ${Number(es.valor_unitario).toFixed(2)}` : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeSemen(es)}><Trash2 className="w-4 h-4" /></Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* LOTES E CICLOS */}
        <TabsContent value="ciclos" className="space-y-3 mt-3">
          {lotes.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Cadastre lotes nesta fazenda antes de criar ciclos.
            </Card>
          ) : (
            <div className="space-y-3">
              {lotes.map((l) => {
                const cs = ciclosPorLote[l.id] ?? [];
                return (
                  <Card key={l.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{l.nome}</div>
                        {l.categoria && <div className="text-xs text-muted-foreground truncate">{l.categoria}</div>}
                      </div>
                      <Button size="sm" onClick={() => openNovoCiclo(l)} disabled={estProtos.length === 0}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Novo ciclo
                      </Button>
                    </div>
                    {estProtos.length === 0 && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Vincule pelo menos um protocolo à estação para iniciar ciclos.
                      </div>
                    )}
                    {cs.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhum ciclo ainda.</div>
                    ) : (
                      <div className="space-y-2">
                        {cs.map((c) => {
                          const proto = protoMap[c.protocolo_id];
                          const et = etapasPorProto[c.protocolo_id] ?? [];
                          return (
                            <div key={c.id} className="rounded-md border p-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{proto?.nome ?? "Protocolo"}</div>
                                  <div className="text-xs text-muted-foreground">D-0: {fmtDate(c.data_d0)}</div>
                                </div>
                                <Select value={c.status} onValueChange={(v) => updateCicloStatus(c, v)}>
                                  <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Object.keys(CICLO_STATUS).map((k) => (
                                      <SelectItem key={k} value={k}>{CICLO_STATUS[k]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" onClick={() => deleteCiclo(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                              {et.length === 0 ? (
                                <div className="text-xs text-muted-foreground">Protocolo sem etapas.</div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {et.map((e) => (
                                    <div key={e.id} className="px-2 py-1 rounded-md bg-muted text-xs">
                                      <span className="font-bold text-primary">D+{e.dia_offset}</span>{" "}
                                      <span className="text-muted-foreground">→</span>{" "}
                                      <span>{fmtDate(addDaysISO(c.data_d0, e.dia_offset))}</span>
                                      {e.nome_etapa && <span className="ml-1 text-muted-foreground">({e.nome_etapa})</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {c.observacoes && (
                                <div className="text-xs text-muted-foreground">{c.observacoes}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add protocolo dialog */}
      <Dialog open={addProtoOpen} onOpenChange={setAddProtoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar protocolo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Protocolo*</Label>
              <Select value={addProtoId} onValueChange={setAddProtoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {protocolosDisponiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Preço por cabeça (R$)*</Label><Input inputMode="decimal" value={addProtoPreco} onChange={(e) => setAddProtoPreco(e.target.value)} /></div>
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={addProtoObs} onChange={(e) => setAddProtoObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddProtoOpen(false)}>Cancelar</Button>
            <Button onClick={addProtocolo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add sêmen dialog */}
      <Dialog open={addSemOpen} onOpenChange={setAddSemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar sêmen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Sêmen*</Label>
              <Select value={addSemId} onValueChange={setAddSemId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {semensDisponiveis.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.touro}{s.raca ? ` • ${s.raca}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Valor unitário (R$)</Label><Input inputMode="decimal" value={addSemValor} onChange={(e) => setAddSemValor(e.target.value)} /></div>
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={addSemObs} onChange={(e) => setAddSemObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddSemOpen(false)}>Cancelar</Button>
            <Button onClick={addSemen}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo ciclo dialog */}
      <Dialog open={cicloOpen} onOpenChange={setCicloOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo ciclo — {cicloLote?.nome ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Protocolo*</Label>
              <Select value={cicloProtoId} onValueChange={setCicloProtoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {estProtos.map((ep) => (
                    <SelectItem key={ep.id} value={ep.protocolo_id}>
                      {protoMap[ep.protocolo_id]?.nome ?? "Protocolo"} — R$ {Number(ep.preco_por_cabeca).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Apenas protocolos vinculados a esta estação aparecem aqui.
              </p>
            </div>
            <div><Label className="text-xs">Data do D-0*</Label><Input type="date" value={cicloD0} onChange={(e) => setCicloD0(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={cicloStatus} onValueChange={setCicloStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CICLO_STATUS).map((k) => (
                    <SelectItem key={k} value={k}>{CICLO_STATUS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={cicloObs} onChange={(e) => setCicloObs(e.target.value)} /></div>

            {cicloProtoId && cicloD0 && cicloPreview.length > 0 && (
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Agenda calculada</div>
                <div className="flex flex-wrap gap-1.5">
                  {cicloPreview.map((e) => (
                    <div key={e.id} className="px-2 py-1 rounded-md bg-background text-xs border">
                      <span className="font-bold text-primary">D+{e.dia_offset}</span>{" "}
                      <span className="text-muted-foreground">→</span>{" "}
                      <span>{fmtDate(addDaysISO(cicloD0, e.dia_offset))}</span>
                      {e.nome_etapa && <span className="ml-1 text-muted-foreground">({e.nome_etapa})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCicloOpen(false)}>Cancelar</Button>
            <Button onClick={saveCiclo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Status da estação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={statusVal} onValueChange={setStatusVal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(ESTACAO_STATUS).map((k) => (
                  <SelectItem key={k} value={k}>{ESTACAO_STATUS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button onClick={saveEstacaoStatus}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
