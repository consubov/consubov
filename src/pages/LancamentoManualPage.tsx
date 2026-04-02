import { useState, useEffect } from "react";
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
import { classificarCategoria } from "@/lib/consumoCalc";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PastoRow {
  pasto_id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number;
  sexo: string;
  categoria: string;
  num_sacos: number;
  dias_no_pasto: number;
}

export default function LancamentoManualPage() {
  const now = new Date();
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [retiros, setRetiros] = useState<{ id: string; nome: string }[]>([]);
  const [fazendaId, setFazendaId] = useState("");
  const [retiroId, setRetiroId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [rows, setRows] = useState<PastoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cicloFechado, setCicloFechado] = useState(false);

  // Load fazendas
  useEffect(() => {
    supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setFazendas(data ?? []));
  }, []);

  // Load retiros when fazenda changes
  useEffect(() => {
    if (!fazendaId) { setRetiros([]); setRetiroId(""); return; }
    supabase.from("retiros").select("id, nome").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome")
      .then(({ data }) => { setRetiros(data ?? []); setRetiroId(""); });
  }, [fazendaId]);

  // Load pastos + existing data when retiro/month changes
  useEffect(() => {
    if (!retiroId) { setRows([]); return; }
    loadPastos();
    checkCicloFechado();
  }, [retiroId, mes, ano]);

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
        .select("id, nome, num_animais, peso_medio_kg, sexo, categoria, dias_no_pasto")
        .eq("retiro_id", retiroId).eq("ativo", true).order("nome");

      const pastos = pastosData ?? [];
      const pastoIds = pastos.map(p => p.id);

      // Check existing manual entries
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
          dias_no_pasto: ex ? ex.dias_no_pasto : (p.dias_no_pasto ?? 30),
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, field: keyof PastoRow, value: any) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSalvar() {
    // Validate
    for (const r of rows) {
      if (r.num_animais < 0) { toast.error(`Animais inválido em ${r.nome}`); return; }
      if (r.num_sacos < 0) { toast.error(`Sacos inválido em ${r.nome}`); return; }
      if (r.dias_no_pasto <= 0) { toast.error(`Dias no pasto deve ser > 0 em ${r.nome}`); return; }
    }

    setSaving(true);
    try {
      // Upsert each row
      for (const r of rows) {
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
      }
      toast.success("Lançamentos manuais salvos com sucesso!");
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
                  <TableHead className="min-w-[120px]">Sacos (mês)</TableHead>
                  <TableHead className="min-w-[100px]">Dias no pasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
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
                  </TableRow>
                ))}
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
