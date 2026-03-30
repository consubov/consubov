import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, TreePine, ClipboardList, LogOut } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import logoConsubov from "@/assets/logo-consubov.jpeg";

export default function GerenteDashboard() {
  const { signOut, roleData } = useAuth();
  const [retiros, setRetiros] = useState<number>(0);
  const [pastosAtivos, setPastosAtivos] = useState<number>(0);
  const [ultimosLancamentos, setUltimosLancamentos] = useState<Tables<"lancamentos">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleData.fazendaId) return;

    async function load() {
      const fazendaId = roleData.fazendaId!;

      const [retirosRes, retirosListRes] = await Promise.all([
        supabase.from("retiros").select("id", { count: "exact", head: true }).eq("fazenda_id", fazendaId).eq("ativo", true),
        supabase.from("retiros").select("id").eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      setRetiros(retirosRes.count ?? 0);

      const retiroIds = (retirosListRes.data ?? []).map((r) => r.id);

      if (retiroIds.length > 0) {
        const [pastosRes, lancRes] = await Promise.all([
          supabase.from("pastos").select("id", { count: "exact", head: true }).in("retiro_id", retiroIds).eq("ativo", true),
          supabase.from("lancamentos").select("*").in("pasto_id",
            (await supabase.from("pastos").select("id").in("retiro_id", retiroIds)).data?.map(p => p.id) ?? []
          ).order("lancado_em", { ascending: false }).limit(5),
        ]);

        setPastosAtivos(pastosRes.count ?? 0);
        setUltimosLancamentos(lancRes.data ?? []);
      }

      setLoading(false);
    }
    load();
  }, [roleData.fazendaId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoConsubov} alt="Consubov" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Consubov</h1>
              <p className="text-xs opacity-80">Painel do Gerente</p>
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-4">Visão Geral</h2>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Retiros</CardTitle>
                    <Map className="w-5 h-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-3xl font-bold text-foreground">{retiros}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pastos Ativos</CardTitle>
                    <TreePine className="w-5 h-5 text-secondary" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-3xl font-bold text-foreground">{pastosAtivos}</p>
                </CardContent>
              </Card>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
              Últimos Lançamentos
            </h3>
            {ultimosLancamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="space-y-2">
                {ultimosLancamentos.map((l) => (
                  <Card key={l.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{l.num_animais} animais · {l.num_sacos} sacos</p>
                        <p className="text-xs text-muted-foreground">
                          {l.lancado_em ? new Date(l.lancado_em).toLocaleDateString("pt-BR") : "—"}
                          {l.capataz_nome ? ` · ${l.capataz_nome}` : ""}
                        </p>
                      </div>
                      {l.consumo_g_cab_dia != null && (
                        <span className="text-sm font-semibold text-primary">
                          {Number(l.consumo_g_cab_dia).toFixed(0)} g/cab/dia
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
