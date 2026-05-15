import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Map, TreePine, Package, CalendarDays, ClipboardList, QrCode, Brain, Beef, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import CriarAdminModal from "@/components/admin/CriarAdminModal";
import AdminListSection from "@/components/admin/AdminListSection";

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
  const [stats, setStats] = useState<Stats>({ fazendas: 0, retiros: 0, pastos: 0, produtos: 0, ciclosAbertos: 0, lancamentos: 0, animais: 0 });
  const [loading, setLoading] = useState(true);
  const [showCriarAdmin, setShowCriarAdmin] = useState(false);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [fazendas, retiros, pastos, produtos, ciclos, lancamentos, animaisData] = await Promise.all([
        supabase.from("fazendas").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("retiros").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("pastos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("ciclos").select("id", { count: "exact", head: true }).eq("fechado", false),
        supabase.from("lancamentos").select("id", { count: "exact", head: true }),
        supabase.from("pastos").select("num_animais").eq("ativo", true),
      ]);

      const totalAnimais = (animaisData.data ?? []).reduce((sum, p) => sum + (p.num_animais || 0), 0);

      setStats({
        fazendas: fazendas.count ?? 0,
        retiros: retiros.count ?? 0,
        pastos: pastos.count ?? 0,
        produtos: produtos.count ?? 0,
        ciclosAbertos: ciclos.count ?? 0,
        lancamentos: lancamentos.count ?? 0,
        animais: totalAnimais,
      });
      setLoading(false);
    }
    load();

    const channel = supabase.channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ciclos" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { label: "Fazendas", value: stats.fazendas, icon: Landmark, color: "text-primary", to: "/admin/fazendas" },
    { label: "Retiros", value: stats.retiros, icon: Map, color: "text-secondary", to: "/admin/fazendas" },
    { label: "Pastos Ativos", value: stats.pastos, icon: TreePine, color: "text-primary", to: "/admin/fazendas" },
    { label: "Produtos", value: stats.produtos, icon: Package, color: "text-secondary", to: "/admin/produtos" },
    { label: "Animais", value: stats.animais, icon: Beef, color: "text-primary", to: "/admin/fazendas" },
    { label: "Ciclos Abertos", value: stats.ciclosAbertos, icon: CalendarDays, color: "text-secondary", to: "/admin/ciclos" },
    { label: "Lançamentos", value: stats.lancamentos, icon: ClipboardList, color: "text-primary", to: "/admin/lancamento-manual" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            onClick={() => setShowCriarAdmin(true)}
            variant="outline"
            className="font-semibold"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Criar Administrador
          </Button>
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

      <AdminListSection refreshKey={adminRefreshKey} />

      <CriarAdminModal
        open={showCriarAdmin}
        onOpenChange={setShowCriarAdmin}
        onCreated={() => setAdminRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
