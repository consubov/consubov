import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Formula {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  formula: string;
  variaveis: string[] | null;
  parametros: Record<string, number> | null;
  ativo: boolean;
}

const CATEGORIA_LABEL: Record<string, string> = {
  consumo: "Consumo",
  eficiencia: "Eficiência",
  classificacao: "Classificação",
};

export default function FormulasSistemaPage() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ formula: string; parametros: Record<string, number> }>({
    formula: "",
    parametros: {},
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("formulas_sistema")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar fórmulas");
    } else {
      setFormulas((data ?? []) as any);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = formulas.reduce<Record<string, Formula[]>>((acc, f) => {
    (acc[f.categoria] ||= []).push(f);
    return acc;
  }, {});

  const startEdit = (f: Formula) => {
    setEditingId(f.id);
    setDraft({
      formula: f.formula ?? "",
      parametros: { ...(f.parametros ?? {}) },
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ formula: "", parametros: {} });
  };

  const save = async (f: Formula) => {
    setSaving(true);
    const { error } = await supabase
      .from("formulas_sistema")
      .update({
        formula: draft.formula,
        parametros: draft.parametros,
        atualizado_em: new Date().toISOString(),
      })
      .eq("chave", f.chave);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Fórmula atualizada");
    setEditingId(null);
    await load();
  };

  const toggleAtivo = async (f: Formula, ativo: boolean) => {
    const { error } = await supabase
      .from("formulas_sistema")
      .update({ ativo })
      .eq("chave", f.chave);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setFormulas((prev) => prev.map((x) => (x.id === f.id ? { ...x, ativo } : x)));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fórmulas do Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as fórmulas de cálculo utilizadas pelo sistema. As alterações não afetam cálculos existentes até que a integração seja habilitada.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : formulas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma fórmula cadastrada.
          </CardContent>
        </Card>
      ) : (
        Object.keys(grouped)
          .sort()
          .map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold text-primary border-b border-border pb-1">
                {CATEGORIA_LABEL[cat] ?? cat}
              </h2>
              <div className="space-y-3">
                {grouped[cat].map((f) => {
                  const isEditing = editingId === f.id;
                  const params = isEditing ? draft.parametros : (f.parametros ?? {});
                  const paramKeys = Object.keys(f.parametros ?? {});
                  return (
                    <Card key={f.id} className={!f.ativo ? "opacity-60" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                              {f.nome}
                              <Badge variant="outline" className="text-xs font-mono">
                                {f.chave}
                              </Badge>
                            </CardTitle>
                            {f.descricao && (
                              <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={f.ativo}
                                onCheckedChange={(v) => toggleAtivo(f, v)}
                                disabled={isEditing}
                              />
                              <span className="text-xs text-muted-foreground">
                                {f.ativo ? "Ativa" : "Inativa"}
                              </span>
                            </div>
                            {!isEditing ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(f)}
                                aria-label="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => save(f)}
                                  disabled={saving}
                                  className="bg-primary hover:bg-primary/90"
                                >
                                  <Save className="w-4 h-4 mr-1" /> Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >
                                  <X className="w-4 h-4 mr-1" /> Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-xs font-medium">Fórmula</Label>
                          <Textarea
                            value={isEditing ? draft.formula : f.formula}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, formula: e.target.value }))
                            }
                            readOnly={!isEditing}
                            rows={2}
                            className="font-mono text-sm mt-1 bg-muted/40"
                          />
                          {f.variaveis && f.variaveis.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Variáveis disponíveis:</span>{" "}
                              {f.variaveis.join(", ")}
                            </p>
                          )}
                        </div>

                        {paramKeys.length > 0 && (
                          <div>
                            <Label className="text-xs font-medium">Parâmetros</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                              {paramKeys.map((k) => (
                                <div key={k}>
                                  <Label className="text-xs text-muted-foreground">{k}</Label>
                                  <Input
                                    type="number"
                                    step="any"
                                    value={(params as any)[k] ?? ""}
                                    readOnly={!isEditing}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        parametros: {
                                          ...d.parametros,
                                          [k]: e.target.value === "" ? 0 : Number(e.target.value),
                                        },
                                      }))
                                    }
                                    className="bg-muted/40"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
