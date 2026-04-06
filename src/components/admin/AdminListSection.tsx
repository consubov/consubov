import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Shield, Pencil, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Admin {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean | null;
  criado_em: string | null;
}

interface Props {
  refreshKey: number;
}

export default function AdminListSection({ refreshKey }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAdmins = async () => {
    const { data } = await supabase
      .from("administradores")
      .select("id, nome, email, telefone, ativo, criado_em")
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
    setEditTelefone(admin.telefone ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editAdmin) return;
    setSaving(true);
    const { error } = await supabase
      .from("administradores")
      .update({ nome: editNome.trim(), telefone: editTelefone.trim() || null })
      .eq("id", editAdmin.id);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Administrador atualizado");
      setEditAdmin(null);
      loadAdmins();
    }
    setSaving(false);
  };

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
            <p className="text-sm text-muted-foreground p-4">Nenhum administrador encontrado.</p>
          ) : (
            <div className="divide-y divide-border">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{a.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    {a.telefone && <p className="text-xs text-muted-foreground">{a.telefone}</p>}
                    {a.criado_em && (
                      <p className="text-xs text-muted-foreground">
                        Criado em {format(new Date(a.criado_em), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={a.ativo ? "default" : "secondary"} className="text-xs">
                      {a.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(a)} className="h-8 w-8">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleAtivo(a)}
                      className="h-8 w-8"
                    >
                      {a.ativo ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-primary" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editAdmin} onOpenChange={(v) => { if (!v) setEditAdmin(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Administrador</DialogTitle>
            <DialogDescription>Atualize os dados do administrador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
