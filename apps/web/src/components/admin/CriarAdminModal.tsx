import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { ProfileProvisioningError, provisionProfileUser } from "@/lib/profileProvisioning";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CriarAdminModal({ open, onOpenChange, onCreated }: Props) {
  const uiText = useStaticUiText();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      toast.error(uiText("Preencha todos os campos obrigatórios"));
      return false;
    }
    if (senha.length < 12) {
      toast.error(uiText("A senha deve ter no mínimo 12 caracteres"));
      return false;
    }
    if (senha !== confirmarSenha) {
      toast.error(uiText("As senhas não coincidem"));
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
      const payload = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim(),
        senha,
      };

      // Check duplicate email
      const { data: existing } = await supabase
        .from("administradores")
        .select("id")
        .eq("email", payload.email)
        .maybeSingle();

      if (existing) {
        toast.error(uiText("Já existe um administrador com este e-mail"));
        setShowConfirm(false);
        setLoading(false);
        return;
      }

      // Admin identity and admin record are committed by the Edge Function.
      // No user/password payload is logged to the browser console.
      await provisionProfileUser({
        ...payload,
        senha,
        role: "administrador",
      });

      toast.success(uiText("Administrador criado com sucesso!"));
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof ProfileProvisioningError
        ? err.message : "Não foi possível criar o administrador.");
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
                <LocalizedText source={"Tem certeza que deseja criar um novo administrador com"} />{" "}<strong><LocalizedText source={"acesso total"} /></strong> <LocalizedText source={"ao sistema?"} /></p>
            </div>
            <div className="text-sm space-y-1">
              <p><strong><LocalizedText source={"Nome:"} /></strong> {nome}</p>
              <p><strong>E-mail:</strong> {email}</p>
              {telefone && <p><strong><LocalizedText source={"Telefone:"} /></strong> {telefone}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}><LocalizedText source={"Voltar"} /></Button>
              <Button onClick={handleConfirm} disabled={loading} className="bg-primary text-primary-foreground">
                {loading ? "Criando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-nome"><LocalizedText source={"Nome completo *"} /></Label>
              <Input id="admin-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={uiText("Nome do administrador")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail *</Label>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-telefone"><LocalizedText source={"Telefone (WhatsApp)"} /></Label>
              <Input id="admin-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-senha"><LocalizedText source={"Senha *"} /></Label>
              <PasswordInput id="admin-senha" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 12 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirmar"><LocalizedText source={"Confirmar senha *"} /></Label>
              <PasswordInput id="admin-confirmar" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder={uiText("Repita a senha")} />
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground"><LocalizedText source={"Criar Administrador"} /></Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
