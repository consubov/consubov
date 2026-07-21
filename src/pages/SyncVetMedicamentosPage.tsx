import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Pill } from "lucide-react";

type Med = {
  id: string;
  nome_comercial: string;
  principio_ativo: string | null;
  laboratorio: string | null;
  dosagem_padrao: string | null;
  via_aplicacao: string | null;
  observacoes: string | null;
  foto_url: string | null;
};

const BUCKET = "syncvet-medicamentos";

async function resolveSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function SyncVetMedicamentosPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [rows, setRows] = useState<Med[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Med | null>(null);
  const [saving, setSaving] = useState(false);

  const [nomeComercial, setNomeComercial] = useState("");
  const [principio, setPrincipio] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [dosagem, setDosagem] = useState("");
  const [via, setVia] = useState("");
  const [obs, setObs] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_medicamentos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome_comercial");
    if (error) toast.error(error.message);
    const list = (data as Med[]) ?? [];
    setRows(list);
    const map: Record<string, string> = {};
    await Promise.all(list.map(async (m) => {
      const url = await resolveSignedUrl(m.foto_url);
      if (url) map[m.id] = url;
    }));
    setSigned(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  function reset() {
    setEditing(null);
    setNomeComercial(""); setPrincipio(""); setLaboratorio("");
    setDosagem(""); setVia(""); setObs("");
    setFotoFile(null); setFotoPath(null);
  }
  function openNew() { reset(); setOpen(true); }
  function openEdit(m: Med) {
    setEditing(m);
    setNomeComercial(m.nome_comercial);
    setPrincipio(m.principio_ativo ?? "");
    setLaboratorio(m.laboratorio ?? "");
    setDosagem(m.dosagem_padrao ?? "");
    setVia(m.via_aplicacao ?? "");
    setObs(m.observacoes ?? "");
    setFotoFile(null);
    setFotoPath(m.foto_url);
    setOpen(true);
  }

  async function handleSave() {
    if (!empresaId) return;
    if (!nomeComercial.trim()) { toast.error("Nome comercial é obrigatório"); return; }
    setSaving(true);
    try {
      let finalPath = fotoPath;
      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop() || "jpg";
        const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, fotoFile, { upsert: false });
        if (upErr) throw upErr;
        finalPath = path;
      }
      const payload = {
        empresa_id: empresaId,
        nome_comercial: nomeComercial.trim(),
        principio_ativo: principio || null,
        laboratorio: laboratorio || null,
        dosagem_padrao: dosagem || null,
        via_aplicacao: via || null,
        observacoes: obs || null,
        foto_url: finalPath,
      };
      if (editing) {
        const { error } = await supabase.from("syncvet_medicamentos").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Medicamento atualizado");
      } else {
        const { error } = await supabase.from("syncvet_medicamentos").insert(payload as any);
        if (error) throw error;
        toast.success("Medicamento adicionado");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: Med) {
    if (!confirm(`Remover ${m.nome_comercial}?`)) return;
    const { error } = await supabase.from("syncvet_medicamentos").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Medicamentos</h1>
          <p className="text-sm text-muted-foreground">Biblioteca da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar medicamento" : "Novo medicamento"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome comercial*</Label><Input value={nomeComercial} onChange={(e) => setNomeComercial(e.target.value)} /></div>
              <div><Label className="text-xs">Princípio ativo</Label><Input value={principio} onChange={(e) => setPrincipio(e.target.value)} /></div>
              <div><Label className="text-xs">Laboratório</Label><Input value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)} /></div>
              <div><Label className="text-xs">Dosagem padrão</Label><Input value={dosagem} onChange={(e) => setDosagem(e.target.value)} placeholder="Ex: 1 mL / 50 kg" /></div>
              <div><Label className="text-xs">Via de aplicação</Label><Input value={via} onChange={(e) => setVia(e.target.value)} placeholder="Ex: IM, SC, VO" /></div>
              <div><Label className="text-xs">Observações</Label><Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
              <div>
                <Label className="text-xs">Foto</Label>
                <Input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)} />
                {fotoPath && !fotoFile && <p className="text-xs text-muted-foreground mt-1">Foto atual mantida.</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum medicamento cadastrado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Card key={m.id} className="p-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {signed[m.id] ? (
                  <img src={signed[m.id]} alt={m.nome_comercial} className="w-full h-full object-cover" />
                ) : (
                  <Pill className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.nome_comercial}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[m.principio_ativo, m.laboratorio].filter(Boolean).join(" • ") || "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[m.dosagem_padrao, m.via_aplicacao].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
