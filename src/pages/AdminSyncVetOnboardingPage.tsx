import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";

export default function AdminSyncVetOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nomeAdmin, setNomeAdmin] = useState("");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("syncvet_equipe")
        .select("id, empresa_id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (data) {
        toast.info("Você já possui empresa SyncVet");
        navigate("/syncvet", { replace: true });
        return;
      }
      setEmail(user.email ?? "");
      const meta = user.user_metadata as { nome?: string; full_name?: string } | null;
      setNomeAdmin(meta?.nome ?? meta?.full_name ?? user.email ?? "");
      setChecking(false);
    })();
  }, [user, navigate]);

  async function handleSubmit() {
    if (!user) return;
    if (!nomeEmpresa.trim()) { toast.error("Informe o nome da empresa"); return; }
    if (!nomeAdmin.trim()) { toast.error("Informe seu nome"); return; }
    setSaving(true);
    try {
      const { data: emp, error: e1 } = await (supabase as any)
        .from("syncvet_empresas")
        .insert({
          nome: nomeEmpresa.trim(),
          cnpj: cnpj.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const { error: e2 } = await (supabase as any)
        .from("syncvet_equipe")
        .insert({
          empresa_id: emp.id,
          user_id: user.id,
          nome: nomeAdmin.trim(),
          perfil: "administrador",
          telefone: telefone.trim() || null,
          ativo: true,
        });
      if (e2) throw e2;

      toast.success("Empresa SyncVet criada — recarregando...");
      // Força re-detecção de role no próximo carregamento
      setTimeout(() => { window.location.href = "/syncvet"; }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar empresa";
      toast.error(msg);
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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary">SyncVet — Criar Empresa</h1>
          <p className="text-xs text-muted-foreground">
            Você entrará como Administrador da empresa recém-criada.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
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
            <Label className="text-xs">Email de contato</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="pt-2 border-t">
          <Label className="text-xs">Seu nome (Administrador) *</Label>
          <Input value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/admin")} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Criar empresa e entrar
          </Button>
        </div>
      </Card>
    </div>
  );
}
