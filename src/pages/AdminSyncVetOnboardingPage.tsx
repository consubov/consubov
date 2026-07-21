import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Stethoscope, CheckCircle2 } from "lucide-react";

export default function AdminSyncVetOnboardingPage() {
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
        toast.info("Você já possui empresa SyncVet");
        navigate("/syncvet", { replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [user, navigate]);

  function parseInvokeError(err: unknown): string {
    if (err && typeof err === "object" && "context" in err) {
      const ctx = (err as { context?: Response }).context;
      if (ctx) {
        // best-effort parse handled by caller; fall through to message
      }
    }
    return err instanceof Error ? err.message : "Erro desconhecido";
  }

  async function handleSubmit() {
    if (!user) return;

    if (!nomeEmpresa.trim()) { toast.error("Informe o nome da empresa"); return; }
    if (!nomeVet.trim()) { toast.error("Informe o nome do veterinário responsável"); return; }
    if (!emailVet.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVet.trim())) {
      toast.error("Informe um e-mail válido para o veterinário");
      return;
    }
    if (senha.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres"); return; }
    if (senha !== confirmarSenha) { toast.error("As senhas não coincidem"); return; }

    setSaving(true);
    try {
      // 1) Cria a conta de autenticação do veterinário via edge function
      //    (usa service role — não afeta a sessão atual do admin do Consubov).
      const { data: created, error: fnErr } = await supabase.functions.invoke("create-user", {
        body: {
          email: emailVet.trim().toLowerCase(),
          senha,
          role: "usuario",
        },
      });

      if (fnErr) {
        // tenta extrair mensagem estruturada
        let msg = fnErr instanceof Error ? fnErr.message : "Falha ao criar conta de acesso";
        const ctx = (fnErr as { context?: Response }).context;
        if (ctx) {
          try {
            const payload = await ctx.clone().json();
            msg = payload?.error || payload?.message || msg;
          } catch { /* ignore */ }
        }
        if (/already|registrado|exists/i.test(msg)) {
          toast.error("Este e-mail já está cadastrado. Use outro e-mail para o veterinário.");
        } else if (/password|senha/i.test(msg)) {
          toast.error(`Senha inválida: ${msg}`);
        } else {
          toast.error(`Erro ao criar conta de acesso: ${msg}`);
        }
        setSaving(false);
        return;
      }

      if (created?.error || created?.success === false) {
        const msg = created?.error || created?.message || "Erro ao criar conta de acesso";
        if (/already|registrado|exists/i.test(msg)) {
          toast.error("Este e-mail já está cadastrado. Use outro e-mail para o veterinário.");
        } else if (/password|senha/i.test(msg)) {
          toast.error(`Senha inválida: ${msg}`);
        } else {
          toast.error(msg);
        }
        setSaving(false);
        return;
      }

      const newUserId: string | undefined = created?.user?.id;
      if (!newUserId) {
        toast.error("Conta criada mas ID não retornado. Tente novamente.");
        setSaving(false);
        return;
      }

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
        toast.error(`Erro ao criar empresa: ${e1.message}`);
        setSaving(false);
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
        toast.error(`Erro ao vincular veterinário à empresa: ${e2.message}`);
        setSaving(false);
        return;
      }

      toast.success("Empresa SyncVet criada com sucesso!");
      setDone(true);
    } catch (err) {
      toast.error(parseInvokeError(err));
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
          <h1 className="text-lg font-bold text-primary">Empresa SyncVet criada!</h1>
          <p className="text-sm text-muted-foreground">
            A conta de acesso do veterinário responsável foi criada com o e-mail{" "}
            <strong className="text-foreground">{emailVet}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Caso a confirmação de e-mail esteja ativada no projeto, o veterinário deve
            verificar a caixa de entrada antes de fazer login no módulo SyncVet.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>Voltar ao Admin</Button>
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
          <h1 className="text-lg font-bold text-primary">SyncVet — Criar Empresa</h1>
          <p className="text-xs text-muted-foreground">
            Cria a empresa e a conta de login do veterinário responsável (Administrador da empresa).
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold text-primary">Dados da empresa</div>
        <div>
          <Label className="text-xs">Nome da empresa *</Label>
          <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Ex: Clínica Veterinária ABC" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">UF</Label>
            <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">E-mail de contato da empresa</Label>
            <Input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@empresa.com" />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold text-primary">Veterinário responsável (Administrador)</div>
        <p className="text-xs text-muted-foreground">
          Este é o login independente do veterinário no módulo SyncVet — separado do seu login de Admin do Consubov.
        </p>
        <div>
          <Label className="text-xs">Nome do veterinário responsável *</Label>
          <Input value={nomeVet} onChange={(e) => setNomeVet(e.target.value)} placeholder="Dr. João Silva" />
        </div>
        <div>
          <Label className="text-xs">E-mail (usado para login) *</Label>
          <Input type="email" value={emailVet} onChange={(e) => setEmailVet(e.target.value)} placeholder="veterinario@exemplo.com" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Senha *</Label>
            <PasswordInput value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <Label className="text-xs">Confirmar senha *</Label>
            <PasswordInput value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => navigate("/admin")} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Criar empresa e conta do veterinário
        </Button>
      </div>
    </div>
  );
}
