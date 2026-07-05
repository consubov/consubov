import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Factory, QrCode, MapPin, Download } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface Fabrica {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  qr_code: string | null;
  ativo: boolean | null;
}

interface Fazenda { id: string; nome: string; }
interface Retiro { id: string; nome: string; fazenda_id: string; }

const emptyForm = { nome: "", descricao: "", ativo: true };

export default function FabricasPage() {
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [destinosOpen, setDestinosOpen] = useState(false);
  const [destinosFabrica, setDestinosFabrica] = useState<Fabrica | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [selectedFazendas, setSelectedFazendas] = useState<Set<string>>(new Set());
  const [selectedRetiros, setSelectedRetiros] = useState<Set<string>>(new Set());

  const [qrOpen, setQrOpen] = useState(false);
  const [qrFabrica, setQrFabrica] = useState<Fabrica | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("fabricas").select("*").order("codigo");
    setFabricas((data as Fabrica[]) || []);
    setLoading(false);
  }

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(f: Fabrica) {
    setEditingId(f.id);
    setForm({ nome: f.nome, descricao: f.descricao || "", ativo: f.ativo ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("fabricas").update({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Fábrica atualizada!");
      } else {
        const { data, error } = await supabase.from("fabricas").insert({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          ativo: form.ativo,
        }).select().single();
        if (error) throw error;
        // Ensure qr_code is set to id (trigger already does this on insert)
        if (data && !data.qr_code) {
          await supabase.from("fabricas").update({ qr_code: data.id }).eq("id", data.id);
        }
        toast.success(`Fábrica criada: ${data?.codigo || ""}`);
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta fábrica?")) return;
    const { error } = await supabase.from("fabricas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Fábrica excluída"); load(); }
  }

  async function openDestinos(f: Fabrica) {
    setDestinosFabrica(f);
    setDestinosOpen(true);
    const [fz, rt, dest] = await Promise.all([
      supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("retiros").select("id, nome, fazenda_id").eq("ativo", true).order("nome"),
      supabase.from("fabrica_destinos").select("fazenda_id, retiro_id").eq("fabrica_id", f.id),
    ]);
    setFazendas((fz.data as Fazenda[]) || []);
    setRetiros((rt.data as Retiro[]) || []);
    const sf = new Set<string>();
    const sr = new Set<string>();
    (dest.data || []).forEach((d: any) => {
      if (d.fazenda_id) sf.add(d.fazenda_id);
      if (d.retiro_id) sr.add(d.retiro_id);
    });
    setSelectedFazendas(sf);
    setSelectedRetiros(sr);
  }

  async function saveDestinos() {
    if (!destinosFabrica) return;
    setSaving(true);
    try {
      const { error: delError } = await supabase.from("fabrica_destinos").delete().eq("fabrica_id", destinosFabrica.id);
      if (delError) throw delError;
      const rows: any[] = [];
      selectedFazendas.forEach((fid) => rows.push({ fabrica_id: destinosFabrica.id, fazenda_id: fid }));
      selectedRetiros.forEach((rid) => rows.push({ fabrica_id: destinosFabrica.id, retiro_id: rid }));
      if (rows.length > 0) {
        const { error } = await supabase.from("fabrica_destinos").insert(rows);
        if (error) throw error;
      }
      toast.success("Destinos salvos!");
      setDestinosOpen(false);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally { setSaving(false); }
  }

  function toggleSet(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const ns = new Set(set);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setter(ns);
  }

  function downloadQr() {
    if (!qrFabrica) return;
    const svg = document.getElementById(`qr-fab-${qrFabrica.id}`);
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${qrFabrica.codigo || "fabrica"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Factory className="w-5 h-5" /> Fábricas
        </h1>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Fábrica
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-56">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fabricas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma fábrica cadastrada</TableCell></TableRow>
              ) : fabricas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{f.descricao || "—"}</TableCell>
                  <TableCell><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="QR Code" onClick={() => { setQrFabrica(f); setQrOpen(true); }}><QrCode className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" title="Destinos" onClick={() => openDestinos(f)}><MapPin className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fábrica" : "Nova Fábrica"}</DialogTitle>
            <DialogDescription>O código e QR Code são gerados automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={destinosOpen} onOpenChange={setDestinosOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Destinos autorizados</DialogTitle>
            <DialogDescription>Selecione fazendas e/ou retiros que serão alimentados por <b>{destinosFabrica?.nome}</b>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Fazendas</Label>
              <div className="mt-2 space-y-2 border rounded p-3 max-h-48 overflow-y-auto">
                {fazendas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma fazenda ativa.</p> : fazendas.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedFazendas.has(f.id)} onCheckedChange={() => toggleSet(selectedFazendas, f.id, setSelectedFazendas)} />
                    {f.nome}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Retiros</Label>
              <div className="mt-2 space-y-2 border rounded p-3 max-h-56 overflow-y-auto">
                {retiros.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum retiro ativo.</p> : retiros.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedRetiros.has(r.id)} onCheckedChange={() => toggleSet(selectedRetiros, r.id, setSelectedRetiros)} />
                    {r.nome}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDestinosOpen(false)}>Cancelar</Button>
            <Button onClick={saveDestinos} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — {qrFabrica?.nome}</DialogTitle>
            <DialogDescription>Código: <span className="font-mono">{qrFabrica?.codigo}</span></DialogDescription>
          </DialogHeader>
          {qrFabrica && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="bg-white p-4 rounded border">
                <QRCodeSVG id={`qr-fab-${qrFabrica.id}`} value={qrFabrica.qr_code || qrFabrica.id} size={220} level="H" />
              </div>
              <Button onClick={downloadQr} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" /> Baixar SVG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
