import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileText, Sparkles } from "lucide-react";
import { gerarServicoPDF, type ServicoPdfItem } from "@/lib/syncvetServicoPdf";

type Fazenda = {
  id: string; nome: string; modelo_cobranca: "protocolo_completo" | "mao_obra_km";
  proprietario: string | null; municipio: string | null; estado: string | null;
};
type Estacao = { id: string; nome: string; fazenda_id: string; data_inicio: string | null; data_fim: string | null };
type Item = { descricao: string; tipo_item: string; quantidade: number; valor_unitario: number };

export default function SyncVetServicoNovoPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const navigate = useNavigate();

  const [vetId, setVetId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [vetNome, setVetNome] = useState("");
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [loading, setLoading] = useState(true);

  const [fazendaId, setFazendaId] = useState<string>("");
  const [estacaoId, setEstacaoId] = useState<string>("none");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dataVencimento, setDataVencimento] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [manejoIds, setManejoIds] = useState<string[]>([]);
  const [kmTotal, setKmTotal] = useState(0);
  const [animaisTotal, setAnimaisTotal] = useState(0);
  const [diasTrabalhados, setDiasTrabalhados] = useState(0);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

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
    setLoading(false);
  }, [user?.id, empresaId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    (async () => {
      if (!fazendaId) { setEstacoes([]); return; }
      const { data } = await supabase.from("syncvet_estacoes_monta")
        .select("id, nome, fazenda_id, data_inicio, data_fim")
        .eq("fazenda_id", fazendaId).order("data_inicio", { ascending: false });
      setEstacoes((data as Estacao[]) ?? []);
    })();
    setEstacaoId("none"); setItems([]); setManejoIds([]);
  }, [fazendaId]);

  const fazenda = useMemo(() => fazendas.find(f => f.id === fazendaId) || null, [fazendas, fazendaId]);
  const estacao = useMemo(() => estacoes.find(e => e.id === estacaoId) || null, [estacoes, estacaoId]);

  useEffect(() => {
    if (estacao) {
      if (estacao.data_inicio) setDataInicio(estacao.data_inicio);
      if (estacao.data_fim) setDataFim(estacao.data_fim);
    }
  }, [estacao]);

  async function sugerirItens() {
    if (!fazenda || !vetId) { toast.error("Selecione a fazenda"); return; }
    if (!dataInicio || !dataFim) { toast.error("Informe o período"); return; }
    setSuggesting(true);
    try {
      // Load ciclos of this fazenda in the period (via estacao filter or fazenda filter)
      let ciclosQ = supabase
        .from("syncvet_lote_ciclos")
        .select("id, estacao_id, lote_id, protocolo_id, data_d0, lote:syncvet_lotes!inner(fazenda_id, quantidade_animais)")
        .gte("data_d0", dataInicio).lte("data_d0", dataFim);
      if (estacao) ciclosQ = ciclosQ.eq("estacao_id", estacao.id);
      const { data: ciclos } = await ciclosQ;
      const ciclosFiltered = ((ciclos as any[]) ?? []).filter(c => c.lote?.fazenda_id === fazenda.id);
      const cicloIds = ciclosFiltered.map(c => c.id);

      // Load concluded manejos linked to these ciclos + belonging to me
      const { data: manejos } = cicloIds.length ? await supabase
        .from("syncvet_manejos")
        .select("id, lote_ciclo_id, data_execucao, responsavel_id, status")
        .in("lote_ciclo_id", cicloIds)
        .eq("status", "concluido") : { data: [] as any[] };
      const meusManejos = ((manejos as any[]) ?? []).filter(m => !m.responsavel_id || m.responsavel_id === vetId);
      setManejoIds(meusManejos.map(m => m.id));
      const diasSet = new Set(meusManejos.map(m => (m.data_execucao || "").slice(0, 10)).filter(Boolean));
      const dias = diasSet.size;
      setDiasTrabalhados(dias);

      // Load trajetos in period for this fazenda + vet
      const { data: trajetos } = await supabase.from("syncvet_trajetos")
        .select("distancia_km, data").eq("veterinario_id", vetId).eq("fazenda_id", fazenda.id)
        .gte("data", dataInicio).lte("data", dataFim);
      const km = ((trajetos as any[]) ?? []).reduce((s, t) => s + (t.distancia_km ?? 0), 0);
      setKmTotal(km);

      // Load tabela de precos
      const { data: precos } = await supabase.from("syncvet_tabela_precos")
        .select("tipo_servico, descricao, valor, unidade").eq("veterinario_id", vetId);
      const P = (precos as any[]) ?? [];
      const pKm = P.find(p => p.tipo_servico === "km" || p.unidade === "por_km");
      const pDia = P.find(p => p.tipo_servico === "diaria" || p.unidade === "por_dia");
      const pVisita = P.find(p => p.tipo_servico === "visita" || p.unidade === "por_visita");

      const suggested: Item[] = [];

      if (fazenda.modelo_cobranca === "protocolo_completo") {
        // Group cycles by protocolo, use estacao_protocolos price if selected
        let estProts: any[] = [];
        if (estacao) {
          const { data: ep } = await supabase.from("syncvet_estacao_protocolos")
            .select("protocolo_id, preco_por_cabeca, protocolo:syncvet_protocolos(nome)")
            .eq("estacao_id", estacao.id);
          estProts = (ep as any[]) ?? [];
        }
        const byProt = new Map<string, { nome: string; animais: number; preco: number }>();
        for (const c of ciclosFiltered) {
          const ep = estProts.find(x => x.protocolo_id === c.protocolo_id);
          const preco = ep?.preco_por_cabeca ?? 0;
          const nome = ep?.protocolo?.nome ?? "Protocolo";
          const anim = c.lote?.quantidade_animais ?? 0;
          const cur = byProt.get(c.protocolo_id) || { nome, animais: 0, preco };
          cur.animais += anim;
          byProt.set(c.protocolo_id, cur);
        }
        let totalAnim = 0;
        for (const [, v] of byProt) {
          totalAnim += v.animais;
          if (v.animais > 0) {
            suggested.push({
              descricao: `Protocolo: ${v.nome}`,
              tipo_item: "protocolo",
              quantidade: v.animais,
              valor_unitario: v.preco,
            });
          }
        }
        setAnimaisTotal(totalAnim);
      } else {
        // mao_obra_km
        if (dias > 0 && pDia) {
          suggested.push({
            descricao: pDia.descricao || "Diária técnica",
            tipo_item: "diaria",
            quantidade: dias,
            valor_unitario: pDia.valor,
          });
        } else if (meusManejos.length > 0 && pVisita) {
          suggested.push({
            descricao: pVisita.descricao || "Visita técnica",
            tipo_item: "visita",
            quantidade: meusManejos.length,
            valor_unitario: pVisita.valor,
          });
        }
        setAnimaisTotal(ciclosFiltered.reduce((s, c) => s + (c.lote?.quantidade_animais ?? 0), 0));
      }

      if (km > 0 && pKm) {
        suggested.push({
          descricao: pKm.descricao || "Km rodado",
          tipo_item: "km",
          quantidade: Number(km.toFixed(2)),
          valor_unitario: pKm.valor,
        });
      }

      setItems(suggested);
      toast.success(`${suggested.length} item(ns) sugerido(s)`);
    } catch (e: any) {
      console.error(e); toast.error(e.message || "Erro ao sugerir itens");
    } finally { setSuggesting(false); }
  }

  function addItem() {
    setItems(prev => [...prev, { descricao: "", tipo_item: "outro", quantidade: 1, valor_unitario: 0 }]);
  }
  function updateItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const valorTotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0),
    [items]
  );

  async function confirmar() {
    if (!vetId || !fazenda) return;
    if (items.length === 0) { toast.error("Adicione ao menos 1 item"); return; }
    setSaving(true);
    try {
      const { data: srv, error: eSrv } = await supabase.from("syncvet_servicos").insert({
        veterinario_id: vetId,
        fazenda_id: fazenda.id,
        estacao_id: estacao?.id ?? null,
        data_referencia: dataFim || new Date().toISOString().slice(0, 10),
        data_vencimento: dataVencimento || null,
        km_total: kmTotal || null,
        animais_atendidos: animaisTotal || null,
        dias_trabalhados: diasTrabalhados || null,
        valor_total: valorTotal,
        observacoes: observacoes || null,
        status: "pendente",
      }).select("id").single();
      if (eSrv) throw eSrv;
      const servicoId = (srv as any).id;

      const itemsRows = items.map(it => ({
        servico_id: servicoId,
        tipo_item: it.tipo_item,
        descricao: it.descricao || it.tipo_item,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        valor_total: (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
      }));
      const { error: eIt } = await supabase.from("syncvet_servico_itens").insert(itemsRows);
      if (eIt) throw eIt;

      if (manejoIds.length) {
        const mRows = manejoIds.map(m => ({ servico_id: servicoId, manejo_id: m }));
        await supabase.from("syncvet_servico_manejos").insert(mRows);
      }

      // Generate PDF
      const pdfItems: ServicoPdfItem[] = items.map(it => ({
        descricao: it.descricao || it.tipo_item,
        tipo_item: it.tipo_item,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        valor_total: (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
      }));
      const blob = await gerarServicoPDF({
        numero: servicoId.slice(0, 8).toUpperCase(),
        data_referencia: dataFim || new Date().toISOString().slice(0, 10),
        data_vencimento: dataVencimento || null,
        empresa: { nome: empresaNome },
        veterinario: { nome: vetNome },
        fazenda: {
          nome: fazenda.nome, proprietario: fazenda.proprietario,
          municipio: fazenda.municipio, estado: fazenda.estado,
        },
        periodo: dataInicio && dataFim ? { inicio: dataInicio, fim: dataFim } : null,
        estacao: estacao?.nome ?? null,
        modelo_cobranca: fazenda.modelo_cobranca,
        itens: pdfItems,
        valor_total: valorTotal,
        km_total: kmTotal,
        animais_atendidos: animaisTotal,
        observacoes,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `servico-${servicoId.slice(0, 8)}.pdf`;
      a.click(); URL.revokeObjectURL(url);

      toast.success("Serviço gerado com sucesso");
      navigate("/syncvet/contas");
    } catch (e: any) {
      console.error(e); toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><FileText className="w-5 h-5" /> Gerar Serviço</h1>

      <Card className="p-3 space-y-3">
        <div>
          <Label>Fazenda</Label>
          <Select value={fazendaId} onValueChange={setFazendaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a fazenda" /></SelectTrigger>
            <SelectContent>
              {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {fazenda && (
            <div className="text-xs text-muted-foreground mt-1">
              Modelo de cobrança: <span className="font-semibold">
                {fazenda.modelo_cobranca === "protocolo_completo" ? "Protocolo Completo" : "Mão de Obra + Km"}
              </span>
            </div>
          )}
        </div>

        <div>
          <Label>Estação de Monta (opcional)</Label>
          <Select value={estacaoId} onValueChange={setEstacaoId} disabled={!fazendaId}>
            <SelectTrigger><SelectValue placeholder="Sem estação específica" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— sem estação específica —</SelectItem>
              {estacoes.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>

        <Button variant="secondary" onClick={sugerirItens} disabled={suggesting || !fazenda}>
          {suggesting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Sugerir itens automaticamente
        </Button>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Itens do serviço</div>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Item</Button>
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Nenhum item. Clique em "Sugerir itens" ou adicione manualmente.
          </div>
        ) : items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-2">
            <div className="col-span-6">
              <Label className="text-xs">Descrição</Label>
              <Input value={it.descricao} onChange={e => updateItem(i, { descricao: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Qtd</Label>
              <Input inputMode="decimal" value={String(it.quantidade)} onChange={e => updateItem(i, { quantidade: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Unitário</Label>
              <Input inputMode="decimal" value={String(it.valor_unitario)} onChange={e => updateItem(i, { valor_unitario: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
            </div>
            <div className="col-span-1">
              <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
            <div className="col-span-12 text-right text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">
                {((it.quantidade || 0) * (it.valor_unitario || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {kmTotal > 0 && <>Km: {kmTotal.toFixed(2)} · </>}
            {animaisTotal > 0 && <>Animais: {animaisTotal} · </>}
            {diasTrabalhados > 0 && <>Dias: {diasTrabalhados}</>}
          </div>
          <div className="text-lg font-bold text-primary">
            {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <div>
          <Label>Vencimento (opcional)</Label>
          <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
        </div>
      </Card>

      <Button className="w-full" onClick={confirmar} disabled={saving || items.length === 0}>
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        Confirmar e gerar PDF
      </Button>
    </div>
  );
}
