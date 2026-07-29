import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParceirosEditor from "@/components/landing/ParceirosEditor";
import { toast } from "sonner";

import {
  Save,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  X,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

/* ------------------- Schema definition ------------------- */

type FieldType = "text" | "textarea" | "image" | "json";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** For json arrays: definition of each item field */
  itemFields?: { key: string; label: string; type: "text" | "textarea" | "image" }[];
  /** For json arrays: default new item shape */
  newItem?: Record<string, string>;
  /** Help text */
  help?: string;
}

interface SectionDef {
  id: string;
  title: string;
  description?: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "hero",
    title: "1. Hero (topo da página)",
    description: "Título principal, subtítulo, badge e botões.",
    fields: [
      { key: "hero_titulo", label: "Título principal", type: "text", placeholder: "CONSUBOV" },
      { key: "hero_subtitulo", label: "Subtítulo", type: "text", placeholder: "O FUTURO DA PECUÁRIA" },
      { key: "hero_subtitulo_destaque", label: "Subtítulo destaque (verde)", type: "text", placeholder: "CHEGOU." },
      { key: "hero_descricao", label: "Descrição", type: "textarea" },
      { key: "hero_badge", label: "Badge superior", type: "text", placeholder: "SISTEMA ATIVO • BR" },
      { key: "hero_cta_primario", label: "Botão CTA principal", type: "text", placeholder: "Solicitar Demonstração" },
      { key: "hero_cta_secundario", label: "Botão CTA secundário", type: "text", placeholder: "Conheça a Plataforma" },
    ],
  },
  {
    id: "impacto",
    title: "2. Impacto Real",
    fields: [
      { key: "impacto_tag", label: "Tag superior", type: "text", placeholder: "IMPACTO REAL" },
      { key: "impacto_titulo", label: "Título", type: "text", placeholder: "Números que" },
      { key: "impacto_subtitulo_destaque", label: "Título destaque (verde)", type: "text", placeholder: "movem o setor" },
      {
        key: "impacto_metricas",
        label: "Métricas (até 4)",
        type: "json",
        help: "Use ícone do Lucide (ex: Activity, Map, Zap, BarChart3). Para o número, formato como '130000+' ou '12 estados'.",
        itemFields: [
          { key: "icone_lucide", label: "Ícone Lucide", type: "text" },
          { key: "numero", label: "Número (ex: 130000+)", type: "text" },
          { key: "label", label: "Legenda", type: "text" },
        ],
        newItem: { icone_lucide: "Activity", numero: "0", label: "" },
      },
    ],
  },
  {
    id: "problema",
    title: "3. O Problema",
    fields: [
      { key: "problema_tag", label: "Tag superior", type: "text", placeholder: "O PROBLEMA" },
      { key: "problema_titulo", label: "Título", type: "text" },
      { key: "problema_titulo_destaque", label: "Título destaque (vermelho)", type: "text" },
      {
        key: "problema_itens",
        label: "Lista de problemas",
        type: "json",
        itemFields: [{ key: "texto", label: "Texto", type: "text" }],
        newItem: { texto: "" },
      },
    ],
  },
  {
    id: "solucao",
    title: "4. A Solução",
    fields: [
      { key: "solucao_tag", label: "Tag superior", type: "text", placeholder: "A SOLUÇÃO" },
      { key: "solucao_titulo", label: "Título", type: "text" },
      { key: "solucao_titulo_destaque", label: "Título destaque (verde)", type: "text" },
      { key: "solucao_descricao", label: "Descrição", type: "textarea" },
      {
        key: "solucao_features",
        label: "Features (até 6)",
        type: "json",
        help: "Ícone do Lucide (ex: QrCode, CheckCircle2, WifiOff, BarChart3, Map, FileBarChart).",
        itemFields: [
          { key: "icone_lucide", label: "Ícone Lucide", type: "text" },
          { key: "texto", label: "Texto", type: "text" },
        ],
        newItem: { icone_lucide: "Sparkles", texto: "" },
      },
    ],
  },
  {
    id: "rede",
    title: "5. Rede Nacional (mapa)",
    fields: [
      { key: "rede_tag", label: "Tag superior", type: "text", placeholder: "REDE NACIONAL" },
      { key: "rede_titulo", label: "Título", type: "text" },
      { key: "rede_titulo_destaque", label: "Título destaque (verde)", type: "text" },
      { key: "rede_descricao", label: "Descrição", type: "textarea" },
      {
        key: "rede_estados",
        label: "Estados ativos (badges)",
        type: "json",
        itemFields: [
          { key: "sigla", label: "Sigla (ex: TO)", type: "text" },
          { key: "status", label: "Status", type: "text" },
        ],
        newItem: { sigla: "", status: "online" },
      },
    ],
  },
  {
    id: "manifesto",
    title: "6. Manifesto",
    fields: [
      { key: "manifesto_tag", label: "Tag superior", type: "text", placeholder: "MANIFESTO" },
      { key: "manifesto_titulo", label: "Título", type: "text" },
      { key: "manifesto_titulo_destaque", label: "Título destaque (verde)", type: "text" },
      { key: "manifesto_descricao", label: "Descrição", type: "textarea" },
      { key: "manifesto_imagem_fundo", label: "Imagem de fundo", type: "image" },
    ],
  },
  {
    id: "parceiros",
    title: "7. Parceiros",
    fields: [
      {
        key: "parceiros_logos",
        label: "Logos dos parceiros",
        type: "json",
        itemFields: [
          { key: "url_imagem", label: "Imagem", type: "image" },
          { key: "nome_alt", label: "Nome (alt)", type: "text" },
        ],
        newItem: { url_imagem: "", nome_alt: "" },
      },
    ],
  },
  {
    id: "depoimentos",
    title: "8. Depoimentos",
    fields: [
      {
        key: "depoimentos",
        label: "Depoimentos",
        type: "json",
        itemFields: [
          { key: "nome", label: "Nome", type: "text" },
          { key: "cargo", label: "Cargo", type: "text" },
          { key: "fazenda", label: "Fazenda", type: "text" },
          { key: "texto", label: "Texto", type: "textarea" },
          { key: "foto_url", label: "Foto", type: "image" },
        ],
        newItem: { nome: "", cargo: "", fazenda: "", texto: "", foto_url: "" },
      },
    ],
  },
  {
    id: "cta",
    title: "9. CTA Final / Formulário",
    fields: [
      { key: "cta_tag", label: "Tag superior", type: "text", placeholder: "ESTAMOS CHEGANDO" },
      { key: "cta_titulo", label: "Título", type: "text" },
      { key: "cta_titulo_destaque", label: "Título destaque (verde)", type: "text" },
      { key: "cta_descricao", label: "Descrição", type: "textarea" },
      {
        key: "form_campos",
        label: "Campos do formulário",
        type: "json",
        help: "Tipos: text, email, tel, textarea. Os placeholders 'nome', 'email', 'telefone', 'whatsapp' e 'mensagem' são reconhecidos automaticamente para envio.",
        itemFields: [
          { key: "placeholder", label: "Placeholder", type: "text" },
          { key: "tipo", label: "Tipo (text/email/tel/textarea)", type: "text" },
        ],
        newItem: { placeholder: "", tipo: "text" },
      },
      { key: "form_botao_texto", label: "Texto do botão", type: "text", placeholder: "Quero fazer parte" },
    ],
  },
  {
    id: "footer",
    title: "10. Rodapé",
    fields: [
      { key: "footer_cidade", label: "Cidade", type: "text", placeholder: "Araguaína — TO, Brasil" },
      { key: "footer_telefone", label: "Telefone", type: "text", placeholder: "(63) 99113-6071" },
      { key: "footer_ano", label: "Ano", type: "text", placeholder: "2026" },
      { key: "footer_copyright", label: "Texto de copyright", type: "text", placeholder: "Consubov. Todos os direitos reservados." },
    ],
  },
];

