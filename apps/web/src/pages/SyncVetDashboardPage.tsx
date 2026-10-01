import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Landmark, Users, Syringe, Workflow, Wallet, TrendingUp, Percent } from "lucide-react";
import { CalfIcon } from "@/components/icons/CalfIcon";
import { calcularPartosPrevistos } from "@/lib/syncvetPartos";

type KPIs = {
  fazendasHoje: number;
  animaisHoje: number;
  iaDgHoje: number;
  protocolosAtivos: number;
  partosMes: number;
  contasAbertas: number;
  receitaMes: number;
};

type TaxaRow = {
  lote_id: string;
  fazenda_id: string;
  protocolo_id: string;
  estacao_id: string | null;
  veterinario_id: string | null;
  total_prenhas: number;
  total_diagnosticadas: number;
  taxa_prenhez_pct: number;
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastOfMonthISO() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SyncVetDashboardPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [taxa, setTaxa] = useState<TaxaRow[]>([]);
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [protocolos, setProtocolos] = useState<{ id: string; nome: string }[]>([]);
  const [equipe, setEquipe] = useState<{ id: string; nome: string }[]>([]);

  const [fFaz, setFFaz] = useState("all");
  const [fVet, setFVet] = useState("all");
  const [fProt, setFProt] = useState("all");

  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const today = todayISO();
      const first = firstOfMonthISO();
      const last = lastOfMonthISO();

      const { data: fazData } = await supabase
        .from("syncvet_fazendas").select("id, nome").eq("empresa_id", empresaId).order("nome");
      const fazArr = (fazData as { id: string; nome: string }[]) || [];
      setFazendas(fazArr);
      const fazIds = fazArr.map(f => f.id);

      const { data: protData } = await supabase
        .from("syncvet_protocolos").select("id, nome").eq("empresa_id", empresaId).order("nome");
      setProtocolos((protData as { id: string; nome: string }[]) || []);

      const { data: eqData } = await supabase
        .from("syncvet_equipe").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome");
      setEquipe((eqData as { id: string; nome: string }[]) || []);

      let lotesArr: { id: string; fazenda_id: string; quantidade_animais: number | null }[] = [];
      let ciclosArr: { id: string; lote_id: string; protocolo_id: string; status: string | null }[] = [];
      let manejosHoje: { id: string; lote_ciclo_id: string; etapa_id: string }[] = [];
      let etapaMap = new Map<string, string>();

      if (fazIds.length > 0) {
        const { data: lotes } = await supabase
          .from("syncvet_lotes").select("id, fazenda_id, quantidade_animais").in("fazenda_id", fazIds);
        lotesArr = (lotes as typeof lotesArr) || [];
        const loteIds = lotesArr.map(l => l.id);
        if (loteIds.length > 0) {
          const { data: ciclos } = await supabase
            .from("syncvet_lote_ciclos").select("id, lote_id, protocolo_id, status").in("lote_id", loteIds);
          ciclosArr = (ciclos as typeof ciclosArr) || [];
          const cicloIds = ciclosArr.map(c => c.id);
          if (cicloIds.length > 0) {
            const { data: manejos } = await supabase
              .from("syncvet_manejos")
              .select("id, lote_ciclo_id, etapa_id, data_execucao, status")
              .in("lote_ciclo_id", cicloIds)
              .eq("status", "concluido")
              .gte("data_execucao", `${today}T00:00:00`)
              .lte("data_execucao", `${today}T23:59:59`);
            manejosHoje = (manejos as typeof manejosHoje) || [];
            const etapaIds = Array.from(new Set(manejosHoje.map(m => m.etapa_id)));
            if (etapaIds.length > 0) {
              const { data: etapas } = await supabase
                .from("syncvet_protocolo_etapas").select("id, nome_etapa").in("id", etapaIds);
              etapaMap = new Map(((etapas as { id: string; nome_etapa: string | null }[]) || []).map(e => [e.id, e.nome_etapa || ""]));
            }
          }
        }
      }

      const loteById = new Map(lotesArr.map(l => [l.id, l]));
      const cicloById = new Map(ciclosArr.map(c => [c.id, c]));

      // fazendas visitadas hoje = distinct fazenda_id via ciclo->lote
      const fazHojeSet = new Set<string>();
      const lotesHojeSet = new Set<string>();
      let iaDgHoje = 0;
      for (const m of manejosHoje) {
        const c = cicloById.get(m.lote_ciclo_id);
        if (!c) continue;
        const l = loteById.get(c.lote_id);
        if (!l) continue;
        fazHojeSet.add(l.fazenda_id);
        lotesHojeSet.add(l.id);
        const nome = (etapaMap.get(m.etapa_id) || "").toLowerCase();
        if (nome.includes("iatf") || nome.includes("ia ") || nome.startsWith("ia") || nome.includes("dg") || nome.includes("diagn")) {
          iaDgHoje++;
        }
      }
      const animaisHoje = Array.from(lotesHojeSet).reduce((s, id) => s + (loteById.get(id)?.quantidade_animais ?? 0), 0);

      const protocolosAtivos = new Set(ciclosArr.filter(c => (c.status ?? "ativo") !== "concluido").map(c => c.protocolo_id)).size;

      // Partos previstos no mês atual
      const partos = await calcularPartosPrevistos(empresaId);
      const partosMes = partos.filter(p => p.data_prevista_parto >= first && p.data_prevista_parto <= last)
        .reduce((s, p) => s + (p.quantidade_animais || 1), 0);

      // Contas e receita
      let contasAbertas = 0; let receitaMes = 0;
      if (fazIds.length > 0) {
        const { data: servs } = await supabase
          .from("syncvet_servicos")
          .select("valor_total, status, data_referencia, fazenda_id")
          .in("fazenda_id", fazIds);
        for (const s of (servs as { valor_total: number; status: string; data_referencia: string; fazenda_id: string }[]) || []) {
          if (s.status === "pendente" || s.status === "vencido") contasAbertas++;
          if (s.status === "pago" && s.data_referencia >= first && s.data_referencia <= last) {
            receitaMes += Number(s.valor_total || 0);
          }
        }
      }

      setKpis({
        fazendasHoje: fazHojeSet.size,
        animaisHoje,
        iaDgHoje,
        protocolosAtivos,
        partosMes,
        contasAbertas,
        receitaMes,
      });

      // Taxa prenhez
      const { data: taxaData } = await supabase
        .from("syncvet_view_taxa_prenhez")
        .select("*");
      const allTaxa = (taxaData as TaxaRow[]) || [];
      // filter to fazendas of this empresa
      const fazIdSet = new Set(fazIds);
      setTaxa(allTaxa.filter(t => fazIdSet.has(t.fazenda_id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void load(); }, [load]);

  const taxaFiltered = useMemo(() => taxa.filter(t => {
    if (fFaz !== "all" && t.fazenda_id !== fFaz) return false;
    if (fVet !== "all" && t.veterinario_id !== fVet) return false;
    if (fProt !== "all" && t.protocolo_id !== fProt) return false;
    return true;
  }), [taxa, fFaz, fVet, fProt]);

  const taxaAgregada = useMemo(() => {
    const total = taxaFiltered.reduce((s, t) => s + Number(t.total_diagnosticadas || 0), 0);
    const prenhas = taxaFiltered.reduce((s, t) => s + Number(t.total_prenhas || 0), 0);
    const pct = total > 0 ? (prenhas / total) * 100 : 0;
    return { total, prenhas, pct };
  }, [taxaFiltered]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!empresaId) {
    return <Card className="p-6 text-sm text-muted-foreground">Cadastre uma empresa em <b>Empresa</b> para começar.</Card>;
  }

  const cards = [
    { icon: Landmark, label: "Fazendas hoje", value: kpis?.fazendasHoje ?? 0 },
    { icon: Users, label: "Animais hoje", value: kpis?.animaisHoje ?? 0 },
    { icon: Syringe, label: "IA/DG hoje", value: kpis?.iaDgHoje ?? 0 },
    { icon: Workflow, label: "Protocolos ativos", value: kpis?.protocolosAtivos ?? 0 },
    { icon: CalfIcon, label: "Partos no mês", value: kpis?.partosMes ?? 0 },
    { icon: Wallet, label: "Contas em aberto", value: kpis?.contasAbertas ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-primary">Painel</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cards.map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </div>
            <div className="text-2xl font-bold text-primary mt-1">{c.value}</div>
          </Card>
        ))}
        <Card className="p-3 col-span-2 sm:col-span-3 bg-primary/5 border-primary/30">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <TrendingUp className="w-3.5 h-3.5" /> Receita do mês (serviços pagos)
          </div>
          <div className="text-2xl font-bold text-primary mt-1">{fmtBRL(kpis?.receitaMes ?? 0)}</div>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-bold text-primary flex items-center gap-2 mb-2">
          <Percent className="w-4 h-4" /> Taxa de Prenhez
        </h2>
        <Card className="p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={fFaz} onValueChange={setFFaz}>
              <SelectTrigger><SelectValue placeholder="Fazenda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fazendas</SelectItem>
                {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fVet} onValueChange={setFVet}>
              <SelectTrigger><SelectValue placeholder="Veterinário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os veterinários</SelectItem>
                {equipe.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fProt} onValueChange={setFProt}>
              <SelectTrigger><SelectValue placeholder="Protocolo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os protocolos</SelectItem>
                {protocolos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-primary/5 border border-primary/20 p-4 text-center">
            <div className="text-xs text-muted-foreground">Taxa média</div>
            <div className="text-4xl font-bold text-primary">{taxaAgregada.pct.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {taxaAgregada.prenhas} prenhas / {taxaAgregada.total} diagnosticadas
            </div>
          </div>

          {taxaFiltered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center italic py-2">
              Sem diagnósticos registrados neste filtro.
            </div>
          ) : (
            <div className="space-y-1">
              {taxaFiltered.slice(0, 12).map((t, i) => {
                const faz = fazendas.find(f => f.id === t.fazenda_id);
                const prot = protocolos.find(p => p.id === t.protocolo_id);
                return (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-border/50 py-1.5">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{faz?.nome ?? "?"}</div>
                      <div className="text-muted-foreground truncate">{prot?.nome ?? "?"}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {Number(t.taxa_prenhez_pct).toFixed(1)}% • {t.total_prenhas}/{t.total_diagnosticadas}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
