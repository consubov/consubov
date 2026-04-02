import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Globe, Loader2 } from "lucide-react";
import ImageUploadField from "@/components/landing/ImageUploadField";

const TEXT_KEYS = [
  { key: "quem_somos", label: "Texto — Quem somos nós", type: "textarea" },
  { key: "diferenciais", label: "Texto — Nossos diferenciais (subtítulo)", type: "textarea" },
  { key: "form_titulo", label: "Título do formulário", type: "input" },
  { key: "form_descricao", label: "Descrição do formulário", type: "input" },
  { key: "rodape", label: "Texto do rodapé", type: "textarea" },
];

const IMAGE_KEYS = [
  { key: "img_carrossel", label: "Imagens do carrossel (topo)", folder: "carrossel", multiple: true },
  { key: "img_quem_somos", label: "Imagem — Quem somos nós", folder: "quem-somos", multiple: false },
  { key: "img_diferenciais", label: "Imagem — Nossos diferenciais", folder: "diferenciais", multiple: false },
  { key: "img_parceiros", label: "Logos dos parceiros", folder: "parceiros", multiple: true },
];

export default function LandingPageConfigPage() {
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [imageValues, setImageValues] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("landing_page_content").select("chave, valor").then(({ data }) => {
      if (data) {
        const texts: Record<string, string> = {};
        const images: Record<string, string[]> = {};
        data.forEach((r) => {
          const imageKey = IMAGE_KEYS.find((k) => k.key === r.chave);
          if (imageKey) {
            try {
              images[r.chave] = JSON.parse(r.valor || "[]");
            } catch {
              images[r.chave] = r.valor ? [r.valor] : [];
            }
          } else {
            texts[r.chave] = r.valor || "";
          }
        });
        setTextValues(texts);
        setImageValues(images);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const upserts: { chave: string; valor: string; atualizado_em: string }[] = [];
    const now = new Date().toISOString();

    for (const item of TEXT_KEYS) {
      const val = textValues[item.key];
      if (val !== undefined) {
        upserts.push({ chave: item.key, valor: val, atualizado_em: now });
      }
    }

    for (const item of IMAGE_KEYS) {
      const urls = imageValues[item.key] || [];
      upserts.push({ chave: item.key, valor: JSON.stringify(urls), atualizado_em: now });
    }

    for (const row of upserts) {
      await supabase.from("landing_page_content").upsert(row, { onConflict: "chave" });
    }

    setSaving(false);
    toast.success("Conteúdo salvo com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Landing Page</h1>
      </div>

      {/* Image uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Imagens e Mídia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {IMAGE_KEYS.map((item) => (
            <ImageUploadField
              key={item.key}
              label={item.label}
              folder={item.folder}
              multiple={item.multiple}
              urls={imageValues[item.key] || []}
              onChange={(urls) => setImageValues({ ...imageValues, [item.key]: urls })}
            />
          ))}
        </CardContent>
      </Card>

      {/* Text content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conteúdo textual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {TEXT_KEYS.map((item) => (
            <div key={item.key} className="space-y-2">
              <label className="text-sm font-medium text-foreground">{item.label}</label>
              {item.type === "textarea" ? (
                <Textarea
                  value={textValues[item.key] || ""}
                  onChange={(e) => setTextValues({ ...textValues, [item.key]: e.target.value })}
                  rows={4}
                  maxLength={2000}
                />
              ) : (
                <Input
                  value={textValues[item.key] || ""}
                  onChange={(e) => setTextValues({ ...textValues, [item.key]: e.target.value })}
                  maxLength={200}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="w-4 h-4" />
        {saving ? "Salvando..." : "Salvar Conteúdo"}
      </Button>
    </div>
  );
}
