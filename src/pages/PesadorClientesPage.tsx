import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Scale, Search, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { z } from "zod";

type Cliente = {
  id: string;
  pesador_id: string;
  nome: string;
  nome_fazenda: string | null;
  cidade: string | null;
  telefone: string | null;
  created_at: string | null;
};

const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  nome_fazenda: z.string().trim().max(120).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
});

export default function PesadorClientesPage() {
  const { roleData } = useAuth();
  const pesadorId = roleData.roleId;
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    nome_fazenda: "",
    cidade: "",
    telefone: "",
  });

  async function loadClientes() {
    if (!pesadorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes_pesador")
      .select("*")
      .eq("pesador_id", pesadorId)
      .order("nome", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    } else {
      setClientes((data ?? []) as Cliente[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesadorId]);

  function openNew() {
    setEditing(null);
    setForm({ nome: "", nome_fazenda: "", cidade: "", telefone: "" });
    setModalOpen(true);
  }

  function openEdit(c: Cliente) {
    setEditing(c);
    setForm({
      nome: c.nome ?? "",
      nome_fazenda: c.nome_fazenda ?? "",
      cidade: c.cidade ?? "",
      telefone: c.telefone ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!pesadorId) {
      toast({ title: "Perfil de pesador não encontrado", variant: "destructive" });
      return;
    }
    const parsed = clienteSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Dados inválidos",
        description: parsed.error.issues[0]?.message ?? "Verifique os campos.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      pesador_id: pesadorId,
      nome: parsed.data.nome,
      nome_fazenda: parsed.data.nome_fazenda?.trim() || null,
      cidade: parsed.data.cidade?.trim() || null,
      telefone: parsed.data.telefone?.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("clientes_pesador")
        .update(payload)
        .eq("id", editing.id)
        .eq("pesador_id", pesadorId));
    } else {
      ({ error } = await supabase.from("clientes_pesador").insert(payload));
    }
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Cliente atualizado" : "Cliente criado" });
    setModalOpen(false);
    void loadClientes();
  }

  async function handleDelete() {
    if (!toDelete || !pesadorId) return;
    setDeleting(true);
    const { count, error: cErr } = await supabase
      .from("pesagens_compra")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", toDelete.id);
    if (cErr) {
      setDeleting(false);
      toast({ title: "Erro ao verificar pesagens", description: cErr.message, variant: "destructive" });
      return;
    }
    if ((count ?? 0) > 0) {
      setDeleting(false);
      setToDelete(null);
      toast({
        title: "Não é possível apagar",
        description: "Cliente tem pesagens registradas, não pode ser apagado.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("clientes_pesador")
      .delete()
      .eq("id", toDelete.id)
      .eq("pesador_id", pesadorId);
    setDeleting(false);
    if (error) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cliente apagado" });
    setToDelete(null);
    void loadClientes();
  }

  const term = search.trim().toLowerCase();
  const filtered = term
    ? clientes.filter((c) => c.nome.toLowerCase().includes(term))
    : clientes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"} cadastrado{clientes.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={openNew} className="gap-1">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome do produtor..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {clientes.length === 0
              ? "Nenhum cliente cadastrado ainda."
              : "Nenhum cliente encontrado para a busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">{c.nome}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[c.nome_fazenda, c.cidade].filter(Boolean).join(" • ") || "—"}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(c)}
                  className="h-8 w-8 p-0"
                  aria-label="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setToDelete(c)}
                  className="h-8 w-8 p-0 text-destructive"
                  aria-label="Apagar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/pesador/pesagem/novo?cliente_id=${c.id}`)}
                  className="gap-1"
                >
                  <Scale className="w-4 h-4" />
                  <span className="hidden sm:inline">Iniciar Pesagem</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome do produtor *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nome_fazenda">Nome da fazenda</Label>
              <Input
                id="nome_fazenda"
                value={form.nome_fazenda}
                onChange={(e) => setForm((f) => ({ ...f, nome_fazenda: e.target.value }))}
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                maxLength={30}
                inputMode="tel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {toDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
