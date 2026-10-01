import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Wallet, Plus, FileDown, Check } from "lucide-react";
import { gerarServicoPDF } from "@/lib/syncvetServicoPdf";
import { cn } from "@/lib/utils";

type Status = "pendente" | "pago" | "vencido";
type Servico = {
  id: string; fazenda_id: string; data_referencia: string; data_vencimento: string | null;
  valor_total: number; status: Status; km_total: number | null; animais_atendidos: number | null;
  dias_trabalhados: number | null; observacoes: string | null; estacao_id: string | null;
};
type Fazenda = { id: string; nome: string; modelo_cobranca: "protocolo_completo" | "mao_obra_km"; proprietario: string | null; municipio: string | null; estado: string | null };

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SyncVetContasPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const navigate = useNavigate();

  const [vetId, setVetId] = useState<string | null>(null);
  const [vetNome, setVetNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);

  const [fFazenda, setFFazenda] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fInicio, setFInicio] = useState<string>("");
  const [fFim, setFFim] = useState<string>("");

  const load = useCallback(async () => {
    if (!user?.id || !empresaId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: eq }, { data: emp }, { data: faz }] = await Promise.all([
      supabase.from("syncvet_equipe").select("id, nome").eq("empresa_id", empresaId).eq("user_id", user.id).eq("ativo", true).maybeSingle(),
      supabase.from("syncvet_empresas").select("nome").eq("id", empresaId).maybeSingle(),
      supabase.from("syncvet_fazendas").select("id, nome, modelo_cobranca, proprietario, municipio, estado").eq("empresa_id", empresaId).order("nome"),
    ]);
    const e = eq as { id: string; nome: string } | null;
    setVetId(e?.id ?? null);
    setVetNome(e?.nome ?? "");
    setEmpresaNome((emp as any)?.nome ?? "");
    setFazendas((faz as Fazenda[]) ?? []);
    if (!e?.id) { setServicos([]); setLoading(false); return; }
    const { data, error } = await supabase.from("syncvet_servicos")
      .select("id, fazenda_id, data_referencia, data_vencimento, valor_total, status, km_total, animais_atendidos, dias_trabalhados, observacoes, estacao_id")
      .eq("veterinario_id", e.id)
      .order("data_referencia", { ascending: false });
    if (error) toast.error(error.message);
    let list = (data as Servico[]) ?? [];

    // Auto-flag vencidos
    const hoje = new Date().toISOString().slice(0, 10);
    const paraVencer = list.filter(s => s.status === "pendente" && s.data_vencimento && s.data_vencimento < hoje);
    if (paraVencer.length) {
      await supabase.from("syncvet_servicos").update({ status: "vencido" }).in("id", paraVencer.map(s => s.id));
      list = list.map(s => paraVencer.find(p => p.id === s.id) ? { ...s, status: "vencido" as Status } : s);
    }
    setServicos(list);
    setLoading(false);
  }, [user?.id, empresaId]);

  useEffect(() => { void load(); }, [load]);

  const fazById = useMemo(() => new Map(fazendas.map(f => [f.id, f])), [fazendas]);

  const filtered = useMemo(() => {
    return servicos.filter(s => {
      if (fFazenda !== "all" && s.fazenda_id !== fFazenda) return false;
      if (fStatus !== "all" && s.status !== fStatus) return false;
      if (fInicio && s.data_referencia < fInicio) return false;
      if (fFim && s.data_referencia > fFim) return false;
      return true;
    });
  }, [servicos, fFazenda, fStatus, fInicio, fFim]);

  const totais = useMemo(() => {
    const t = { pendente: 0, pago: 0, vencido: 0 };
    for (const s of filtered) t[s.status] += s.valor_total;
    return t;
  }, [filtered]);

  async function marcarPago(id: string) {
    const { error } = await supabase.from("syncvet_servicos").update({ status: "pago" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marcado como pago");
    setServicos(prev => prev.map(s => s.id === id ? { ...s, status: "pago" as Status } : s));
  }

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

  const badgeCls: Record<Status, string> = {
    pendente: "bg-secondary/20 text-secondary-foreground border border-secondary/30",
    pago: "bg-primary/10 text-primary border border-primary/30",
    vencido: "bg-destructive/10 text-destructive border border-destructive/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2"><Wallet className="w-5 h-5" /> Contas a Receber</h1>
        <Button size="sm" onClick={() => navigate("/syncvet/servicos/novo")}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Pendente</div><div className="text-sm font-bold">{fmtBRL(totais.pendente)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Pago</div><div className="text-sm font-bold text-primary">{fmtBRL(totais.pago)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Vencido</div><div className="text-sm font-bold text-destructive">{fmtBRL(totais.vencido)}</div></Card>
      </div>

      <Card className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Fazenda</Label>
            <Select value={fFazenda} onValueChange={setFFazenda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={fInicio} onChange={e => setFInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={fFim} onChange={e => setFFim(e.target.value)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum serviço encontrado</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className={cn("p-3", s.status === "vencido" && "border-destructive")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{fazById.get(s.fazenda_id)?.nome ?? "Fazenda"}</div>
                  <div className="text-xs text-muted-foreground">
                    Emissão: {fmtDate(s.data_referencia)}
                    {s.data_vencimento && <> · Vence: {fmtDate(s.data_vencimento)}</>}
                  </div>
                  <span className={cn("inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold", badgeCls[s.status])}>
                    {s.status}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-primary">{fmtBRL(s.valor_total)}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => baixarPDF(s)}>
                  <FileDown className="w-3 h-3 mr-1" /> PDF
                </Button>
                {s.status !== "pago" && (
                  <Button size="sm" onClick={() => marcarPago(s.id)}>
                    <Check className="w-3 h-3 mr-1" /> Marcar pago
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
