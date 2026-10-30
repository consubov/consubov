import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Map, TreePine, Package, CalendarDays, ClipboardList, QrCode, Brain, Beef, Factory, ScanLine, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  fabricas: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ fazendas: 0, retiros: 0, pastos: 0, produtos: 0, ciclosAbertos: 0, lancamentos: 0, animais: 0, fabricas: 0 });
  const [loading, setLoading] = useState(true);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showCriarAdmin = searchParams.get("criar-admin") === "1";

  useEffect(() => {
    async function load() {
      const [fazendas, retiros, pastos, produtos, ciclos, lancamentos, animaisData, fabricas] = await Promise.all([
        supabase.from("fazendas").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("retiros").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("pastos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("ciclos").select("id", { count: "exact", head: true }).eq("fechado", false),
        supabase.from("lancamentos").select("id", { count: "exact", head: true }),
        supabase.from("pastos").select("num_animais").eq("ativo", true),
        supabase.from("fabricas").select("id", { count: "exact", head: true }).eq("ativo", true),
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
        fabricas: fabricas.count ?? 0,
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
    { label: "Fábricas", value: stats.fabricas, icon: Factory, color: "text-secondary", to: "/admin/fabricas" },
  ];

  const actionCards = [
    {
      title: "Inteligência Nutricional",
      description: "Acompanhe o consumo e desempenho do seu rebanho.",
      icon: Brain,
      to: "/admin/inteligencia",
      iconBg: "bg-primary",
      iconColor: "text-primary-foreground",
      buttonClass: "text-primary hover:bg-primary/10",
    },
    {
      title: "Conferência",
      description: "Escaneie QR Codes e valide informações em campo.",
      icon: ScanLine,
      to: "/conferencia",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      buttonClass: "text-primary hover:bg-primary/10",
    },
    {
      title: "Gerar QR Codes",
      description: "Gere QR Codes para pastos, retiros e locais.",
      icon: QrCode,
      to: "/admin/qrcodes",
      iconBg: "bg-secondary",
      iconColor: "text-secondary-foreground",
      buttonClass: "text-secondary hover:bg-secondary/10",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {actionCards.map((c) => (
          <Card
            key={c.title}
            className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col"
          >
            <CardHeader className="pb-0 pt-3 px-3">
              <div className="flex items-start gap-2">
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${c.iconBg} ${c.iconColor}`}>
                  <c.icon className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="text-xs font-semibold text-foreground leading-tight">{c.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-1">
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{c.description}</p>
            </CardContent>
            <CardFooter className="pt-0 pb-3 px-3 mt-auto">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full h-auto py-1 px-2 text-xs font-semibold justify-between ${c.buttonClass}`}
                onClick={() => navigate(c.to)}
              >
                Acessar
                <ArrowRight className="w-3 h-3" />
              </Button>
            </CardFooter>
          </Card>
        ))}
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
            <Card
              key={c.label}
              onClick={() => navigate(c.to)}
              className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer active:scale-[0.98]"
            >
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
        onOpenChange={(open) => { if (!open) navigate("/admin", { replace: true }); }}
        onCreated={() => setAdminRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
