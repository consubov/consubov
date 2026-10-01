import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Calendar, Route as RouteIcon, Landmark, Users, Percent,
  FileDown, Bell, Wallet,
} from "lucide-react";
import { gerarServicoPDF } from "@/lib/syncvetServicoPdf";

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
function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtBRL(n: number) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Servico = {
  id: string; fazenda_id: string; data_referencia: string; data_vencimento: string | null;
  valor_total: number; status: "pendente" | "pago" | "vencido";
  km_total: number | null; animais_atendidos: number | null;
  dias_trabalhados: number | null; observacoes: string | null; estacao_id: string | null;
};
type Fazenda = { id: string; nome: string; modelo_cobranca: "protocolo_completo" | "mao_obra_km"; proprietario: string | null; municipio: string | null; estado: string | null };
type TaxaRow = {
  lote_id: string; fazenda_id: string; protocolo_id: string;
  veterinario_id: string | null;
  total_prenhas: number; total_diagnosticadas: number; taxa_prenhez_pct: number;
};

export default function SyncVetMeuPainelPage() {
  const { user, roleData } = useAuth();
  const equipeId = roleData.roleId;
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // KPIs (por responsavel)
  const [fazHoje, setFazHoje] = useState(0);
  const [animHoje, setAnimHoje] = useState(0);
  const [fazMes, setFazMes] = useState(0);
  const [animMes, setAnimMes] = useState(0);

  // Taxa prenhez (travada no próprio veterinário)
  const [taxa, setTaxa] = useState<TaxaRow[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [protocolos, setProtocolos] = useState<{ id: string; nome: string }[]>([]);
  const [fFaz, setFFaz] = useState("all");
  const [fProt, setFProt] = useState("all");

  // Meus serviços
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [empresaNome, setEmpresaNome] = useState("");
  const [vetNome, setVetNome] = useState("");

  const load = useCallback(async () => {
    if (!equipeId || !empresaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const today = todayISO();
      const first = firstOfMonthISO();
      const last = lastOfMonthISO();

      const [{ data: eq }, { data: emp }, { data: faz }, { data: prot }] = await Promise.all([
        supabase.from("syncvet_equipe").select("nome").eq("id", equipeId).maybeSingle(),
        supabase.from("syncvet_empresas").select("nome").eq("id", empresaId).maybeSingle(),
        supabase.from("syncvet_fazendas").select("id, nome, modelo_cobranca, proprietario, municipio, estado").eq("empresa_id", empresaId).order("nome"),
        supabase.from("syncvet_protocolos").select("id, nome").eq("empresa_id", empresaId).order("nome"),
      ]);
      setVetNome((eq as any)?.nome ?? "");
      setEmpresaNome((emp as any)?.nome ?? "");
      setFazendas((faz as Fazenda[]) ?? []);
      setProtocolos(((prot as { id: string; nome: string }[]) ?? []));

      // Manejos por responsavel_id no mês (usamos data_prevista)
      const { data: manejos } = await supabase
        .from("syncvet_manejos")
        .select("id, data_prevista, lote_ciclo_id")
        .eq("responsavel_id", equipeId)
        .gte("data_prevista", first)
        .lte("data_prevista", last);
      const manejosArr = (manejos as { id: string; data_prevista: string; lote_ciclo_id: string }[]) ?? [];

      const cicloIds = Array.from(new Set(manejosArr.map(m => m.lote_ciclo_id).filter(Boolean)));
      let ciclosArr: { id: string; lote_id: string }[] = [];
      if (cicloIds.length > 0) {
        const { data: c } = await supabase.from("syncvet_lote_ciclos").select("id, lote_id").in("id", cicloIds);
        ciclosArr = (c as typeof ciclosArr) ?? [];
      }
      const loteIds = Array.from(new Set(ciclosArr.map(c => c.lote_id)));
      let lotesArr: { id: string; fazenda_id: string; quantidade_animais: number | null }[] = [];
      if (loteIds.length > 0) {
        const { data: l } = await supabase.from("syncvet_lotes").select("id, fazenda_id, quantidade_animais").in("id", loteIds);
        lotesArr = (l as typeof lotesArr) ?? [];
      }
      const cicloById = new Map(ciclosArr.map(c => [c.id, c]));
      const loteById = new Map(lotesArr.map(l => [l.id, l]));

      const fazHojeSet = new Set<string>();
      const lotesHojeSet = new Set<string>();
      const fazMesSet = new Set<string>();
      const lotesMesSet = new Set<string>();
      for (const m of manejosArr) {
        const c = cicloById.get(m.lote_ciclo_id); if (!c) continue;
        const l = loteById.get(c.lote_id); if (!l) continue;
        fazMesSet.add(l.fazenda_id); lotesMesSet.add(l.id);
        if (m.data_prevista === today) {
          fazHojeSet.add(l.fazenda_id); lotesHojeSet.add(l.id);
        }
      }
      const sumAnim = (ids: Set<string>) =>
        Array.from(ids).reduce((s, id) => s + (loteById.get(id)?.quantidade_animais ?? 0), 0);
      setFazHoje(fazHojeSet.size);
      setAnimHoje(sumAnim(lotesHojeSet));
      setFazMes(fazMesSet.size);
      setAnimMes(sumAnim(lotesMesSet));

      // Taxa prenhez travada no vet
      const { data: taxaData } = await supabase
        .from("syncvet_view_taxa_prenhez")
        .select("*")
        .eq("veterinario_id", equipeId);
      setTaxa(((taxaData as TaxaRow[]) ?? []));

      // Meus serviços
      const { data: servs } = await supabase
        .from("syncvet_servicos")
        .select("id, fazenda_id, data_referencia, data_vencimento, valor_total, status, km_total, animais_atendidos, dias_trabalhados, observacoes, estacao_id")
        .eq("veterinario_id", equipeId)
        .order("data_referencia", { ascending: false });
      setServicos((servs as Servico[]) ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [equipeId, empresaId]);

  useEffect(() => { void load(); }, [load]);

  const fazById = useMemo(() => new Map(fazendas.map(f => [f.id, f])), [fazendas]);

  const taxaFiltered = useMemo(() => taxa.filter(t => {
    if (fFaz !== "all" && t.fazenda_id !== fFaz) return false;
    if (fProt !== "all" && t.protocolo_id !== fProt) return false;
    return true;
  }), [taxa, fFaz, fProt]);

  const taxaAgregada = useMemo(() => {
    const total = taxaFiltered.reduce((s, t) => s + Number(t.total_diagnosticadas || 0), 0);
    const prenhas = taxaFiltered.reduce((s, t) => s + Number(t.total_prenhas || 0), 0);
    const pct = total > 0 ? (prenhas / total) * 100 : 0;
    return { total, prenhas, pct };
  }, [taxaFiltered]);

  const first = firstOfMonthISO();
  const last = lastOfMonthISO();
  const servicosMes = useMemo(
    () => servicos.filter(s => s.data_referencia >= first && s.data_referencia <= last),
    [servicos, first, last],
  );
  const abertos = useMemo(() => servicos.filter(s => s.status !== "pago"), [servicos]);
  const historico = useMemo(() => servicos.filter(s => s.status === "pago").slice(0, 10), [servicos]);

  async function baixarPDF(s: Servico) {
    const f = fazById.get(s.fazenda_id);
    if (!f) return;
    try {
      const { data: itens } = await supabase.from("syncvet_servico_itens")
        .select("descricao, tipo_item, quantidade, valor_unitario, valor_total").eq("servico_id", s.id);
      let estNome: string | null = null;
      if (s.estacao_id) {
        const { data: est } = await supabase.from("syncvet_estacoes_monta").select("nome").eq("id", s.estacao_id).maybeSingle();
        estNome = (est as any)?.nome ?? null;
      }
      const blob = await gerarServicoPDF({
        numero: s.id.slice(0, 8).toUpperCase(),
        data_referencia: s.data_referencia,
        data_vencimento: s.data_vencimento,
        empresa: { nome: empresaNome },
        veterinario: { nome: vetNome },
        fazenda: { nome: f.nome, proprietario: f.proprietario, municipio: f.municipio, estado: f.estado },
        periodo: null,
        estacao: estNome,
        modelo_cobranca: f.modelo_cobranca,
        itens: (itens as any[]) ?? [],
        valor_total: s.valor_total,
        km_total: s.km_total,
        animais_atendidos: s.animais_atendidos,
        observacoes: s.observacoes,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `servico-${s.id.slice(0, 8)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const nome = vetNome || "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Meu Painel</h1>
        <p className="text-sm text-muted-foreground">Olá{nome ? `, ${nome}` : ""} — resumo das suas atividades.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="w-3.5 h-3.5" />Fazendas hoje</div>
          <div className="text-2xl font-bold mt-1">{fazHoje}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" />Animais hoje</div>
          <div className="text-2xl font-bold mt-1">{animHoje}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="w-3.5 h-3.5" />Fazendas no mês</div>
          <div className="text-2xl font-bold mt-1">{fazMes}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" />Animais no mês</div>
          <div className="text-2xl font-bold mt-1">{animMes}</div>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-bold text-primary flex items-center gap-2 mb-2">
          <Percent className="w-4 h-4" /> Minha Taxa de Prenhez
        </h2>
        <Card className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={fFaz} onValueChange={setFFaz}>
              <SelectTrigger><SelectValue placeholder="Fazenda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fazendas</SelectItem>
                {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
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

      <div>
        <h2 className="text-base font-bold text-primary flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4" /> Meus Serviços
        </h2>
        <Card className="p-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            {servicosMes.length} serviço(s) no mês · {fmtBRL(servicosMes.reduce((s, x) => s + Number(x.valor_total || 0), 0))}
          </div>

          {abertos.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1">Em aberto</div>
              <div className="space-y-1">
                {abertos.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs border-b border-border/50 py-1.5 gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{fazById.get(s.fazenda_id)?.nome ?? "?"}</div>
                      <div className="text-muted-foreground">{fmtDate(s.data_referencia)} · {s.status}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-primary">{fmtBRL(s.valor_total)}</div>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => baixarPDF(s)}>
                        <FileDown className="w-3 h-3 mr-1" /> PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historico.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1">Histórico (pagos)</div>
              <div className="space-y-1">
                {historico.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs border-b border-border/50 py-1.5 gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{fazById.get(s.fazenda_id)?.nome ?? "?"}</div>
                      <div className="text-muted-foreground">{fmtDate(s.data_referencia)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">{fmtBRL(s.valor_total)}</div>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => baixarPDF(s)}>
                        <FileDown className="w-3 h-3 mr-1" /> PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {servicos.length === 0 && (
            <div className="text-xs text-muted-foreground text-center italic py-2">
              Nenhum serviço registrado para você ainda.
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link to="/syncvet/agenda"><Button variant="outline" className="w-full"><Calendar className="w-4 h-4 mr-1" />Agenda</Button></Link>
        <Link to="/syncvet/trajetos"><Button variant="outline" className="w-full"><RouteIcon className="w-4 h-4 mr-1" />Trajetos</Button></Link>
        <Button variant="outline" className="w-full" onClick={() => navigate("/syncvet/preferencias")}>
          <Bell className="w-4 h-4 mr-1" />Notificações
        </Button>
      </div>
    </div>
  );
}
