import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Map, TreePine, Package, CalendarDays, ClipboardList, QrCode, Brain, Beef } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Stats {
  fazendas: number;
  retiros: number;
  pastos: number;
  produtos: number;
  ciclosAbertos: number;
  lancamentos: number;
  animais: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ fazendas: 0, retiros: 0, pastos: 0, produtos: 0, ciclosAbertos: 0, lancamentos: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [fazendas, retiros, pastos, produtos, ciclos, lancamentos] = await Promise.all([
        supabase.from("fazendas").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("retiros").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("pastos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("ciclos").select("id", { count: "exact", head: true }).eq("fechado", false),
        supabase.from("lancamentos").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        fazendas: fazendas.count ?? 0,
        retiros: retiros.count ?? 0,
        pastos: pastos.count ?? 0,
        produtos: produtos.count ?? 0,
        ciclosAbertos: ciclos.count ?? 0,
        lancamentos: lancamentos.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Fazendas", value: stats.fazendas, icon: Landmark, color: "text-primary" },
    { label: "Retiros", value: stats.retiros, icon: Map, color: "text-secondary" },
    { label: "Pastos Ativos", value: stats.pastos, icon: TreePine, color: "text-primary" },
    { label: "Produtos", value: stats.produtos, icon: Package, color: "text-secondary" },
    { label: "Ciclos Abertos", value: stats.ciclosAbertos, icon: CalendarDays, color: "text-primary" },
    { label: "Lançamentos", value: stats.lancamentos, icon: ClipboardList, color: "text-secondary" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate("/admin/inteligencia")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
          >
            <Brain className="w-5 h-5 mr-2" />
            Inteligência Nutricional
          </Button>
          <Button
            onClick={() => navigate("/admin/qrcodes")}
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold shadow-md"
          >
            <QrCode className="w-5 h-5 mr-2" />
            Gerar QR Codes
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-bold text-foreground">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
