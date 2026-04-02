import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Globe } from "lucide-react";

const CONTENT_KEYS = [
  { key: "quem_somos", label: "Texto — Quem somos nós", type: "textarea" },
  { key: "diferenciais", label: "Texto — Nossos diferenciais (subtítulo)", type: "textarea" },
  { key: "form_titulo", label: "Título do formulário", type: "input" },
  { key: "form_descricao", label: "Descrição do formulário", type: "input" },
  { key: "rodape", label: "Texto do rodapé", type: "textarea" },
];

export default function LandingPageConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("landing_page_content").select("chave, valor").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r) => { map[r.chave] = r.valor || ""; });
        setValues(map);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const item of CONTENT_KEYS) {
      const val = values[item.key];
      if (val !== undefined) {
        await supabase.from("landing_page_content").upsert(
          { chave: item.key, valor: val, atualizado_em: new Date().toISOString() },
          { onConflict: "chave" }
        );
      }
    }
    setSaving(false);
    toast.success("Conteúdo salvo com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Landing Page</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conteúdo editável</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {CONTENT_KEYS.map((item) => (
            <div key={item.key} className="space-y-2">
              <label className="text-sm font-medium text-foreground">{item.label}</label>
              {item.type === "textarea" ? (
                <Textarea
                  value={values[item.key] || ""}
                  onChange={(e) => setValues({ ...values, [item.key]: e.target.value })}
                  rows={4}
                  maxLength={2000}
                />
              ) : (
                <Input
                  value={values[item.key] || ""}
                  onChange={(e) => setValues({ ...values, [item.key]: e.target.value })}
                  maxLength={200}
                />
              )}
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Conteúdo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
