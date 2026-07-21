import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";

type Row = {
  id: string;
  equipe_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  gps_lat: number | null;
  gps_lng: number | null;
  dispositivo: string | null;
  created_at: string;
};

export default function SyncVetAuditoriaPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [equipeMap, setEquipeMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: eq } = await supabase.from("syncvet_equipe").select("id, nome").eq("empresa_id", empresaId);
      setEquipeMap(new Map(((eq as { id: string; nome: string }[]) || []).map(e => [e.id, e.nome])));
      const { data } = await supabase
        .from("syncvet_auditoria")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(300);
      setRows((data as Row[]) || []);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-primary flex items-center gap-2">
        <ShieldCheck className="w-5 h-5" /> Auditoria
      </h1>
      <div className="text-xs text-muted-foreground">Últimos 300 registros. Somente leitura.</div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</Card>
      ) : (
        <div className="space-y-1">
          {rows.map(r => {
            const nome = r.equipe_id ? equipeMap.get(r.equipe_id) : null;
            const dt = new Date(r.created_at);
            return (
              <Card key={r.id} className="p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="secondary" className="text-[10px]">{r.acao}</Badge>
                    <span className="font-medium truncate">{r.entidade}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px] shrink-0">
                    {dt.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {nome ?? "—"}
                  {r.gps_lat != null && r.gps_lng != null ? ` • ${r.gps_lat.toFixed(4)}, ${r.gps_lng.toFixed(4)}` : ""}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
