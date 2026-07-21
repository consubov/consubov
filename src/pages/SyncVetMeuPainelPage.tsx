import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Route as RouteIcon, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function SyncVetMeuPainelPage() {
  const { user, roleData } = useAuth();
  const equipeId = roleData.roleId;
  const [loading, setLoading] = useState(true);
  const [hoje, setHoje] = useState(0);
  const [atrasados, setAtrasados] = useState(0);
  const [proximos, setProximos] = useState(0);
  const [concluidosMes, setConcluidosMes] = useState(0);
  const [proximo, setProximo] = useState<{ data: string; tipo: string | null } | null>(null);

  useEffect(() => {
    if (!equipeId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const today = todayISO();
      const firstOfMonth = today.slice(0, 8) + "01";

      const { data } = await supabase
        .from("syncvet_manejos")
        .select("id, data_prevista, status, tipo_manejo, data_execucao")
        .eq("responsavel_id", equipeId)
        .order("data_prevista", { ascending: true });

      const list = data ?? [];
      let h = 0, a = 0, p = 0, c = 0;
      let nx: { data: string; tipo: string | null } | null = null;
      for (const m of list) {
        const st = (m as any).status as string;
        const dp = (m as any).data_prevista as string;
        if (st === "concluido") {
          const de = ((m as any).data_execucao as string | null) ?? dp;
          if (de && de >= firstOfMonth) c++;
          continue;
        }
        if (dp === today) h++;
        else if (dp < today) a++;
        else p++;
        if (!nx && dp >= today) nx = { data: dp, tipo: (m as any).tipo_manejo };
      }
      setHoje(h); setAtrasados(a); setProximos(p); setConcluidosMes(c); setProximo(nx);
      setLoading(false);
    })();
  }, [equipeId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const nome = user?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Meu Painel</h1>
        <p className="text-sm text-muted-foreground">Olá{nome ? `, ${nome}` : ""} — resumo das suas atividades.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="w-3.5 h-3.5" />Hoje</div>
          <div className="text-2xl font-bold mt-1">{hoje}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" />Atrasados</div>
          <div className={`text-2xl font-bold mt-1 ${atrasados ? "text-destructive" : ""}`}>{atrasados}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" />Próximos</div>
          <div className="text-2xl font-bold mt-1">{proximos}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5" />Concluídos (mês)</div>
          <div className="text-2xl font-bold mt-1">{concluidosMes}</div>
        </Card>
      </div>

      {proximo && (
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Próxima atividade</div>
          <div className="font-semibold mt-1">{fmtDate(proximo.data)}</div>
          <div className="text-xs text-muted-foreground capitalize">{proximo.tipo ?? "manejo"}</div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/syncvet/agenda"><Button variant="outline" className="w-full"><Calendar className="w-4 h-4 mr-1" />Minha Agenda</Button></Link>
        <Link to="/syncvet/trajetos"><Button variant="outline" className="w-full"><RouteIcon className="w-4 h-4 mr-1" />Trajetos</Button></Link>
      </div>
    </div>
  );
}
