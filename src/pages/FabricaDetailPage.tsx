import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Factory, QrCode, MapPin, Pencil, Trash2, Plus, Loader2,
  Users, Package2, PackagePlus, Download, FileDown, Save, Camera, X, AlertTriangle,
  FlaskConical, Play, Truck,
} from "lucide-react";
import FormulasTab from "@/components/fabrica/FormulasTab";
import TransferenciasTab from "@/components/fabrica/TransferenciasTab";
import ProducaoTab from "@/components/fabrica/ProducaoTab";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { compressImageDataUrl } from "@/lib/imageCompression";

interface Fabrica {
  id: string; codigo: string | null; nome: string;
  descricao: string | null; qr_code: string | null; ativo: boolean | null;
}
interface Fazenda { id: string; nome: string; }
interface Retiro { id: string; nome: string; fazenda_id: string; }
interface Operador {
  id: string; nome: string; email: string | null; telefone: string | null;
  fabrica_id: string; user_id: string | null; ativo: boolean | null;
}
interface MateriaPrima {
  id: string; nome: string; unidade: string; peso_por_saco: number | null;
  estoque_atual: number | null; estoque_minimo: number | null; ativo: boolean | null;
}
interface Entrada {
  id: string; quantidade: number; data_entrada: string; observacao: string | null;
  materia_prima_id: string; fabrica_id: string;
}

const UNIDADES = ["kg", "saco", "litro", "unidade", "tonelada"];

export default function FabricaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fabrica, setFabrica] = useState<Fabrica | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) loadFabrica(); }, [id]);

  async function loadFabrica() {
    setLoading(true);
    const { data } = await supabase.from("fabricas").select("*").eq("id", id!).maybeSingle();
    setFabrica(data as Fabrica | null);
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!fabrica) return (
    <div className="max-w-5xl mx-auto p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/fabricas")}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
      <Card className="mt-4"><CardContent className="p-6 text-center text-muted-foreground">Fábrica não encontrada.</CardContent></Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/fabricas")}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Factory className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{fabrica.nome}</h1>
          <p className="text-xs font-mono text-muted-foreground">{fabrica.codigo}</p>
        </div>
        <Badge className="ml-2" variant={fabrica.ativo ? "default" : "secondary"}>{fabrica.ativo ? "Ativo" : "Inativo"}</Badge>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="info"><Factory className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Info</span></TabsTrigger>
          <TabsTrigger value="operadores"><Users className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Operadores</span></TabsTrigger>
          <TabsTrigger value="materias"><Package2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Matérias</span></TabsTrigger>
          <TabsTrigger value="entradas"><PackagePlus className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Entradas</span></TabsTrigger>
          <TabsTrigger value="formulas"><FlaskConical className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Fórmulas</span></TabsTrigger>
          <TabsTrigger value="producao"><Play className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Produção</span></TabsTrigger>
          <TabsTrigger value="transferencias"><Truck className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Transf.</span></TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <InfoTab fabrica={fabrica} onSaved={loadFabrica} />
        </TabsContent>
        <TabsContent value="operadores" className="mt-4">
          <OperadoresTab fabricaId={fabrica.id} />
        </TabsContent>
        <TabsContent value="materias" className="mt-4">
          <MateriasTab fabricaId={fabrica.id} />
        </TabsContent>
        <TabsContent value="entradas" className="mt-4">
          <EntradasTab fabricaId={fabrica.id} />
        </TabsContent>
        <TabsContent value="formulas" className="mt-4">
          <FormulasTab fabricaId={fabrica.id} />
        </TabsContent>
        <TabsContent value="producao" className="mt-4">
          <ProducaoTab fabricaId={fabrica.id} />
        </TabsContent>
        <TabsContent value="transferencias" className="mt-4">
          <TransferenciasTab fabricaId={fabrica.id} />
        </TabsContent>
      </Tabs>
    </div>


  );
}

/* -------------------- INFO TAB -------------------- */

