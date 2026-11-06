import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PARTIAL_PROFILE_MESSAGE, ProfileProvisioningError, provisionProfileUser } from "@/lib/profileProvisioning";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CriarEscritorioModal({ open, onClose }: Props) {
  const uiText = useStaticUiText();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [fazendaId, setFazendaId] = useState("");
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("fazendas").select("id, nome").eq("ativo", true).then(({ data }) => {
        setFazendas(data ?? []);
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!nome.trim() || !email.trim() || !fazendaId) {
      toast.error(uiText("Preencha nome, email e selecione a fazenda."));
      return;
    }

    if (senha.length < 12 || senha !== confirmarSenha) {
      toast.error(uiText("Defina uma senha de pelo menos 12 caracteres e confirme-a."));
      return;
    }
    let accountCreated = false;
    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Identity is provisioned first; never reuse a shared default password.
      const userId = await provisionProfileUser({
        email: normalizedEmail,
        senha,
        role: "usuario",
      });
      accountCreated = true;

      // 2. Insert into escritorios table
      const { error: dbError } = await supabase.from("escritorios").insert({
        nome: nome.trim(),
        email: normalizedEmail,
        telefone: telefone.trim() || null,
        fazenda_id: fazendaId,
        user_id: userId,
        ativo: true,
      });

      if (dbError) throw dbError;

      toast.success(uiText("Escritório criado com sucesso!"));
      setNome(""); setEmail(""); setTelefone(""); setFazendaId("");
      setSenha(""); setConfirmarSenha("");
      onClose();
    } catch (err: unknown) {
      toast.error(accountCreated
        ? PARTIAL_PROFILE_MESSAGE
        : err instanceof ProfileProvisioningError ? err.message : "Não foi possível criar escritório.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><LocalizedText source={"Criar Escritório"} /></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label><LocalizedText source={"Nome *"} /></Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={uiText("Nome do escritório")} />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label><LocalizedText source={"Telefone"} /></Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label htmlFor="escritorio-senha">Senha de acesso *</Label>
            <PasswordInput id="escritorio-senha" autoComplete="new-password"
              value={senha} onChange={e => setSenha(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="escritorio-confirmar-senha">Confirmar senha *</Label>
            <PasswordInput id="escritorio-confirmar-senha" autoComplete="new-password"
              value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Mínimo de 12 caracteres, exclusivos deste perfil.</p>
          </div>
          <div>
            <Label><LocalizedText source={"Fazenda *"} /></Label>
            <Select value={fazendaId} onValueChange={setFazendaId}>
              <SelectTrigger>
                <SelectValue placeholder={uiText("Selecione a fazenda")} />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Criando..." : "Criar Escritório"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
