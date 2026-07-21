import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Empresa = {
  id?: string;
  nome: string;
  crmv: string | null;
  cnpj: string | null;
  responsavel_tecnico: string | null;
  logo_url: string | null;
  telefone: string | null;
  email: string | null;
};

const EMPTY: Empresa = {
  nome: "",
  crmv: "",
  cnpj: "",
  responsavel_tecnico: "",
  logo_url: "",
  telefone: "",
  email: "",
};

export default function SyncVetEmpresaPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [form, setForm] = useState<Empresa>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!empresaId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("syncvet_empresas")
        .select("*")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) setForm({ ...EMPTY, ...(data as any) });
      setLoading(false);
    })();
  }, [empresaId]);

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      crmv: form.crmv || null,
      cnpj: form.cnpj || null,
      responsavel_tecnico: form.responsavel_tecnico || null,
      logo_url: form.logo_url || null,
      telefone: form.telefone || null,
      email: form.email || null,
    };
    if (empresaId) {
      const { error } = await supabase.from("syncvet_empresas").update(payload).eq("id", empresaId);
      if (error) toast.error(error.message);
      else toast.success("Empresa atualizada");
    } else {
      const { error } = await supabase.from("syncvet_empresas").insert(payload as any);
      if (error) toast.error(error.message);
      else toast.success("Empresa criada");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Empresa</h1>
        <p className="text-sm text-muted-foreground">Dados cadastrais da sua clínica/empresa veterinária</p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome*" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
          <Field label="CRMV" value={form.crmv ?? ""} onChange={(v) => setForm({ ...form, crmv: v })} />
          <Field label="CNPJ" value={form.cnpj ?? ""} onChange={(v) => setForm({ ...form, cnpj: v })} />
          <Field label="Responsável técnico" value={form.responsavel_tecnico ?? ""} onChange={(v) => setForm({ ...form, responsavel_tecnico: v })} />
          <Field label="Telefone" value={form.telefone ?? ""} onChange={(v) => setForm({ ...form, telefone: v })} />
          <Field label="E-mail" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="md:col-span-2">
            <Field label="Logo (URL)" value={form.logo_url ?? ""} onChange={(v) => setForm({ ...form, logo_url: v })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