function InfoTab({ fabrica, onSaved }: { fabrica: Fabrica; onSaved: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [form, setForm] = useState({ nome: fabrica.nome, descricao: fabrica.descricao || "", ativo: fabrica.ativo ?? true });
  const [saving, setSaving] = useState(false);

  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [selFaz, setSelFaz] = useState<Set<string>>(new Set());
  const [selRet, setSelRet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setForm({ nome: fabrica.nome, descricao: fabrica.descricao || "", ativo: fabrica.ativo ?? true });
  }, [fabrica]);

  async function openDestinos() {
    setDestOpen(true);
    const [fz, rt, dest] = await Promise.all([
      supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("retiros").select("id, nome, fazenda_id").eq("ativo", true).order("nome"),
      supabase.from("fabrica_destinos").select("fazenda_id, retiro_id").eq("fabrica_id", fabrica.id),
    ]);
    setFazendas((fz.data as Fazenda[]) || []);
    setRetiros((rt.data as Retiro[]) || []);
    const sf = new Set<string>(), sr = new Set<string>();
    (dest.data || []).forEach((d: any) => {
      if (d.fazenda_id) sf.add(d.fazenda_id);
      if (d.retiro_id) sr.add(d.retiro_id);
    });
    setSelFaz(sf); setSelRet(sr);
  }

  async function saveDestinos() {
    setSaving(true);
    try {
      await supabase.from("fabrica_destinos").delete().eq("fabrica_id", fabrica.id);
      const rows: any[] = [];
      selFaz.forEach(fid => rows.push({ fabrica_id: fabrica.id, fazenda_id: fid }));
      selRet.forEach(rid => rows.push({ fabrica_id: fabrica.id, retiro_id: rid }));
      if (rows.length > 0) {
        const { error } = await supabase.from("fabrica_destinos").insert(rows);
        if (error) throw error;
      }
      toast.success("Destinos salvos!");
      setDestOpen(false);
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setSaving(false); }
  }

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const ns = new Set(set);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setter(ns);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("fabricas").update({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      }).eq("id", fabrica.id);
      if (error) throw error;
      toast.success("Atualizada!");
      setEditOpen(false);
      onSaved();
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Excluir esta fábrica?")) return;
    const { error } = await supabase.from("fabricas").delete().eq("id", fabrica.id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Excluída"); window.location.href = "/admin/fabricas"; }
  }

  function downloadQrSvg() {
    const svg = document.getElementById(`qr-fab-${fabrica.id}`);
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fabrica.codigo || "fabrica"}.svg`; a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadQrPdf() {
    try {
      const dataUrl = await QRCode.toDataURL(fabrica.qr_code || fabrica.id, {
        width: 800, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000", light: "#FFF" },
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(20);
      pdf.text(`Fábrica — ${fabrica.nome}`, pageW / 2, 30, { align: "center" });
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(14);
      pdf.text(`Código: ${fabrica.codigo || ""}`, pageW / 2, 42, { align: "center" });
      const size = 130;
      pdf.addImage(dataUrl, "PNG", (pageW - size) / 2, 60, size, size);
      pdf.save(`${fabrica.codigo || "fabrica"}.pdf`);
    } catch { toast.error("Erro ao gerar PDF"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Informações da Fábrica</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Código:</span> <span className="font-mono">{fabrica.codigo || "—"}</span></div>
          <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{fabrica.nome}</span></div>
          <div><span className="text-muted-foreground">Descrição:</span> {fabrica.descricao || "—"}</div>
          <div className="pt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}><QrCode className="w-4 h-4 mr-1.5" /> QR Code</Button>
            <Button size="sm" variant="outline" onClick={openDestinos}><MapPin className="w-4 h-4 mr-1.5" /> Destinos autorizados</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Fábrica</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — {fabrica.nome}</DialogTitle>
            <DialogDescription>Código: <span className="font-mono">{fabrica.codigo}</span></DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="bg-white p-4 rounded border">
              <QRCodeSVG id={`qr-fab-${fabrica.id}`} value={fabrica.qr_code || fabrica.id} size={220} level="H" />
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadQrSvg} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> SVG</Button>
              <Button onClick={downloadQrPdf} size="sm" className="bg-primary hover:bg-primary/90"><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={destOpen} onOpenChange={setDestOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Destinos autorizados</DialogTitle>
            <DialogDescription>Fazendas e/ou retiros alimentados por <b>{fabrica.nome}</b>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Fazendas</Label>
              <div className="mt-2 space-y-2 border rounded p-3 max-h-48 overflow-y-auto">
                {fazendas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma fazenda ativa.</p> : fazendas.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selFaz.has(f.id)} onCheckedChange={() => toggle(selFaz, f.id, setSelFaz)} />
                    {f.nome}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Retiros</Label>
              <div className="mt-2 space-y-2 border rounded p-3 max-h-56 overflow-y-auto">
                {retiros.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum retiro ativo.</p> : retiros.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selRet.has(r.id)} onCheckedChange={() => toggle(selRet, r.id, setSelRet)} />
                    {r.nome}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDestOpen(false)}>Cancelar</Button>
            <Button onClick={saveDestinos} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- OPERADORES TAB -------------------- */

function OperadoresTab({ fabricaId }: { fabricaId: string }) {
  const [items, setItems] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("operadores_fabrica").select("*").eq("fabrica_id", fabricaId).order("nome");
    setItems((data as Operador[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({ nome: "", email: "", telefone: "", senha: "", ativo: true });
    setDialogOpen(true);
  }
  function openEdit(o: Operador) {
    setEditingId(o.id);
    setForm({ nome: o.nome, email: o.email || "", telefone: o.telefone || "", senha: "", ativo: o.ativo ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!editingId) {
      if (!form.email.trim()) return toast.error("Email é obrigatório");
      if (form.senha.length < 6) return toast.error("Senha mínima 6 caracteres");
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("operadores_fabrica").update({
          nome: form.nome.trim(), telefone: form.telefone.trim() || null, ativo: form.ativo,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Atualizado!");
      } else {
        const res = await supabase.functions.invoke("create-user", {
          body: { email: form.email.trim(), password: form.senha, role: "usuario" },
        });
        if (res.error) throw new Error(res.error.message || "Falha ao criar usuário");
        const respData: any = res.data;
        if (respData?.error) throw new Error(respData.error);
        const userId = respData?.user?.id;
        if (!userId) throw new Error("ID do usuário não retornado");
        const { error } = await supabase.from("operadores_fabrica").insert({
          nome: form.nome.trim(), email: form.email.trim(),
          telefone: form.telefone.trim() || null,
          fabrica_id: fabricaId, user_id: userId, ativo: form.ativo,
        });
        if (error) throw error;
        toast.success("Operador criado!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) { toast.error("Erro: " + (err?.message || "desconhecido")); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este operador?")) return;
    const { error } = await supabase.from("operadores_fabrica").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Excluído"); load(); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Operadores</CardTitle>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum operador vinculado.</TableCell></TableRow>
                ) : items.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell>{o.email || "—"}</TableCell>
                    <TableCell>{o.telefone || "—"}</TableCell>
                    <TableCell><Badge variant={o.ativo ? "default" : "secondary"}>{o.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Operador" : "Novo Operador"}</DialogTitle>
            <DialogDescription>Vinculado automaticamente a esta fábrica.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Email {editingId ? "" : "*"}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingId} /></div>
            {!editingId && (
              <div><Label>Senha *</Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
            )}
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- MATÉRIAS-PRIMAS TAB -------------------- */

function MateriasTab({ fabricaId }: { fabricaId: string }) {
  const [items, setItems] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", unidade: "kg", peso_por_saco: "", estoque_minimo: "", ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("materias_primas").select("*").eq("fabrica_id", fabricaId).order("nome");
    setItems((data as MateriaPrima[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({ nome: "", unidade: "kg", peso_por_saco: "", estoque_minimo: "", ativo: true });
    setDialogOpen(true);
  }
  function openEdit(m: MateriaPrima) {
    setEditingId(m.id);
    setForm({
      nome: m.nome, unidade: m.unidade,
      peso_por_saco: m.peso_por_saco?.toString() ?? "",
      estoque_minimo: m.estoque_minimo?.toString() ?? "",
      ativo: m.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
      const payload: any = {
        nome: form.nome.trim(),
        unidade: form.unidade,
        peso_por_saco: num(form.peso_por_saco),
        estoque_minimo: num(form.estoque_minimo),
        ativo: form.ativo,
        fabrica_id: fabricaId,
      };
      if (editingId) {
        const { error } = await supabase.from("materias_primas").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Atualizada!");
      } else {
        const { error } = await supabase.from("materias_primas").insert(payload);
        if (error) throw error;
        toast.success("Criada!");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) { toast.error("Erro: " + (err?.message || "desconhecido")); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta matéria-prima?")) return;
    const { error } = await supabase.from("materias_primas").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Excluída"); load(); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Package2 className="w-4 h-4" /> Matérias-Primas</CardTitle>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Unidade</TableHead><TableHead>Peso/saco</TableHead>
                  <TableHead>Estoque</TableHead><TableHead>Mín.</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma matéria-prima cadastrada.</TableCell></TableRow>
                ) : items.map(m => {
                  const baixo = (m.estoque_minimo ?? 0) > 0 && (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>{m.unidade}</TableCell>
                      <TableCell>{m.peso_por_saco ? `${m.peso_por_saco} kg` : "—"}</TableCell>
                      <TableCell>
                        <span className={baixo ? "text-destructive font-semibold inline-flex items-center gap-1" : ""}>
                          {baixo && <AlertTriangle className="w-3.5 h-3.5" />}
                          {m.estoque_atual ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>{m.estoque_minimo ?? "—"}</TableCell>
                      <TableCell><Badge variant={m.ativo ? "default" : "secondary"}>{m.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}</DialogTitle>
            <DialogDescription>Vinculada automaticamente a esta fábrica. Estoque atualiza pelas entradas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div>
              <Label>Unidade *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {UNIDADES.map(u => (
                  <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unidade: u }))}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${form.unidade === u ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Peso por saco (kg)</Label><Input type="number" step="0.01" value={form.peso_por_saco} onChange={e => setForm(f => ({ ...f, peso_por_saco: e.target.value }))} /></div>
            <div><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- ENTRADAS TAB -------------------- */

function EntradasTab({ fabricaId }: { fabricaId: string }) {
  const { user } = useAuth();
  const [materias, setMaterias] = useState<MateriaPrima[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [materiaId, setMateriaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<string | null>(null);


  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const [mp, en] = await Promise.all([
      supabase.from("materias_primas").select("*").eq("fabrica_id", fabricaId).eq("ativo", true).order("nome"),
      supabase.from("entradas_materias_primas").select("*").eq("fabrica_id", fabricaId).order("data_entrada", { ascending: false }).limit(50),
    ]);
    setMaterias((mp.data as MateriaPrima[]) || []);
    setEntradas((en.data as Entrada[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setMateriaId(""); setQuantidade("");
    setDataEntrada(new Date().toISOString().slice(0, 10));
    setObservacao(""); setFoto(null);
    setDialogOpen(true);
  }

  function openEdit(e: Entrada) {
    setEditingId(e.id);
    setMateriaId(e.materia_prima_id);
    setQuantidade(String(e.quantidade));
    setDataEntrada(e.data_entrada);
    setObservacao(e.observacao || "");
    setFoto(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta entrada? O estoque será ajustado automaticamente.")) return;
    const { error } = await supabase.from("entradas_materias_primas").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Entrada removida. Estoque ajustado.");
    load();
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
      if (editingId) {
        const patch: any = {
          materia_prima_id: materiaId,
          quantidade: qtd,
          data_entrada: dataEntrada,
          observacao: observacao.trim() || null,
        };
        if (fotoUrl) patch.foto_url = fotoUrl;
        const { error } = await supabase.from("entradas_materias_primas").update(patch).eq("id", editingId);
        if (error) throw error;
        toast.success("Entrada atualizada! Estoque ajustado.");
      } else {
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
      }
      setDialogOpen(false);
      load();

    } catch (err: any) { toast.error("Erro: " + (err?.message || "desconhecido")); }
    finally { setSaving(false); }
  }

  const mpMap = Object.fromEntries(materias.map(m => [m.id, m.nome]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><PackagePlus className="w-4 h-4" /> Entradas</CardTitle>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" disabled={materias.length === 0}>
          <Plus className="w-4 h-4" /> Nova entrada
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : materias.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Cadastre uma matéria-prima antes de registrar entradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Matéria-Prima</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead><TableHead>Observação</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradas.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma entrada registrada.</TableCell></TableRow>
                ) : entradas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.data_entrada).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{mpMap[e.materia_prima_id] || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{e.quantidade}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.observacao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Editar quantidade">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)} title="Excluir entrada">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar entrada" : "Nova entrada"}</DialogTitle>
            <DialogDescription>{editingId ? "Alterar a quantidade ajusta o estoque automaticamente." : "Vinculada automaticamente a esta fábrica."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Matéria-Prima *</Label>

              <Select value={materiaId} onValueChange={setMateriaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.unidade})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantidade *</Label><Input type="number" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
              <div><Label>Data *</Label><Input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} /></div>
            </div>
            <div><Label>Observação</Label><Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} /></div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
