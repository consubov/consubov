import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Calendar as CalendarIcon, UserRound, Route as RouteIcon, MapPin, Navigation, ClipboardCheck } from "lucide-react";
import { sendPush } from "@/lib/pushService";
import { logAuditoria } from "@/lib/syncvetAuditoria";

type Manejo = {
  id: string;
  lote_ciclo_id: string;
  etapa_id: string;
  data_prevista: string;
  data_execucao: string | null;
  status: string;
  responsavel_id: string | null;
  observacoes: string | null;
};
type Etapa = { id: string; protocolo_id: string; dia_offset: number; nome_etapa: string | null; ordem: number };
type Ciclo = { id: string; lote_id: string; estacao_id: string; protocolo_id: string; data_d0: string };
type Lote = { id: string; nome: string; fazenda_id: string };
type Fazenda = { id: string; nome: string; latitude: number | null; longitude: number | null };
type Equipe = { id: string; nome: string; user_id: string | null };
type Proto = { id: string; nome: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export default function SyncVetAgendaPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;

  const [loading, setLoading] = useState(true);
  const [manejos, setManejos] = useState<Manejo[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [protocolos, setProtocolos] = useState<Proto[]>([]);

  const [fFazenda, setFFazenda] = useState<string>("all");
  const [fResp, setFResp] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");

  const [selected, setSelected] = useState<Manejo | null>(null);
  const [assignId, setAssignId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Trajeto dialog state
  const [trajetoOpen, setTrajetoOpen] = useState(false);
  const [origemLat, setOrigemLat] = useState<string>("");
  const [origemLng, setOrigemLng] = useState<string>("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<{ distancia_km: number; duracao_min: number; origem_endereco: string | null } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Resultado por animal dialog state
  type AnimalRow = { id: string; brinco: string | null; numero: string | null; categoria: string | null };
  const [resultadoOpen, setResultadoOpen] = useState(false);
  const [resultadoAnimais, setResultadoAnimais] = useState<AnimalRow[]>([]);
  const [resultadoValues, setResultadoValues] = useState<Record<string, "prenha" | "vazia">>({});
  const [resultadoIsDG, setResultadoIsDG] = useState(false);
  const [resultadoManejo, setResultadoManejo] = useState<Manejo | null>(null);
  const [savingResultado, setSavingResultado] = useState(false);

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [{ data: faz }, { data: eq }, { data: prot }] = await Promise.all([
        supabase.from("syncvet_fazendas").select("id, nome, latitude, longitude").eq("empresa_id", empresaId).order("nome"),
        supabase.from("syncvet_equipe").select("id, nome, user_id").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
        supabase.from("syncvet_protocolos").select("id, nome").eq("empresa_id", empresaId),
      ]);
      const fazArr = (faz as Fazenda[]) || [];
      setFazendas(fazArr);
      setEquipe((eq as Equipe[]) || []);
      setProtocolos((prot as Proto[]) || []);

      const fazIds = fazArr.map(f => f.id);
      if (fazIds.length === 0) {
        setLotes([]); setCiclos([]); setEtapas([]); setManejos([]);
        return;
      }
      const { data: lotesData } = await supabase.from("syncvet_lotes").select("id, nome, fazenda_id").in("fazenda_id", fazIds);
      const lotesArr = (lotesData as Lote[]) || [];
      setLotes(lotesArr);

      const loteIds = lotesArr.map(l => l.id);
      if (loteIds.length === 0) { setCiclos([]); setEtapas([]); setManejos([]); return; }
      const { data: cData } = await supabase.from("syncvet_lote_ciclos")
        .select("id, lote_id, estacao_id, protocolo_id, data_d0").in("lote_id", loteIds);
      const cArr = (cData as Ciclo[]) || [];
      setCiclos(cArr);

      const cicloIds = cArr.map(c => c.id);
      if (cicloIds.length === 0) { setEtapas([]); setManejos([]); return; }
      const protIds = Array.from(new Set(cArr.map(c => c.protocolo_id)));
      const [{ data: eData }, { data: mData }] = await Promise.all([
        supabase.from("syncvet_protocolo_etapas").select("id, protocolo_id, dia_offset, nome_etapa, ordem").in("protocolo_id", protIds),
        supabase.from("syncvet_manejos")
          .select("id, lote_ciclo_id, etapa_id, data_prevista, data_execucao, status, responsavel_id, observacoes")
          .in("lote_ciclo_id", cicloIds).order("data_prevista"),
      ]);
      setEtapas((eData as Etapa[]) || []);
      setManejos((mData as Manejo[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar agenda");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void load(); }, [load]);

  const ctxByCiclo = useMemo(() => {
    const map = new Map<string, { lote: Lote | null; fazenda: Fazenda | null; protocolo: Proto | null; ciclo: Ciclo }>();
    for (const c of ciclos) {
      const lote = lotes.find(l => l.id === c.lote_id) || null;
      const fazenda = lote ? fazendas.find(f => f.id === lote.fazenda_id) || null : null;
      const protocolo = protocolos.find(p => p.id === c.protocolo_id) || null;
      map.set(c.id, { lote, fazenda, protocolo, ciclo: c });
    }
    return map;
  }, [ciclos, lotes, fazendas, protocolos]);

  const etapaById = useMemo(() => {
    const m = new Map<string, Etapa>();
    etapas.forEach(e => m.set(e.id, e));
    return m;
  }, [etapas]);

  const equipeById = useMemo(() => {
    const m = new Map<string, Equipe>();
    equipe.forEach(e => m.set(e.id, e));
    return m;
  }, [equipe]);

  const filtrados = useMemo(() => {
    const today = todayISO();
    return manejos.filter(m => {
      const ctx = ctxByCiclo.get(m.lote_ciclo_id);
      if (fFazenda !== "all" && ctx?.fazenda?.id !== fFazenda) return false;
      if (fResp !== "all") {
        if (fResp === "none" && m.responsavel_id) return false;
        if (fResp !== "none" && m.responsavel_id !== fResp) return false;
      }
      if (fStatus !== "all") {
        if (fStatus === "atrasado") {
          if (!(m.status === "pendente" && m.data_prevista < today)) return false;
        } else if (fStatus !== m.status) return false;
      }
      return true;
    });
  }, [manejos, ctxByCiclo, fFazenda, fResp, fStatus]);

  const grupos = useMemo(() => {
    const g = new Map<string, Manejo[]>();
    for (const m of filtrados) {
      const arr = g.get(m.data_prevista) || [];
      arr.push(m);
      g.set(m.data_prevista, arr);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  function openManejo(m: Manejo) {
    setSelected(m);
    setAssignId(m.responsavel_id ?? "");
  }

  async function handleSaveResponsavel() {
    if (!selected) return;
    setSaving(true);
    try {
      const novo = assignId || null;
      const anterior = selected.responsavel_id ?? null;
      const { error } = await supabase
        .from("syncvet_manejos")
        .update({ responsavel_id: novo })
        .eq("id", selected.id);
      if (error) throw error;
      setManejos(prev => prev.map(x => x.id === selected.id ? { ...x, responsavel_id: novo } : x));
      toast.success("Responsável atualizado");

      if (novo && novo !== anterior) {
        const member = equipeById.get(novo);
        const ctx = ctxByCiclo.get(selected.lote_ciclo_id);
        const etapa = etapaById.get(selected.etapa_id);
        const dataStr = fmtDate(selected.data_prevista);
        const fazendaNome = ctx?.fazenda?.nome ?? "";
        const loteNome = ctx?.lote?.nome ?? "";
        const etapaNome = etapa?.nome_etapa || (etapa ? `Dia ${etapa.dia_offset}` : "manejo");
        if (member?.user_id) {
          const body = `${etapaNome} • ${dataStr}${fazendaNome ? ` em ${fazendaNome}` : ""}${loteNome ? ` (${loteNome})` : ""}`;
          await sendPush("Novo manejo atribuído", body, "/syncvet/agenda", { userIds: [member.user_id] });
        }
      }
      setSelected(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar responsável");
    } finally {
      setSaving(false);
    }
  }

  function openTrajetoDialog() {
    if (!selected) return;
    const ctx = ctxByCiclo.get(selected.lote_ciclo_id);
    if (!ctx?.fazenda?.latitude || !ctx?.fazenda?.longitude) {
      toast.error("Fazenda sem coordenadas cadastradas — preencha latitude/longitude no cadastro");
      return;
    }
    setOrigemLat("");
    setOrigemLng("");
    setCalcResult(null);
    setTrajetoOpen(true);
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste dispositivo");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigemLat(pos.coords.latitude.toFixed(6));
        setOrigemLng(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success("Localização capturada");
      },
      (err) => {
        setGpsLoading(false);
        toast.error(`Erro GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleCalcular() {
    if (!selected) return;
    const ctx = ctxByCiclo.get(selected.lote_ciclo_id);
    const destLat = ctx?.fazenda?.latitude;
    const destLng = ctx?.fazenda?.longitude;
    const oLat = parseFloat(origemLat.replace(",", "."));
    const oLng = parseFloat(origemLng.replace(",", "."));
    if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) {
      toast.error("Origem inválida");
      return;
    }
    if (destLat == null || destLng == null) {
      toast.error("Fazenda sem coordenadas");
      return;
    }
    setCalcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("syncvet-calcular-trajeto", {
        body: { origem_lat: oLat, origem_lng: oLng, destino_lat: destLat, destino_lng: destLng },
      });
      if (error) throw error;
      if (!data || typeof data.distancia_km !== "number") {
        throw new Error(data?.error || "Resposta inválida");
      }
      setCalcResult({
        distancia_km: data.distancia_km,
        duracao_min: data.duracao_min,
        origem_endereco: data.origem_endereco ?? null,
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao calcular trajeto");
    } finally {
      setCalcLoading(false);
    }
  }

  function isDGEtapa(m: Manejo): boolean {
    const etapa = etapaById.get(m.etapa_id);
    const n = (etapa?.nome_etapa || "").toLowerCase();
    return n.includes("dg") || n.includes("diagn");
  }

  async function fetchAnimaisDoManejo(m: Manejo): Promise<AnimalRow[]> {
    const ctx = ctxByCiclo.get(m.lote_ciclo_id);
    if (!ctx?.lote?.id) return [];
    const { data } = await supabase
      .from("syncvet_animais")
      .select("id, brinco, numero, categoria")
      .eq("lote_id", ctx.lote.id)
      .order("brinco", { nullsFirst: false })
      .order("numero", { nullsFirst: false });
    return ((data as AnimalRow[]) || []);
  }

  async function finalizarConclusao(m: Manejo, opts?: { trajetoRegistrado?: boolean }) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("syncvet_manejos")
      .update({ status: "concluido", data_execucao: now })
      .eq("id", m.id);
    if (error) throw error;
    setManejos(prev => prev.map(x => x.id === m.id ? { ...x, status: "concluido", data_execucao: now } : x));
    // Auditoria
    void logAuditoria({
      empresaId, userId: user?.id ?? null,
      acao: "concluir",
      entidade: "syncvet_manejos",
      entidade_id: m.id,
      detalhes: { trajeto: !!opts?.trajetoRegistrado, is_dg: isDGEtapa(m) },
    });
  }

  async function handleConfirmarESalvar() {
    if (!selected || !calcResult || !user) return;
    const ctx = ctxByCiclo.get(selected.lote_ciclo_id);
    const destLat = ctx?.fazenda?.latitude;
    const destLng = ctx?.fazenda?.longitude;
    const fazendaId = ctx?.fazenda?.id;
    if (!fazendaId || destLat == null || destLng == null) return;

    setFinalizing(true);
    try {
      const { data: vet } = await supabase.from("syncvet_equipe")
        .select("id").eq("empresa_id", empresaId).eq("user_id", user.id).maybeSingle();
      const vetId = (vet as { id: string } | null)?.id;
      if (!vetId) {
        toast.error("Você não está cadastrado como membro da equipe desta empresa");
        setFinalizing(false);
        return;
      }
      const oLat = parseFloat(origemLat.replace(",", "."));
      const oLng = parseFloat(origemLng.replace(",", "."));
      const { error: trajErr } = await supabase.from("syncvet_trajetos").insert({
        veterinario_id: vetId,
        fazenda_id: fazendaId,
        manejo_id: selected.id,
        data: todayISO(),
        origem_lat: oLat,
        origem_lng: oLng,
        destino_lat: destLat,
        destino_lng: destLng,
        distancia_km: calcResult.distancia_km,
        duracao_min: calcResult.duracao_min,
        origem_endereco: calcResult.origem_endereco,
        fonte: "haversine_estimativa",
      });
      if (trajErr) throw trajErr;

      setTrajetoOpen(false);
      await abrirResultadoOuConcluir(selected, true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar trajeto");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleConcluirSemTrajeto() {
    if (!selected) return;
    setSaving(true);
    try {
      await abrirResultadoOuConcluir(selected, false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir manejo");
    } finally {
      setSaving(false);
    }
  }

  async function abrirResultadoOuConcluir(m: Manejo, trajetoRegistrado: boolean) {
    const isDG = isDGEtapa(m);
    const animais = await fetchAnimaisDoManejo(m);
    if (isDG && animais.length > 0) {
      // Abre dialog para marcar prenha/vazia por animal
      setResultadoAnimais(animais);
      setResultadoValues(Object.fromEntries(animais.map(a => [a.id, "prenha" as const])));
      setResultadoIsDG(true);
      setResultadoManejo(m);
      setResultadoOpen(true);
      // Mantém o dialog do manejo fechado para não sobrepor
      setSelected(null);
      return;
    }
    // Não-DG: insere 'realizado' em lote (se houver animais) e conclui
    if (animais.length > 0) {
      await supabase.from("syncvet_manejo_resultados").insert(
        animais.map(a => ({ manejo_id: m.id, animal_id: a.id, resultado: "realizado" }))
      );
    }
    await finalizarConclusao(m, { trajetoRegistrado });
    toast.success(trajetoRegistrado ? "Manejo concluído e trajeto registrado" : "Manejo concluído");
    setSelected(null);
  }

  async function handleSalvarResultado() {
    if (!resultadoManejo) return;
    setSavingResultado(true);
    try {
      const rows = resultadoAnimais.map(a => ({
        manejo_id: resultadoManejo.id,
        animal_id: a.id,
        resultado: resultadoValues[a.id] || "prenha",
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("syncvet_manejo_resultados").insert(rows);
        if (error) throw error;
      }
      await finalizarConclusao(resultadoManejo);
      toast.success("Diagnóstico registrado e manejo concluído");
      setResultadoOpen(false);
      setResultadoManejo(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar diagnóstico");
    } finally {
      setSavingResultado(false);
    }
  }

  function setAllResultado(v: "prenha" | "vazia") {
    setResultadoValues(prev => {
      const next = { ...prev };
      for (const a of resultadoAnimais) next[a.id] = v;
      return next;
    });
  }


  const today = todayISO();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" /> Agenda de Manejos
        </h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/syncvet/trajetos"><RouteIcon className="w-3.5 h-3.5 mr-1" /> Trajetos</Link>
          </Button>
          <Badge variant="secondary" className="text-xs">{filtrados.length}</Badge>
        </div>
      </div>

      <Card className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select value={fFazenda} onValueChange={setFFazenda}>
          <SelectTrigger><SelectValue placeholder="Fazenda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fazendas</SelectItem>
            {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fResp} onValueChange={setFResp}>
          <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {equipe.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum manejo encontrado</Card>
      ) : (
        <div className="space-y-4">
          {grupos.map(([data, itens]) => (
            <div key={data} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {fmtDateLong(data)}
              </div>
              <div className="space-y-2">
                {itens.map(m => {
                  const ctx = ctxByCiclo.get(m.lote_ciclo_id);
                  const etapa = etapaById.get(m.etapa_id);
                  const resp = m.responsavel_id ? equipeById.get(m.responsavel_id) : null;
                  const atrasado = m.status === "pendente" && m.data_prevista < today;
                  const concluido = m.status === "concluido";
                  return (
                    <button
                      key={m.id}
                      onClick={() => openManejo(m)}
                      className={`w-full text-left rounded-md border p-3 transition hover:bg-muted/50 ${
                        concluido ? "border-primary/40 bg-primary/5" :
                        atrasado ? "border-destructive/50 bg-destructive/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {etapa?.nome_etapa || (etapa ? `Dia ${etapa.dia_offset}` : "Manejo")}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {ctx?.fazenda?.nome ?? "?"} • {ctx?.lote?.nome ?? "?"}
                            {ctx?.protocolo?.nome ? ` • ${ctx.protocolo.nome}` : ""}
                          </div>
                          <div className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
                            <UserRound className="w-3 h-3" />
                            {resp ? resp.nome : <span className="italic">Sem responsável</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {concluido ? (
                            <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Concluído
                            </Badge>
                          ) : atrasado ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="w-3 h-3" /> Atrasado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manejo</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const ctx = ctxByCiclo.get(selected.lote_ciclo_id);
            const etapa = etapaById.get(selected.etapa_id);
            const semCoords = !ctx?.fazenda?.latitude || !ctx?.fazenda?.longitude;
            return (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold">{etapa?.nome_etapa || (etapa ? `Dia ${etapa.dia_offset}` : "Manejo")}</div>
                  <div className="text-xs text-muted-foreground">
                    {ctx?.fazenda?.nome ?? "?"} • {ctx?.lote?.nome ?? "?"}
                    {ctx?.protocolo?.nome ? ` • ${ctx.protocolo.nome}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Data prevista: <span className="font-medium text-foreground">{fmtDate(selected.data_prevista)}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium mb-1">Responsável</div>
                  <Select value={assignId || "__none__"} onValueChange={(v) => setAssignId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem responsável</SelectItem>
                      {equipe.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Fechar</Button>
                  <Button variant="secondary" onClick={handleSaveResponsavel} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar responsável"}
                  </Button>
                  {selected.status !== "concluido" && (
                    semCoords ? (
                      <Button onClick={handleConcluirSemTrajeto} disabled={saving}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como concluído
                      </Button>
                    ) : (
                      <Button onClick={openTrajetoDialog} disabled={saving}>
                        <RouteIcon className="w-4 h-4 mr-1" /> Registrar trajeto e concluir
                      </Button>
                    )
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={trajetoOpen} onOpenChange={(o) => { if (!o) { setTrajetoOpen(false); setCalcResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Trajeto</DialogTitle>
            <DialogDescription>
              Informe sua origem. O destino é a fazenda deste manejo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleGPS}
              disabled={gpsLoading || calcLoading || finalizing}
            >
              {gpsLoading
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Navigation className="w-4 h-4 mr-2" />}
              Usar minha localização agora
            </Button>

            <div className="text-[11px] text-center text-muted-foreground">ou informe manualmente</div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input
                  value={origemLat}
                  onChange={(e) => { setOrigemLat(e.target.value); setCalcResult(null); }}
                  placeholder="-15.7801"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  value={origemLng}
                  onChange={(e) => { setOrigemLng(e.target.value); setCalcResult(null); }}
                  placeholder="-47.9292"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              Dica: no Google Maps, toque e segure um ponto no mapa para ver as coordenadas.
            </div>

            {!calcResult ? (
              <Button
                type="button"
                className="w-full"
                onClick={handleCalcular}
                disabled={!origemLat || !origemLng || calcLoading || finalizing}
              >
                {calcLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Calcular distância
              </Button>
            ) : (
              <Card className="p-3 bg-primary/5 border-primary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Distância calculada</div>
                    <div className="text-2xl font-bold text-primary">{calcResult.distancia_km.toFixed(2)} km</div>
                    <div className="text-xs text-muted-foreground">Duração aprox.: {calcResult.duracao_min} min</div>
                  </div>
                </div>
                {calcResult.origem_endereco && (
                  <div className="text-[11px] text-muted-foreground mt-2 truncate">
                    Origem: {calcResult.origem_endereco}
                  </div>
                )}
              </Card>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setTrajetoOpen(false)} disabled={finalizing}>Cancelar</Button>
            {calcResult && (
              <Button onClick={handleConfirmarESalvar} disabled={finalizing}>
                {finalizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Confirmar e concluir manejo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
