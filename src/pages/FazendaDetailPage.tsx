import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Landmark, Map, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import ExportarRelatorioModal from "@/components/relatorio/ExportarRelatorioModal";

type Fazenda = Tables<"fazendas">;
type Retiro = Tables<"retiros">;

interface RetiroForm {
  nome: string;
  capataz: string;
  ativo: boolean;
}

const emptyRetiroForm: RetiroForm = { nome: "", capataz: "", ativo: true };

interface FazendaEditForm {
  intervalo_padrao_dias: number;
}

export default function FazendaDetailPage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RetiroForm>(emptyRetiroForm);
  const [saving, setSaving] = useState(false);
  const [fazendaEdit, setFazendaEdit] = useState<FazendaEditForm>({ intervalo_padrao_dias: 3 });
  const [savingFazenda, setSavingFazenda] = useState(false);

  async function loadData() {
    if (!fazendaId) return;
    const [fazRes, retRes] = await Promise.all([
      supabase.from("fazendas").select("*").eq("id", fazendaId).single(),
      supabase.from("retiros").select("*").eq("fazenda_id", fazendaId).order("nome"),
    ]);
    if (fazRes.error) { toast.error("Fazenda não encontrada."); navigate("/admin/fazendas"); return; }
    setFazenda(fazRes.data);
    setFazendaEdit({ intervalo_padrao_dias: (fazRes.data as any).intervalo_padrao_dias ?? 3 });
    setRetiros(retRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [fazendaId]);

  function openNew() {
    setEditingId(null);
    setForm(emptyRetiroForm);
    setDialogOpen(true);
  }

  function openEdit(r: Retiro) {
    setEditingId(r.id);
    setForm({ nome: r.nome, capataz: r.capataz, ativo: r.ativo ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("O nome é obrigatório."); return; }
    if (!form.capataz.trim()) { toast.error("O nome do capataz é obrigatório."); return; }
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("retiros").update({
        nome: form.nome.trim(), capataz: form.capataz.trim(), ativo: form.ativo,
      }).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar retiro."); setSaving(false); return; }
      toast.success("Retiro atualizado!");
    } else {
      const { error } = await supabase.from("retiros").insert({
        nome: form.nome.trim(), capataz: form.capataz.trim(), ativo: form.ativo, fazenda_id: fazendaId!,
      });
      if (error) { toast.error("Erro ao criar retiro."); setSaving(false); return; }
      toast.success("Retiro criado!");
    }
    setSaving(false);
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este retiro?")) return;
    const { error } = await supabase.from("retiros").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir retiro."); return; }
    toast.success("Retiro excluído.");
    loadData();
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fazenda) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/admin/fazendas">Fazendas</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{fazenda.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate("/admin/fazendas")}>
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5" /> {fazenda.nome}
            </CardTitle>
            <Badge variant={fazenda.ativo ? "default" : "secondary"}>
              {fazenda.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Cidade:</span> {fazenda.cidade}</div>
            <div><span className="text-muted-foreground">Estado:</span> {fazenda.estado}</div>
          </div>
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="intervalo" className="text-sm font-medium">Intervalo padrão entre salgas (dias)</Label>
                <p className="text-xs text-muted-foreground">Define o intervalo ideal de salga para todos os retiros</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="intervalo"
                  type="number"
                  min={1}
                  max={30}
                  value={fazendaEdit.intervalo_padrao_dias}
                  onChange={(e) => setFazendaEdit({ intervalo_padrao_dias: parseInt(e.target.value) || 3 })}
                  className="w-20 text-center"
                />
                <Button
                  size="sm"
                  disabled={savingFazenda}
                  onClick={async () => {
                    setSavingFazenda(true);
                    const { error } = await supabase.from("fazendas").update({
                      intervalo_padrao_dias: fazendaEdit.intervalo_padrao_dias,
                    } as any).eq("id", fazendaId!);
                    setSavingFazenda(false);
                    if (error) { toast.error("Erro ao salvar"); return; }
                    toast.success("Intervalo atualizado!");
                  }}
                >
                  {savingFazenda ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Retiros desta Fazenda</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setRelatorioOpen(true)} size="sm" variant="outline" className="gap-1.5">
            <FileDown className="w-4 h-4" /> Relatório PDF
          </Button>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo Retiro
          </Button>
        </div>
      </div>

      <ExportarRelatorioModal
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        fazendaId={fazendaId!}
        fazendaNome={fazenda.nome}
        geradoPor={user?.user_metadata?.nome || user?.email || "Administrador"}
      />

      {retiros.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Map className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum retiro cadastrado nesta fazenda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Capataz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retiros.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/admin/fazendas/${fazendaId}/retiros/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.nome}
                      </Link>
                    </TableCell>
                    <TableCell>{r.capataz}</TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? "default" : "secondary"}>
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Retiro" : "Novo Retiro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Retiro Norte" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capataz">Capataz *</Label>
              <Input id="capataz" value={form.capataz} onChange={(e) => setForm({ ...form, capataz: e.target.value })} placeholder="Nome do capataz" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch id="ativo" checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
