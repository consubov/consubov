import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PARTIAL_PROFILE_MESSAGE, ProfileProvisioningError, provisionProfileUser } from "@/lib/profileProvisioning";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Stethoscope, CheckCircle2 } from "lucide-react";

export default function AdminSyncVetOnboardingPage() {
  const uiText = useStaticUiText();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Empresa
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailContato, setEmailContato] = useState("");

  // Veterinário responsável (login independente)
  const [nomeVet, setNomeVet] = useState("");
  const [emailVet, setEmailVet] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("syncvet_equipe")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (data) {
        toast.info(uiText("Você já possui empresa SyncVet"));
        navigate("/syncvet", { replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [user, navigate, uiText]);

  async function handleSubmit() {
    if (!user) return;

    if (!nomeEmpresa.trim()) { toast.error(uiText("Informe o nome da empresa")); return; }
    if (!nomeVet.trim()) { toast.error(uiText("Informe o nome do veterinário responsável")); return; }
    if (!emailVet.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVet.trim())) {
      toast.error(uiText("Informe um e-mail válido para o veterinário"));
      return;
    }
    if (senha.length < 12) { toast.error(uiText("A senha deve ter no mínimo 12 caracteres")); return; }
    if (senha !== confirmarSenha) { toast.error(uiText("As senhas não coincidem")); return; }

    setSaving(true);
    let accountCreated = false;
    try {
      // 1) Cria a conta de autenticação do veterinário via edge function
      //    (usa service role — não afeta a sessão atual do admin do Consubov).
      const newUserId = await provisionProfileUser({
        email: emailVet,
        senha,
        role: "usuario",
      });
      accountCreated = true;

      // 2) Cria a empresa
      const { data: emp, error: e1 } = await (supabase as any)
        .from("syncvet_empresas")
        .insert({
          nome: nomeEmpresa.trim(),
          cnpj: cnpj.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim() || null,
          telefone: telefone.trim() || null,
          email: emailContato.trim() || emailVet.trim().toLowerCase(),
        })
        .select("id")
        .single();
      if (e1) {
        toast.error(PARTIAL_PROFILE_MESSAGE);
        return;
      }

      // 3) Vincula veterinário como administrador da empresa
      const { error: e2 } = await (supabase as any)
        .from("syncvet_equipe")
        .insert({
          empresa_id: emp.id,
          user_id: newUserId,
          nome: nomeVet.trim(),
          perfil: "administrador",
          telefone: telefone.trim() || null,
          ativo: true,
        });
      if (e2) {
        toast.error(PARTIAL_PROFILE_MESSAGE);
        return;
      }

      toast.success(uiText("Empresa SyncVet criada com sucesso!"));
      setDone(true);
    } catch (err: unknown) {
      toast.error(accountCreated ? PARTIAL_PROFILE_MESSAGE
        : err instanceof ProfileProvisioningError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Card className="p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-primary"><LocalizedText source={"Empresa SyncVet criada!"} /></h1>
          <p className="text-sm text-muted-foreground">
            <LocalizedText source={"A conta de acesso do veterinário responsável foi criada com o e-mail"} />{" "}
            <strong className="text-foreground">{emailVet}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            <LocalizedText source={"Caso a confirmação de e-mail esteja ativada no projeto, o veterinário deve verificar a caixa de entrada antes de fazer login no módulo SyncVet."} /></p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/admin")}><LocalizedText source={"Voltar ao Admin"} /></Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary"><LocalizedText source={"SyncVet — Criar Empresa"} /></h1>
          <p className="text-xs text-muted-foreground">
            <LocalizedText source={"Cria a empresa e a conta de login do veterinário responsável (Administrador da empresa)."} /></p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold text-primary"><LocalizedText source={"Dados da empresa"} /></div>
        <div>
          <Label className="text-xs"><LocalizedText source={"Nome da empresa *"} /></Label>
          <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder={uiText("Ex: Clínica Veterinária ABC")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs"><LocalizedText source={"Telefone"} /></Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs"><LocalizedText source={"Cidade"} /></Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">UF</Label>
            <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs"><LocalizedText source={"E-mail de contato da empresa"} /></Label>
            <Input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@empresa.com" />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold text-primary"><LocalizedText source={"Veterinário responsável (Administrador)"} /></div>
        <p className="text-xs text-muted-foreground">
          <LocalizedText source={"Este é o login independente do veterinário no módulo SyncVet — separado do seu login de Admin do Consubov."} /></p>
        <div>
          <Label className="text-xs"><LocalizedText source={"Nome do veterinário responsável *"} /></Label>
          <Input value={nomeVet} onChange={(e) => setNomeVet(e.target.value)} placeholder="Dr. João Silva" />
        </div>
        <div>
          <Label className="text-xs"><LocalizedText source={"E-mail (usado para login) *"} /></Label>
          <Input type="email" value={emailVet} onChange={(e) => setEmailVet(e.target.value)} placeholder="veterinario@exemplo.com" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs"><LocalizedText source={"Senha *"} /></Label>
            <PasswordInput value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 12 caracteres" />
          </div>
          <div>
            <Label className="text-xs"><LocalizedText source={"Confirmar senha *"} /></Label>
            <PasswordInput value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder={uiText("Repita a senha")} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => navigate("/admin")} disabled={saving}><LocalizedText source={"Cancelar"} /></Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          <LocalizedText source={"Criar empresa e conta do veterinário"} /></Button>
      </div>
    </div>
  );
}
