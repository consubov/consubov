import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";

interface Parceiro {
  id: string;
  nome: string;
  logo_url: string | null;
  ordem: number;
  ativo: boolean;
}

const BUCKET = "landing";

export default function ParceirosEditor({ landingSlug }: { landingSlug: string }) {
  const [items, setItems] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("landing_parceiros")
      .select("id, nome, logo_url, ordem, ativo")
      .eq("landing_slug", landingSlug)
      .order("ordem", { ascending: true });
    setItems((data as Parceiro[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingSlug]);

  const addParceiro = async () => {
    const ordem = items.length ? Math.max(...items.map((i) => i.ordem)) + 1 : 0;
    const { error } = await supabase
      .from("landing_parceiros")
      .insert({ landing_slug: landingSlug, nome: "", ordem, ativo: true });
    if (error) return toast.error(error.message);
    void load();
  };

  const removeParceiro = async (id: string) => {
    const { error } = await supabase.from("landing_parceiros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const patch = async (id: string, values: Partial<Parceiro>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...values } : p)));
    const { error } = await supabase.from("landing_parceiros").update(values).eq("id", id);
    if (error) toast.error(error.message);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    const a = items[idx];
    const b = items[ni];
    const copy = [...items];
    copy[idx] = b;
    copy[ni] = a;
    setItems(copy);
    await supabase.from("landing_parceiros").update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("landing_parceiros").update({ ordem: a.ordem }).eq("id", b.id);
    void load();
  };

  const upload = async (id: string, file?: File) => {
    if (!file) return;
    setBusyId(id);
    const ext = file.name.split(".").pop() || "png";
    const path = `parceiros-${landingSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setBusyId(null);
      return toast.error(`Erro ao enviar imagem: ${error.message}`);
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await patch(id, { logo_url: data.publicUrl });
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parceiros (logos)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Adicione, remova e reordene as logos exibidas na seção Parceiros.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum parceiro cadastrado.</p>
        ) : (
          items.map((p, idx) => (
            <div key={p.id} className="rounded-lg border border-border p-3 bg-muted/30 flex items-center gap-3">
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="w-16 h-16 object-contain rounded-md border border-border bg-background" />
              ) : (
                <div className="w-16 h-16 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Upload className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Input
                  value={p.nome || ""}
                  placeholder="Nome do parceiro"
                  maxLength={120}
                  onChange={(e) => setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, nome: e.target.value } : x)))}
                  onBlur={(e) => patch(p.id, { nome: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => (fileRefs.current[p.id] = el)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => upload(p.id, e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === p.id}
                    onClick={() => fileRefs.current[p.id]?.click()}
                  >
                    {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {p.logo_url ? "Substituir" : "Enviar logo"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => patch(p.id, { ativo: !p.ativo })}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => move(idx, -1)}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(idx, 1)}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeParceiro(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addParceiro}>
          <Plus className="w-4 h-4" /> Adicionar parceiro
        </Button>
      </CardContent>
    </Card>
  );
}
