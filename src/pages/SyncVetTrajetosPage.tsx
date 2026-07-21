import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Loader2, Route as RouteIcon, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

type Trajeto = {
  id: string;
  data: string;
  fazenda_id: string;
  distancia_km: number | null;
  duracao_min: number | null;
  origem_endereco: string | null;
};
type Fazenda = { id: string; nome: string };

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function fmtDuracao(min: number | null) {
  if (min == null) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function SyncVetTrajetosPage() {
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const [loading, setLoading] = useState(true);
  const [trajetos, setTrajetos] = useState<Trajeto[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);

  const load = useCallback(async () => {
    if (!user || !empresaId) return;
    setLoading(true);
    try {
      const { data: eq } = await supabase.from("syncvet_equipe")
        .select("id").eq("empresa_id", empresaId).eq("user_id", user.id).maybeSingle();
      const vetId = (eq as { id: string } | null)?.id;
      if (!vetId) { setTrajetos([]); return; }

      const [{ data: tr }, { data: faz }] = await Promise.all([
        supabase.from("syncvet_trajetos")
          .select("id, data, fazenda_id, distancia_km, duracao_min, origem_endereco")
          .eq("veterinario_id", vetId)
          .order("data", { ascending: false })
          .limit(200),
        supabase.from("syncvet_fazendas").select("id, nome").eq("empresa_id", empresaId),
      ]);
      setTrajetos((tr as Trajeto[]) || []);
      setFazendas((faz as Fazenda[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar trajetos");
    } finally {
      setLoading(false);
    }
  }, [user, empresaId]);

  useEffect(() => { void load(); }, [load]);

  const fazById = useMemo(() => {
    const m = new Map<string, Fazenda>();
    fazendas.forEach(f => m.set(f.id, f));
    return m;
  }, [fazendas]);

  const grupos = useMemo(() => {
    const g = new Map<string, Trajeto[]>();
    for (const t of trajetos) {
      const arr = g.get(t.data) || [];
      arr.push(t);
      g.set(t.data, arr);
    }
    return Array.from(g.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [trajetos]);

  const totalKm = trajetos.reduce((s, t) => s + (t.distancia_km ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2">
          <RouteIcon className="w-5 h-5" /> Meus Trajetos
        </h1>
        <div className="text-xs text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{totalKm.toFixed(2)} km</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum trajeto registrado</Card>
      ) : (
        <div className="space-y-4">
          {grupos.map(([data, itens]) => (
            <div key={data} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {fmtDateLong(data)}
              </div>
              <div className="space-y-2">
                {itens.map(t => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {fazById.get(t.fazenda_id)?.nome ?? "Fazenda"}
                        </div>
                        {t.origem_endereco && (
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 shrink-0" /> {t.origem_endereco}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fmtDuracao(t.duracao_min)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-primary">
                          {t.distancia_km?.toFixed(2) ?? "-"}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">km</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
