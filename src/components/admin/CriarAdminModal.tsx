import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CriarAdminModal({ open, onOpenChange, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getFunctionErrorMessage = async (invokeError: unknown) => {
    const fallback = invokeError instanceof Error ? invokeError.message : "Erro ao criar administrador";

    if (!invokeError || typeof invokeError !== "object" || !("context" in invokeError)) {
      return fallback;
    }

    const context = (invokeError as { context?: Response }).context;
    if (!context) {
      return fallback;
    }

    const contentType = context.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = await context.clone().json().catch(() => null);
      if (payload?.error || payload?.message) {
        return payload.error || payload.message;
      }
    }

    const text = await context.clone().text().catch(() => "");
    return text || fallback;
  };

  const resetForm = () => {
    setNome("");
    setEmail("");
    setTelefone("");
    setSenha("");
    setConfirmarSenha("");
    setShowConfirm(false);
  };

  const validate = () => {
    if (!nome.trim() || !email.trim() || !senha) {
      toast.error("Preencha todos os campos obrigatórios");
      return false;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return false;
    }
    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Check duplicate email
      const { data: existing } = await supabase
        .from("administradores")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        toast.error("Já existe um administrador com este e-mail");
        setShowConfirm(false);
        setLoading(false);
        return;
      }

      // Create admin via edge function (handles auth + DB insert + rollback)
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: {
          email: email.trim().toLowerCase(),
          password: senha,
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          role: "administrador",
        },
      });

      if (invokeError) {
        toast.error(await getFunctionErrorMessage(invokeError));
        setShowConfirm(false);
        setLoading(false);
        return;
      }

      if (result?.error || result?.success === false) {
        toast.error(result?.error || result?.message || "Erro ao criar administrador");
        setShowConfirm(false);
        setLoading(false);
        return;
      }

      toast.success("Administrador criado com sucesso!");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); resetForm(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{showConfirm ? "Confirmar Criação" : "Criar Administrador"}</DialogTitle>
          <DialogDescription>
            {showConfirm
              ? "Revise os dados antes de confirmar."
              : "Preencha os dados do novo administrador."}
          </DialogDescription>
        </DialogHeader>

        {showConfirm ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50 border border-accent">
              <AlertTriangle className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                Tem certeza que deseja criar um novo administrador com <strong>acesso total</strong> ao sistema?
              </p>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Nome:</strong> {nome}</p>
              <p><strong>E-mail:</strong> {email}</p>
              {telefone && <p><strong>Telefone:</strong> {telefone}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={loading} className="bg-primary text-primary-foreground">
                {loading ? "Criando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-nome">Nome completo *</Label>
              <Input id="admin-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do administrador" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail *</Label>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-telefone">Telefone (WhatsApp)</Label>
              <Input id="admin-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-senha">Senha *</Label>
              <Input id="admin-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirmar">Confirmar senha *</Label>
              <Input id="admin-confirmar" type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" />
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground">Criar Administrador</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