/* ------------------- Helpers ------------------- */

const BUCKET = "landing";

async function uploadImage(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) {
    toast.error(`Erro ao enviar imagem: ${error.message}`);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ------------------- Single image input ------------------- */

function ImageInput({
  value,
  onChange,
  folder,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const url = await uploadImage(file, folder);
    setBusy(false);
    if (url) onChange(url);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative group">
          <img src={value} alt="" className="w-20 h-20 object-cover rounded-md border border-border" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remover"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="w-20 h-20 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
          <Upload className="w-5 h-5" />
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {busy ? "Enviando..." : value ? "Substituir" : "Enviar"}
      </Button>
    </div>
  );
}

/* ------------------- JSON list editor ------------------- */

function JsonListEditor({
  field,
  value,
  onChange,
  folder,
}: {
  field: FieldDef;
  value: any[];
  onChange: (v: any[]) => void;
  folder: string;
}) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx: number, key: string, v: string) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [key]: v };
    onChange(copy);
  };
  const add = () => onChange([...items, { ...(field.newItem || {}) }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum item ainda. Clique em "Adicionar item" para começar.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <GripVertical className="w-3.5 h-3.5" />
              <span className="font-medium">Item #{idx + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)}>
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {field.itemFields?.map((f) => (
              <div key={f.key} className={f.type === "textarea" || f.type === "image" ? "sm:col-span-2" : ""}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={item[f.key] || ""}
                    onChange={(e) => update(idx, f.key, e.target.value)}
                    rows={3}
                  />
                ) : f.type === "image" ? (
                  <ImageInput value={item[f.key] || ""} onChange={(url) => update(idx, f.key, url)} folder={folder} />
                ) : (
                  <Input
                    value={item[f.key] || ""}
                    onChange={(e) => update(idx, f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-2">
        <Plus className="w-4 h-4" /> Adicionar item
      </Button>
    </div>
  );
}

/* ------------------- Section card ------------------- */

function SectionCard({
  section,
  values,
  setValues,
  landingSlug,
}: {
  section: SectionDef;
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
  landingSlug: string;
}) {
  const [open, setOpen] = useState(section.id === "hero" || section.id === "relatto_hero");
  const [saving, setSaving] = useState(false);
  const folder = section.id;


  const setField = (key: string, value: string) => {
    setValues({ ...values, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const rows = section.fields.map((f) => ({
      chave: f.key,
      valor: values[f.key] ?? "",
      atualizado_em: now,
      landing_slug: landingSlug,
    }));
    let ok = true;
    for (const row of rows) {
      const { error } = await supabase
        .from("landing_page_content")
        .upsert(row, { onConflict: "landing_slug,chave" });

      if (error) {
        ok = false;
        toast.error(`Erro ao salvar ${row.chave}: ${error.message}`);
      }
    }
    setSaving(false);
    if (ok) toast.success(`Seção "${section.title}" salva!`);
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{section.title}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CardTitle>
        {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {section.fields.map((field) => {
            if (field.type === "json") {
              let parsed: any[] = [];
              try {
                parsed = JSON.parse(values[field.key] || "[]");
                if (!Array.isArray(parsed)) parsed = [];
              } catch {
                parsed = [];
              }
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm">{field.label}</Label>
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                  <JsonListEditor
                    field={field}
                    value={parsed}
                    onChange={(arr) => setField(field.key, JSON.stringify(arr))}
                    folder={folder}
                  />
                </div>
              );
            }
            if (field.type === "image") {
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm">{field.label}</Label>
                  <ImageInput
                    value={values[field.key] || ""}
                    onChange={(url) => setField(field.key, url)}
                    folder={folder}
                  />
                </div>
              );
            }
            return (
              <div key={field.key} className="space-y-2">
                <Label className="text-sm">{field.label}</Label>
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                {field.type === "textarea" ? (
                  <Textarea
                    value={values[field.key] || ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    maxLength={2000}
                  />
                ) : (
                  <Input
                    value={values[field.key] || ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={300}
                  />
                )}
              </div>
            );
          })}
          <div className="flex justify-end pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar seção"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------- Page ------------------- */

export default function LandingPageConfigPage() {
  const [landingSlug, setLandingSlug] = useState<"consubov" | "relatto">("consubov");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  const sections = landingSlug === "relatto" ? RELATTO_SECTIONS : SECTIONS;

  useEffect(() => {
    setLoading(true);
    supabase
      .from("landing_page_content")
      .select("chave, valor")
      .eq("landing_slug", landingSlug)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r) => {
          map[r.chave] = r.valor || "";
        });
        setValues(map);
        setLoading(false);
      });
  }, [landingSlug]);

  const handleSaveAll = async () => {
    setSavingAll(true);
    const now = new Date().toISOString();
    const allKeys = sections.flatMap((s) => s.fields.map((f) => f.key));
    const rows = allKeys.map((chave) => ({
      chave,
      valor: values[chave] ?? "",
      atualizado_em: now,
      landing_slug: landingSlug,
    }));
    let okCount = 0;
    let errCount = 0;
    for (const row of rows) {
      const { error } = await supabase
        .from("landing_page_content")
        .upsert(row, { onConflict: "landing_slug,chave" });
      if (error) {
        errCount++;
      } else {
        okCount++;
      }
    }
    setSavingAll(false);
    if (errCount === 0) {
      toast.success(`Todas as alterações foram salvas (${okCount} campos).`);
    } else {
      toast.error(`Salvos ${okCount}, falharam ${errCount}.`);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Landing Page</h1>
          <p className="text-xs text-muted-foreground">Edite cada seção e salve individualmente.</p>
        </div>
      </div>

      <Tabs value={landingSlug} onValueChange={(v) => setLandingSlug(v as "consubov" | "relatto")}>
        <TabsList>
          <TabsTrigger value="consubov">Consubov</TabsTrigger>
          <TabsTrigger value="relatto">Relatto</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <SectionCard
              key={`${landingSlug}-${section.id}`}
              section={section}
              values={values}
              setValues={setValues}
              landingSlug={landingSlug}
            />
          ))}
          {landingSlug === "relatto" && <ParceirosEditor landingSlug="relatto" />}
        </div>
      )}


      {/* Botão flutuante: Salvar todas as alterações */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSaveAll}
          disabled={savingAll}
          size="lg"
          className="gap-2 shadow-2xl bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-6 rounded-full"
        >
          {savingAll ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {savingAll ? "Salvando..." : "💾 Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
