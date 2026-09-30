import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Save, PackagePlus, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { compressImageDataUrl } from "@/lib/imageCompression";

interface Materia { id: string; nome: string; unidade: string; }
interface Fabrica { id: string; nome: string; codigo: string | null; }
interface Entrada {
  id: string;
  quantidade: number;
  data_entrada: string;
  observacao: string | null;
  materia_prima_id: string;
  fabrica_id: string;
}

export default function EntradaMateriasPrimasPage() {
  const { user } = useAuth();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [materiaId, setMateriaId] = useState("");
  const [fabricaId, setFabricaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [mp, fb, en] = await Promise.all([
      supabase.from("materias_primas").select("id, nome, unidade").eq("ativo", true).order("nome"),
      supabase.from("fabricas").select("id, nome, codigo").eq("ativo", true).order("nome"),
      supabase.from("entradas_materias_primas").select("*").order("data_entrada", { ascending: false }).limit(20),
    ]);
    setMaterias((mp.data as Materia[]) || []);
    setFabricas((fb.data as Fabrica[]) || []);
    setEntradas((en.data as Entrada[]) || []);
    setLoading(false);
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(reader.result as string);
      setFoto(compressed);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!materiaId) return toast.error("Selecione a matéria-prima");
    if (!fabricaId) return toast.error("Selecione a fábrica");
    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) return toast.error("Quantidade inválida");

    setSaving(true);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        const blob = await (await fetch(foto)).blob();
        const path = `materias-primas/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: upErr } = await supabase.storage.from("mapas").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("mapas").getPublicUrl(path);
        fotoUrl = pub.publicUrl;
      }

      const { error } = await supabase.from("entradas_materias_primas").insert({
        materia_prima_id: materiaId,
        fabrica_id: fabricaId,
        quantidade: qtd,
        data_entrada: dataEntrada,
        observacao: observacao.trim() || null,
        foto_url: fotoUrl,
        registrado_por: user?.id ?? null,
      });
      if (error) throw error;

      toast.success("Entrada registrada! Estoque atualizado.");
      setMateriaId(""); setFabricaId(""); setQuantidade("");
      setDataEntrada(new Date().toISOString().slice(0, 10));
      setObservacao(""); setFoto(null);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  const mpMap = Object.fromEntries(materias.map(m => [m.id, m.nome]));
  const fbMap = Object.fromEntries(fabricas.map(f => [f.id, f.nome]));

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <PackagePlus className="w-5 h-5" /> Entrada de Matérias-Primas
      </h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Nova entrada</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Matéria-Prima *</Label>
              <Select value={materiaId} onValueChange={setMateriaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.unidade})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fábrica *</Label>
              <Select value={fabricaId} onValueChange={setFabricaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fabricas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Foto (opcional)</Label>
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-accent text-sm">
                <Camera className="w-4 h-4" />
                {foto ? "Trocar foto" : "Adicionar foto"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
              </label>
              {foto && (
                <div className="relative">
                  <img src={foto} alt="preview" className="w-16 h-16 rounded object-cover border" />
                  <button type="button" onClick={() => setFoto(null)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar entrada
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas entradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Matéria-Prima</TableHead>
                  <TableHead>Fábrica</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradas.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma entrada registrada</TableCell></TableRow>
                ) : entradas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.data_entrada).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{mpMap[e.materia_prima_id] || "—"}</TableCell>
                    <TableCell>{fbMap[e.fabrica_id] || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{e.quantidade}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.observacao || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
