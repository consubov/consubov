import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Bell, DollarSign, FileText, Wallet, Route as RouteIcon, ChevronRight, Building2, ShieldCheck } from "lucide-react";
import { isSyncvetFullAccess } from "@/lib/syncvetPerfil";

const OPCOES = [
  { horas: 24, label: "24 horas antes" },
  { horas: 18, label: "18 horas antes" },
  { horas: 15, label: "15 horas antes" },
  { horas: 2, label: "2 horas antes" },
];

export default function SyncVetPreferenciasPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const fullAccess = isSyncvetFullAccess(roleData.syncvetPerfil);

  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !empresaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: eq } = await supabase
        .from("syncvet_equipe")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (!eq) { setEquipeId(null); setSelected(new Set()); return; }
      setEquipeId(eq.id);
      const { data: prefs } = await supabase
        .from("syncvet_equipe_notificacoes")
        .select("horas_antes")
        .eq("equipe_id", eq.id);
      setSelected(new Set((prefs || []).map(p => p.horas_antes as number)));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar preferências");
    } finally {
      setLoading(false);
    }
  }, [user?.id, empresaId]);

  useEffect(() => { void load(); }, [load]);

  function toggle(h: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h); else next.add(h);
      return next;
    });
  }

  async function save() {
    if (!equipeId) { toast.error("Perfil de equipe não encontrado"); return; }
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("syncvet_equipe_notificacoes")
        .delete()
        .eq("equipe_id", equipeId);
      if (delErr) throw delErr;
      const rows = Array.from(selected).map(h => ({ equipe_id: equipeId, horas_antes: h }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("syncvet_equipe_notificacoes")
          .insert(rows);
        if (insErr) throw insErr;
      }
      toast.success("Preferências salvas");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar preferências");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-lg font-bold text-primary">Configurações & Financeiro</h1>

      <div className="grid grid-cols-1 gap-2">
        {[
          { to: "/syncvet/empresa", icon: Building2, label: "Empresa", desc: "Dados da sua empresa" },
          { to: "/syncvet/precos", icon: DollarSign, label: "Tabela de Preços", desc: "Cadastre seus valores de serviço" },
          { to: "/syncvet/servicos/novo", icon: FileText, label: "Gerar Serviço", desc: "Monte um novo relatório de cobrança" },
          { to: "/syncvet/contas", icon: Wallet, label: "Contas a Receber", desc: "Serviços emitidos e pagamentos" },
          { to: "/syncvet/trajetos", icon: RouteIcon, label: "Meus Trajetos", desc: "Histórico de km rodado" },
          { to: "/syncvet/auditoria", icon: ShieldCheck, label: "Auditoria", desc: "Registro de ações no sistema" },
        ].map(it => (
          <Link key={it.to} to={it.to} className="block">
            <Card className="p-3 flex items-center gap-3 hover:bg-muted/40">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <it.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{it.label}</div>
                <div className="text-xs text-muted-foreground">{it.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-base font-bold text-primary flex items-center gap-2 pt-2">
        <Bell className="w-4 h-4" /> Notificações de Manejo
      </h2>

      <Card className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Com quanto tempo de antecedência você quer ser avisado dos manejos programados?
          Você pode selecionar mais de uma opção.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !equipeId ? (
          <div className="text-sm text-muted-foreground italic">
            Seu usuário ainda não está vinculado a uma equipe SyncVet.
          </div>
        ) : (
          <div className="space-y-2">
            {OPCOES.map(op => {
              const checked = selected.has(op.horas);
              return (
                <label
                  key={op.horas}
                  className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(op.horas)} />
                  <span className="text-sm">{op.label}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving || loading || !equipeId}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
