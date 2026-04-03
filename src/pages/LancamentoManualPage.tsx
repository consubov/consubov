import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Minus, Save } from "lucide-react";
import {
  classificarCategoria,
  calcularConsumo,
  getConsumoPorCategoria,
  getMargemPorCategoria,
} from "@/lib/consumoCalc";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Produto {
  id: string;
  nome: string;
  peso_saco_kg: number;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
}

interface PastoRow {
  pasto_id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number;
  sexo: string;
  categoria: string;
  num_sacos: number;
  dias_no_pasto: number;
  produto_id: string;
}

export default function LancamentoManualPage() {
  const now = new Date();
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [retiros, setRetiros] = useState<{ id: string; nome: string; produto_id: string | null }[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fazendaId, setFazendaId] = useState("");
  const [retiroId, setRetiroId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [rows, setRows] = useState<PastoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cicloFechado, setCicloFechado] = useState(false);
  const [diasNoPastoGlobal, setDiasNoPastoGlobal] = useState(30);
  const [produtoPadraoId, setProdutoPadraoId] = useState("");

  const produtosMap = useMemo(() => {
    const map: Record<string, Produto> = {};
    for (const p of produtos) map[p.id] = p;
    return map;
  }, [produtos]);

  // Load fazendas + produtos
  useEffect(() => {
    supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setFazendas(data ?? []));
    supabase.from("produtos").select("id, nome, peso_saco_kg, consumo_recria1, consumo_recria2, consumo_engorda, margem_recria1, margem_recria2, margem_engorda").eq("ativo", true).order("nome")
      .then(({ data }) => setProdutos((data ?? []) as Produto[]));
  }, []);

  // Load retiros when fazenda changes
  useEffect(() => {
    if (!fazendaId) { setRetiros([]); setRetiroId(""); return; }
    supabase.from("retiros").select("id, nome, produto_id").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome")
      .then(({ data }) => {
        const r = data ?? [];
        setRetiros(r);
        setRetiroId("");
      });
  }, [fazendaId]);

  // Set default product when retiro changes
  useEffect(() => {
    if (!retiroId) { setProdutoPadraoId(""); return; }
    const ret = retiros.find(r => r.id === retiroId);
    if (ret?.produto_id) {
      setProdutoPadraoId(ret.produto_id);
    }
  }, [retiroId, retiros]);

  // Load pastos + existing data when retiro/month changes
  useEffect(() => {
    if (!retiroId) { setRows([]); return; }
    loadPastos();
    checkCicloFechado();
  }, [retiroId, mes, ano]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkCicloFechado() {
    if (!fazendaId) return;
    const { data } = await supabase.from("ciclos")
      .select("fechado")
      .eq("fazenda_id", fazendaId).eq("mes", mes).eq("ano", ano)
      .maybeSingle();
    setCicloFechado(data?.fechado === true);
  }

  async function loadPastos() {
    setLoading(true);
    try {
      const { data: pastosData } = await supabase.from("pastos")
        .select("id, nome, num_animais, peso_medio_kg, sexo, categoria, dias_no_pasto, produto_id")
        .eq("retiro_id", retiroId).eq("ativo", true).order("nome");

      const pastos = pastosData ?? [];
      const pastoIds = pastos.map(p => p.id);

      let existingMap: Record<string, any> = {};
      if (pastoIds.length > 0) {
        const { data: existing } = await supabase.from("lancamentos_manuais")
          .select("*")
          .in("pasto_id", pastoIds)
          .eq("mes_referencia", mes)
          .eq("ano_referencia", ano);
        for (const e of (existing ?? [])) {
          existingMap[e.pasto_id] = e;
        }
      }

      // Determine default product
      const ret = retiros.find(r => r.id === retiroId);
      const defaultProdId = ret?.produto_id || "";

      setRows(pastos.map(p => {
        const ex = existingMap[p.id];
        return {
          pasto_id: p.id,
          nome: p.nome,
          num_animais: ex ? ex.num_animais : (p.num_animais ?? 0),
          peso_medio_kg: ex ? Number(ex.peso_medio_kg ?? 0) : Number(p.peso_medio_kg ?? 0),
          sexo: ex ? (ex.sexo ?? "") : (p.sexo ?? ""),
          categoria: ex ? (ex.categoria ?? "") : (p.categoria ?? ""),
          num_sacos: ex ? ex.num_sacos : 0,
          dias_no_pasto: ex ? ex.dias_no_pasto : (p.dias_no_pasto ?? diasNoPastoGlobal),
          produto_id: p.produto_id || defaultProdId,
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, field: keyof PastoRow, value: any) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === 'peso_medio_kg' && typeof value === 'number' && value > 0) {
        updated.categoria = classificarCategoria(value);
      }
      return updated;
    }));
  }

  function applyGlobalDias(dias: number) {
    setDiasNoPastoGlobal(dias);
    setRows(prev => prev.map(r => ({ ...r, dias_no_pasto: dias })));
  }

  function applyGlobalProduct(prodId: string) {
    setProdutoPadraoId(prodId);
    setRows(prev => prev.map(r => ({ ...r, produto_id: prodId })));
  }

  function calcConsumoForRow(r: PastoRow) {
    const prod = produtosMap[r.produto_id];
    if (!prod || r.num_animais <= 0 || r.dias_no_pasto <= 0 || r.num_sacos <= 0) return null;
    const cat = r.categoria || classificarCategoria(r.peso_medio_kg);
    const consumo_por_100kg = getConsumoPorCategoria(cat, prod);
    const margem = getMargemPorCategoria(cat, prod);
    return calcularConsumo({
      num_sacos: r.num_sacos,
      peso_saco_kg: prod.peso_saco_kg,
      num_animais: r.num_animais,
      dias: r.dias_no_pasto,
      peso_medio_kg: r.peso_medio_kg,
      consumo_por_100kg_categoria: consumo_por_100kg,
      margem,
    });
  }

  function statusBadge(status: string | undefined) {
    if (!status) return null;
    if (status === 'ABAIXO') return <Badge variant="destructive" className="text-[10px]">🔴 Abaixo</Badge>;
    if (status === 'IDEAL') return <Badge className="bg-yellow-500 text-white text-[10px]">🟡 Ideal</Badge>;
    if (status === 'ACIMA') return <Badge className="bg-green-600 text-white text-[10px]">🟢 Acima</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }

  async function handleSalvar() {
    for (const r of rows) {
      if (r.num_animais < 0) { toast.error(`Animais inválido em ${r.nome}`); return; }
      if (r.num_sacos < 0) { toast.error(`Sacos inválido em ${r.nome}`); return; }
      if (r.dias_no_pasto <= 0) { toast.error(`Dias no pasto deve ser > 0 em ${r.nome}`); return; }
    }

    setSaving(true);
    try {
      // Ensure ciclo exists
      const { data: cicloIdResult, error: cicloErr } = await supabase.rpc("ensure_ciclo_atual", { p_fazenda_id: fazendaId });
      if (cicloErr) throw cicloErr;
      const cicloId = cicloIdResult as string;

      for (const r of rows) {
        // Save to lancamentos_manuais
        const { error } = await supabase.from("lancamentos_manuais").upsert({
          fazenda_id: fazendaId,
          retiro_id: retiroId,
          pasto_id: r.pasto_id,
          mes_referencia: mes,
          ano_referencia: ano,
          num_animais: r.num_animais,
          peso_medio_kg: r.peso_medio_kg,
          sexo: r.sexo || null,
          categoria: r.categoria || null,
          num_sacos: r.num_sacos,
          dias_no_pasto: r.dias_no_pasto,
          origem: "manual",
        } as any, { onConflict: "pasto_id,mes_referencia,ano_referencia" });
        if (error) throw error;

        // Also save to lancamentos for consumption tracking
        const consumo = calcConsumoForRow(r);
        const prod = produtosMap[r.produto_id];

        const lancamentoData: any = {
          ciclo_id: cicloId,
          pasto_id: r.pasto_id,
          num_sacos: r.num_sacos,
          num_animais: r.num_animais,
          peso_medio_kg: r.peso_medio_kg,
          sexo: r.sexo || null,
          categoria: r.categoria || null,
          dias_no_pasto: r.dias_no_pasto,
          produto_id: r.produto_id || null,
          origem: "manual",
          consumo_g_cab_dia: consumo?.consumo_real_g_cab_dia ?? null,
          consumo_real_kg: consumo?.consumo_real_kg ?? null,
          consumo_esperado_kg: consumo?.consumo_esperado_kg ?? null,
          indice_consumo: consumo?.indice_consumo ?? null,
          status_consumo: consumo?.status_consumo ?? null,
          custo_total: prod ? r.num_sacos * prod.peso_saco_kg * (prod as any).preco_por_kg : null,
        };

        await supabase.from("lancamentos").upsert(lancamentoData, {
          onConflict: "pasto_id,ciclo_id",
        } as any);
      }
      toast.success("Lançamentos salvos com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  }

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + 1 - i);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Lançamento Manual</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seleção do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Fazenda</Label>
              <Select value={fazendaId} onValueChange={setFazendaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Retiro</Label>
              <Select value={retiroId} onValueChange={setRetiroId} disabled={!fazendaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {retiros.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global settings card */}
      {retiroId && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurações Globais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Intervalo entre salgas (dias)</Label>
                <Input
                  type="number" min={1} value={diasNoPastoGlobal}
                  onChange={e => applyGlobalDias(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={cicloFechado} className="w-32"
                />
                <p className="text-[11px] text-muted-foreground">Aplicado a todos os pastos</p>
              </div>
              <div className="space-y-2">
                <Label>Produto padrão</Label>
                <Select value={produtoPadraoId} onValueChange={applyGlobalProduct} disabled={cicloFechado}>
                  <SelectTrigger><SelectValue placeholder="Selecione produto..." /></SelectTrigger>
                  <SelectContent>
                    {produtos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} ({p.peso_saco_kg}kg/saco)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Peso do saco obtido automaticamente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {cicloFechado && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive font-medium">
          ⚠️ O ciclo de {MESES[mes - 1]}/{ano} está fechado. Edição bloqueada.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length > 0 ? (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Pasto</TableHead>
                  <TableHead className="min-w-[80px]">Animais</TableHead>
                  <TableHead className="min-w-[100px]">Peso médio (kg)</TableHead>
                  <TableHead className="min-w-[100px]">Sexo</TableHead>
                  <TableHead className="min-w-[110px]">Categoria</TableHead>
                  <TableHead className="min-w-[140px]">Produto</TableHead>
                  <TableHead className="min-w-[120px]">Sacos (mês)</TableHead>
                  <TableHead className="min-w-[100px]">Dias no pasto</TableHead>
                  <TableHead className="min-w-[150px]">Consumo (g/cab/dia)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => {
                  const consumo = calcConsumoForRow(r);
                  const prod = produtosMap[r.produto_id];
                  return (
                    <TableRow key={r.pasto_id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} value={r.num_animais}
                          onChange={e => updateRow(idx, "num_animais", Math.max(0, parseInt(e.target.value) || 0))}
                          disabled={cicloFechado} className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} step={0.1} value={r.peso_medio_kg}
                          onChange={e => updateRow(idx, "peso_medio_kg", Math.max(0, parseFloat(e.target.value) || 0))}
                          disabled={cicloFechado} className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={r.sexo} onValueChange={v => updateRow(idx, "sexo", v)} disabled={cicloFechado}>
                          <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Macho">Macho</SelectItem>
                            <SelectItem value="Fêmea">Fêmea</SelectItem>
                            <SelectItem value="Misto">Misto</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={r.categoria} onValueChange={v => updateRow(idx, "categoria", v)} disabled={cicloFechado}>
                          <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Recria 1">Recria 1</SelectItem>
                            <SelectItem value="Recria 2">Recria 2</SelectItem>
                            <SelectItem value="Engorda">Engorda</SelectItem>
                          </SelectContent>
                        </Select>
                        {r.peso_medio_kg > 0 && (
                          <span className="text-[10px] text-muted-foreground">auto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={r.produto_id} onValueChange={v => updateRow(idx, "produto_id", v)} disabled={cicloFechado}>
                          <SelectTrigger className="w-36"><SelectValue placeholder="Produto..." /></SelectTrigger>
                          <SelectContent>
                            {produtos.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {prod && (
                          <span className="text-[10px] text-muted-foreground">{prod.peso_saco_kg}kg/saco</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button" size="icon" variant="outline"
                            className="h-8 w-8"
                            disabled={cicloFechado || r.num_sacos <= 0}
                            onClick={() => updateRow(idx, "num_sacos", Math.max(0, r.num_sacos - 1))}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input
                            type="number" min={0} value={r.num_sacos}
                            onChange={e => updateRow(idx, "num_sacos", Math.max(0, parseInt(e.target.value) || 0))}
                            disabled={cicloFechado} className="w-16 text-center"
                          />
                          <Button
                            type="button" size="icon" variant="outline"
                            className="h-8 w-8"
                            disabled={cicloFechado}
                            onClick={() => updateRow(idx, "num_sacos", r.num_sacos + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={1} value={r.dias_no_pasto}
                          onChange={e => updateRow(idx, "dias_no_pasto", Math.max(1, parseInt(e.target.value) || 1))}
                          disabled={cicloFechado} className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {consumo ? (
                          <span className="font-semibold text-sm">
                            {consumo.consumo_real_g_cab_dia.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={saving || cicloFechado} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar e Enviar
            </Button>
          </div>
        </>
      ) : retiroId ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum pasto cadastrado neste retiro.</p>
      ) : null}
    </div>
  );
}
