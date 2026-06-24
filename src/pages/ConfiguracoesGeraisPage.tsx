import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, Plus, RotateCcw, History, FlaskConical, AlertTriangle, CheckCircle2, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { APP_VERSION } from "@/lib/appVersion";
import { useAuth } from "@/hooks/useAuth";


interface Configuracao {
  id: string;
  tipo: string;
  chave: string;
  titulo: string;
  descricao: string | null;
  formula: string | null;
  valor: number | null;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface HistoricoItem {
  id: string;
  configuracao_id: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_por: string | null;
  data: string | null;
}

const DEFAULTS: Record<string, { valor?: number; formula?: string }> = {
  hora_inicio_alerta: { valor: 6 },
  limite_leve: { valor: 1 },
  limite_moderado: { valor: 2 },
  limite_critico: { valor: 3 },
  consumo_real: { formula: "(num_sacos * peso_saco_kg) / (num_animais * dias_no_pasto) * 1000" },
  consumo_esperado: { formula: "(consumo_por_100kg_categoria * peso_medio_kg) / 100" },
  classificacao_consumo: { formula: "SE consumo_real < (consumo_esperado - margem) → ABAIXO | SE consumo_real > (consumo_esperado + margem) → ACIMA | SENÃO → IDEAL" },
  indice_consumo: { formula: "consumo_real / consumo_esperado" },
  consumo_ciclo: { formula: "(num_sacos * peso_saco_kg * 1000) / (num_animais * dias_no_pasto)" },
  consumo_mensal: { formula: "num_sacos * peso_saco_kg" },
  consumo_produto: { formula: "SUM(num_sacos * peso_saco_kg) GROUP BY produto_id" },
};

const SYSTEM_VARS = [
  "num_animais", "peso_medio_kg", "num_sacos", "dias_no_pasto",
  "peso_saco_kg", "consumo_por_100kg_categoria", "margem",
  "consumo_real", "consumo_esperado",
];

const SECTIONS = [
  { title: "Alertas", keys: ["hora_inicio_alerta", "limite_leve", "limite_moderado", "limite_critico"] },
  { title: "📊 Fórmulas de Cálculo", keys: ["consumo_real", "consumo_esperado", "classificacao_consumo"] },
  { title: "Fórmulas Auxiliares", keys: ["indice_consumo", "consumo_ciclo", "consumo_mensal", "consumo_produto"] },
];

function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula.trim()) return { valid: false, error: "Fórmula vazia" };
  // Classification formulas (rule-based) are always valid if non-empty
  if (/→|ABAIXO|ACIMA|IDEAL|SENÃO|SE\s/i.test(formula)) return { valid: true };
  // Check balanced parentheses
  let depth = 0;
  for (const ch of formula) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return { valid: false, error: "Parênteses desbalanceados" };
  }
  if (depth !== 0) return { valid: false, error: "Parênteses desbalanceados" };
  if (/\/\s*0(?!\d)/.test(formula)) return { valid: false, error: "Possível divisão por zero" };
  return { valid: true };
}

