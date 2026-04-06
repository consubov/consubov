import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Admin {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean | null;
  criado_em: string | null;
  user_id: string | null;
}

interface Props {
  refreshKey: number;
}

export default function AdminListSection({ refreshKey }: Props) {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteAdmin, setDeleteAdmin] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAdmins = async () => {
    const { data } = await supabase
      .from("administradores")
      .select("id, nome, email, telefone, ativo, criado_em, user_id")
      .order("criado_em", { ascending: false });
    setAdmins(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, [refreshKey]);

  const handleToggleAtivo = async (admin: Admin) => {
    const newAtivo = !admin.ativo;
    const { error } = await supabase
      .from("administradores")
      .update({ ativo: newAtivo })
      .eq("id", admin.id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success(newAtivo ? "Administrador reativado" : "Administrador desativado");
      loadAdmins();
    }
  };

  const handleEdit = (admin: Admin) => {
    setEditAdmin(admin);
    setEditNome(admin.nome);
    setEditEmail(admin.email);
    setEditTelefone(admin.telefone ?? "");
    setEditSenha("");
  };

  const getErrorMessage = async (invokeError: unknown) => {
    const fallback =
      invokeError instanceof Error ? invokeError.message : "Erro na operação";
    if (!invokeError || typeof invokeError !== "object" || !("context" in invokeError))
      return fallback;
    const context = (invokeError as { context?: Response }).context;
    if (!context) return fallback;
    const ct = context.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const p = await context.clone().json().catch(() => null);
      if (p?.error || p?.message) return p.error || p.message;
    }
    return (await context.clone().text().catch(() => "")) || fallback;
  };

  const handleSaveEdit = async () => {
    if (!editAdmin) return;
    if (!editNome.trim() || !editEmail.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    if (editSenha && editSenha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "manage-admin",
        {
          body: {
            action: "update",
            admin_id: editAdmin.id,
            nome: editNome.trim(),
            email: editEmail.trim().toLowerCase(),
            telefone: editTelefone.trim() || null,
            nova_senha: editSenha || undefined,
          },
        }
      );

      if (invokeError) {
        toast.error(await getErrorMessage(invokeError));
        return;
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Administrador atualizado com sucesso");
      setEditAdmin(null);
      loadAdmins();
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAdmin) return;
    setDeleting(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "manage-admin",
        {
          body: {
            action: "delete",
            admin_id: deleteAdmin.id,
            requesting_user_id: user?.id ?? "",
          },
        }
      );

      if (invokeError) {
        toast.error(await getErrorMessage(invokeError));
        return;
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Administrador excluído com sucesso");
      setDeleteAdmin(null);
      loadAdmins();
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const isSelf = (admin: Admin) => admin.user_id === user?.id;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 h-32" />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Administradores</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              Nenhum administrador encontrado.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {a.nome}
                      {isSelf(a) && (
                        <span className="text-xs text-muted-foreground ml-1">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    {a.telefone && (
                      <p className="text-xs text-muted-foreground">{a.telefone}</p>
                    )}
                    {a.criado_em && (
                      <p className="text-xs text-muted-foreground">
                        Criado em {format(new Date(a.criado_em), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant={a.ativo ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {a.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(a)}
                      className="h-8 w-8"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleAtivo(a)}
                      className="h-8 w-8"
                      title={a.ativo ? "Desativar" : "Reativar"}
                    >
                      {a.ativo ? (
                        <UserX className="w-4 h-4 text-destructive" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-primary" />
                      )}
                    </Button>
                    {!isSelf(a) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteAdmin(a)}
                        className="h-8 w-8"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog
        open={!!editAdmin}
        onOpenChange={(v) => {
          if (!v) setEditAdmin(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Administrador</DialogTitle>
            <DialogDescription>
              Atualize os dados do administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nova senha (opcional)</Label>
              <Input
                type="password"
                value={editSenha}
                onChange={(e) => setEditSenha(e.target.value)}
                placeholder="Deixe vazio para manter a atual"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteAdmin}
        onOpenChange={(v) => {
          if (!v) setDeleteAdmin(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Administrador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteAdmin?.nome}</strong>?
              Essa ação não pode ser desfeita. O acesso ao sistema será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