function testFormula(formula: string): { result: number | null; error?: string } {
  try {
    // classificacao_consumo is a rule-based formula, not math
    if (/→|ABAIXO|ACIMA|IDEAL|SENÃO|SE\s/i.test(formula)) {
      return { result: null, error: undefined };
    }
    const sampleVars: Record<string, number> = {
      num_animais: 200,
      peso_medio_kg: 350,
      num_sacos: 10,
      dias_no_pasto: 30,
      dias_intervalo: 3,
      peso_saco_kg: 25,
      consumo_por_100kg: 100,
      consumo_por_100kg_categoria: 100,
      margem: 10,
      consumo_real: 250,
      consumo_esperado: 700,
    };
    let expr = formula;
    expr = expr.replace(/SUM\(/gi, "(").replace(/GROUP BY\s+\w+/gi, "");
    for (const [k, v] of Object.entries(sampleVars)) {
      expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
    }
    const remaining = expr.replace(/[0-9+\-*/().,%\s]/g, "");
    if (remaining.length > 0) {
      return { result: null, error: `Variável desconhecida: ${remaining}` };
    }
    // eslint-disable-next-line no-eval
    const result = eval(expr);
    if (typeof result !== "number" || !isFinite(result)) {
      return { result: null, error: "Resultado inválido (infinito ou NaN)" };
    }
    return { result: Math.round(result * 1000) / 1000 };
  } catch (e: any) {
    return { result: null, error: e.message || "Erro ao avaliar fórmula" };
  }
}

export default function ConfiguracoesGeraisPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, { valor?: number; formula?: string }>>({});
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [newFormula, setNewFormula] = useState({ titulo: "", descricao: "", chave: "", formula: "" });
  const [showNewFormula, setShowNewFormula] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { result: number | null; error?: string }>>({});
  const [notifAtivas, setNotifAtivas] = useState<boolean>(true);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes_gerais")
        .select("valor")
        .eq("chave", "notificacoes_globais_ativas")
        .maybeSingle();
      if (data) setNotifAtivas(Number(data.valor) !== 0);
    })();
  }, []);

  const toggleNotificacoes = async (ativar: boolean) => {
    setNotifLoading(true);
    const novo = ativar ? 1 : 0;
    const { error } = await supabase.from("configuracoes_gerais").upsert(
      {
        tipo: "parametro",
        chave: "notificacoes_globais_ativas",
        titulo: "Notificações Push (Global)",
        descricao: "Liga/desliga o envio e a solicitação de notificações para todos os usuários.",
        valor: novo,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      } as any,
      { onConflict: "chave" },
    );
    setNotifLoading(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setNotifAtivas(ativar);
    toast.success(ativar ? "Notificações ativadas para todos" : "Notificações desativadas para todos");
  };



  const seedDefaults = useCallback(async () => {
    const seedData = [
      { tipo: "parametro", chave: "hora_inicio_alerta", titulo: "Hora Início Alerta", descricao: "Hora de início dos alertas", valor: 6 },
      { tipo: "parametro", chave: "limite_leve", titulo: "Limite Leve", descricao: "Atraso leve em dias", valor: 1 },
      { tipo: "parametro", chave: "limite_moderado", titulo: "Limite Moderado", descricao: "Atraso moderado em dias", valor: 2 },
      { tipo: "parametro", chave: "limite_critico", titulo: "Limite Crítico", descricao: "Atraso crítico em dias", valor: 3 },
      { tipo: "formula", chave: "consumo_real", titulo: "Consumo Real (g/cab/dia)", descricao: "Consumo real em g/cab/dia. Usa peso_saco_kg do produto.", formula: "(num_sacos * peso_saco_kg) / (num_animais * dias_no_pasto) * 1000" },
      { tipo: "formula", chave: "consumo_esperado", titulo: "Consumo Esperado (g/cab/dia)", descricao: "Consumo esperado baseado no consumo por categoria do produto e peso médio.", formula: "(consumo_por_100kg_categoria * peso_medio_kg) / 100" },
      { tipo: "formula", chave: "classificacao_consumo", titulo: "Classificação de Consumo", descricao: "Regra para classificar o consumo com base na margem do produto.", formula: "SE consumo_real < (consumo_esperado - margem) → ABAIXO | SE consumo_real > (consumo_esperado + margem) → ACIMA | SENÃO → IDEAL" },
      { tipo: "formula", chave: "indice_consumo", titulo: "Índice de Consumo", descricao: "Razão entre consumo real e esperado", formula: "consumo_real / consumo_esperado" },
      { tipo: "formula", chave: "consumo_ciclo", titulo: "Consumo por Ciclo (g/cab/dia)", descricao: "Consumo em g/cab/dia no ciclo", formula: "(num_sacos * peso_saco_kg * 1000) / (num_animais * dias_no_pasto)" },
      { tipo: "formula", chave: "consumo_mensal", titulo: "Consumo Mensal (kg)", descricao: "Consumo total mensal em kg", formula: "num_sacos * peso_saco_kg" },
      { tipo: "formula", chave: "consumo_produto", titulo: "Consumo por Produto", descricao: "Consumo agrupado por tipo de produto", formula: "SUM(num_sacos * peso_saco_kg) GROUP BY produto_id" },
    ];
    for (const item of seedData) {
      await supabase.from("configuracoes_gerais").upsert(item as any, { onConflict: "chave" });
    }
  }, []);

  const fetchConfigs = useCallback(async () => {
    let { data, error } = await supabase
      .from("configuracoes_gerais")
      .select("*")
      .eq("ativo", true)
      .order("criado_em");
    if (error) {
      toast.error("Erro ao carregar configurações");
      return;
    }
    if (!data || data.length === 0) {
      await seedDefaults();
      const res = await supabase.from("configuracoes_gerais").select("*").eq("ativo", true).order("criado_em");
      data = res.data;
    }
    setConfigs((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const getEdit = (c: Configuracao) => {
    if (edits[c.id]) return edits[c.id];
    return c.tipo === "formula" ? { formula: c.formula || "" } : { valor: c.valor ?? 0 };
  };

  const setEdit = (id: string, patch: { valor?: number; formula?: string }) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    const userName = user?.email || "admin";
    try {
      for (const c of configs) {
        const edit = edits[c.id];
        if (!edit) continue;
        const isFormula = c.tipo === "formula";
        const oldVal = isFormula ? c.formula : String(c.valor ?? "");
        const newVal = isFormula ? edit.formula : String(edit.valor ?? "");
        if (oldVal === newVal) continue;

        if (isFormula && edit.formula) {
          const v = validateFormula(edit.formula);
          if (!v.valid) {
            toast.error(`Fórmula "${c.titulo}" inválida: ${v.error}`);
            setSaving(false);
            return;
          }
          const t = testFormula(edit.formula);
          if (t.error) {
            toast.error(`Teste falhou para "${c.titulo}": ${t.error}`);
            setSaving(false);
            return;
          }
        }

        const updateData: any = { atualizado_em: new Date().toISOString() };
        if (isFormula) updateData.formula = edit.formula;
        else updateData.valor = edit.valor;

        const { error } = await supabase
          .from("configuracoes_gerais")
          .update(updateData)
          .eq("id", c.id);
        if (error) throw error;

        // Save history
        await supabase.from("configuracoes_historico").insert({
          configuracao_id: c.id,
          valor_antigo: oldVal,
          valor_novo: newVal,
          alterado_por: userName,
        } as any);
      }

      toast.success("Configurações salvas com sucesso!");
      setEdits({});
      fetchConfigs();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || ""));
    }
    setSaving(false);
  };

  const handleRestore = async (c: Configuracao) => {
    const def = DEFAULTS[c.chave];
    if (!def) { toast.error("Padrão não encontrado"); return; }
    const isFormula = c.tipo === "formula";
    setEdit(c.id, isFormula ? { formula: def.formula } : { valor: def.valor });
    toast.info(`"${c.titulo}" restaurado ao padrão. Salve para persistir.`);
  };

  const handleTest = (c: Configuracao) => {
    const edit = getEdit(c);
    const formula = edit.formula || c.formula || "";
    const result = testFormula(formula);
    setTestResults(prev => ({ ...prev, [c.id]: result }));
  };

  const handleAddFormula = async () => {
    if (!newFormula.titulo || !newFormula.formula || !newFormula.chave) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const v = validateFormula(newFormula.formula);
    if (!v.valid) { toast.error(`Fórmula inválida: ${v.error}`); return; }
    const t = testFormula(newFormula.formula);
    if (t.error) { toast.error(`Teste falhou: ${t.error}`); return; }

    const { error } = await supabase.from("configuracoes_gerais").insert({
      tipo: "formula",
      chave: newFormula.chave.toLowerCase().replace(/\s+/g, "_"),
      titulo: newFormula.titulo,
      descricao: newFormula.descricao,
      formula: newFormula.formula,
      ativo: true,
    } as any);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Nova fórmula adicionada!");
    setNewFormula({ titulo: "", descricao: "", chave: "", formula: "" });
    setShowNewFormula(false);
    fetchConfigs();
  };

  const fetchHistorico = async () => {
    const { data } = await supabase
      .from("configuracoes_historico")
      .select("*")
      .order("data", { ascending: false })
      .limit(50);
    setHistorico((data as any[]) || []);
    setShowHistorico(true);
  };

  const configsByKey = Object.fromEntries(configs.map(c => [c.chave, c]));
  const allSectionKeys = SECTIONS.flatMap(s => s.keys);
  const customFormulas = configs.filter(c => c.tipo === "formula" && !allSectionKeys.includes(c.chave));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Configurações Gerais</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHistorico}>
            <History className="w-4 h-4 mr-1" /> Histórico
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || Object.keys(edits).length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Alertas (parameters section) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{SECTIONS[0].title}</CardTitle>
          <CardDescription className="text-xs">
            Parâmetros de alerta. Intervalo de salga é definido na fazenda. Limites de consumo são definidos por produto (margem por categoria).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECTIONS[0].keys.map(key => {
              const c = configsByKey[key];
              if (!c) return null;
              const edit = getEdit(c);
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm font-medium">{c.titulo}</Label>
                  {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="any"
                      value={edit.valor ?? ""}
                      onChange={e => setEdit(c.id, { valor: parseFloat(e.target.value) || 0 })}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRestore(c)} title="Restaurar padrão">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Formula sections */}
      {SECTIONS.slice(1).map((section, si) => (
        <Card key={si}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{section.title}</CardTitle>
            <CardDescription className="text-xs">
              Variáveis disponíveis: {SYSTEM_VARS.join(", ")}
              {si === 0 && <><br />Valores de <strong>peso_saco_kg</strong>, <strong>consumo_por_100kg_categoria</strong> e <strong>margem</strong> vêm do produto vinculado ao lançamento. Resultado sempre em <strong>g/cab/dia</strong>.</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...section.keys, ...(si === SECTIONS.length - 2 ? customFormulas.map(c => c.chave) : [])].map(key => {
              const c = configsByKey[key] || customFormulas.find(f => f.chave === key);
              if (!c) return null;
              const edit = getEdit(c);
              const tr = testResults[c.id];
              const isClassificacao = c.chave === "classificacao_consumo";
              return (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{c.titulo}</span>
                      {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!isClassificacao && (
                        <Button variant="ghost" size="icon" onClick={() => handleTest(c)} title="Testar fórmula">
                          <FlaskConical className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleRestore(c)} title="Restaurar padrão">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={edit.formula ?? c.formula ?? ""}
                    onChange={e => setEdit(c.id, { formula: e.target.value })}
                    className="font-mono text-xs min-h-[60px]"
                    placeholder="Ex: (num_animais * peso_medio_kg) / 100"
                  />
                  {tr && !isClassificacao && (
                    <div className={`flex items-center gap-2 text-xs ${tr.error ? "text-destructive" : "text-green-600"}`}>
                      {tr.error ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {tr.error ? tr.error : `Resultado teste: ${tr.result} g/cab/dia`}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Add new formula */}
      <Card>
        <CardContent className="pt-6">
          <Dialog open={showNewFormula} onOpenChange={setShowNewFormula}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Nova Fórmula
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Fórmula</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Chave (identificador único)</Label>
                  <Input
                    value={newFormula.chave}
                    onChange={e => setNewFormula(p => ({ ...p, chave: e.target.value }))}
                    placeholder="ex: eficiencia_nutricional"
                  />
                </div>
                <div>
                  <Label>Título</Label>
                  <Input
                    value={newFormula.titulo}
                    onChange={e => setNewFormula(p => ({ ...p, titulo: e.target.value }))}
                    placeholder="ex: Eficiência Nutricional"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newFormula.descricao}
                    onChange={e => setNewFormula(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Para que serve e onde será usada"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label>Fórmula</Label>
                  <Textarea
                    value={newFormula.formula}
                    onChange={e => setNewFormula(p => ({ ...p, formula: e.target.value }))}
                    placeholder="consumo_real_kg / (num_animais * dias_intervalo)"
                    className="font-mono text-sm min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: {SYSTEM_VARS.join(", ")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleAddFormula}>Salvar Fórmula</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* History modal */}
      <Dialog open={showHistorico} onOpenChange={setShowHistorico}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Alterações</DialogTitle>
          </DialogHeader>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Novo</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{h.data ? new Date(h.data).toLocaleString("pt-BR") : "-"}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate">{h.valor_antigo || "-"}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate">{h.valor_novo || "-"}</TableCell>
                    <TableCell className="text-xs">{h.alterado_por || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
