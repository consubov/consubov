import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNomeUsuario } from "@/hooks/useNomeUsuario";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Factory, LogOut, Loader2, Menu, RefreshCw, Wrench, Truck, BarChart3,
  Warehouse, AlertTriangle,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { UserNotificationToggle } from "@/components/UserNotificationToggle";
import ProducaoTab from "@/components/fabrica/ProducaoTab";
import TransferenciasTab from "@/components/fabrica/TransferenciasTab";
import DadosTab from "@/components/fabrica/DadosTab";

interface Fabrica { id: string; codigo: string | null; nome: string; descricao: string | null; }
interface Operador { id: string; nome: string; fabrica_id: string; }

type TabKey = "producao" | "transferencias" | "dados";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "producao", label: "Produção", icon: Wrench },
  { key: "transferencias", label: "Transferências", icon: Truck },
  { key: "dados", label: "Dados", icon: BarChart3 },
];

export default function FabricaDashboard() {
  const { roleData, user, signOut } = useAuth();
  const [fabrica, setFabrica] = useState<Fabrica | null>(null);
  const [operador, setOperador] = useState<Operador | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>("producao");
  const [menuOpen, setMenuOpen] = useState(false);

  // Stats
  const [stockSacos, setStockSacos] = useState(0);
  const [prodHoje, setProdHoje] = useState(0);
  const [transito, setTransito] = useState(0);
  const [divergencias, setDivergencias] = useState(0);

  useEffect(() => {
    if (!roleData?.fabricaId || !user) { setLoading(false); return; }
    void loadAll();
  }, [roleData?.fabricaId, user?.id]);

  async function loadAll() {
    setLoading(true);
    const fabricaId = roleData.fabricaId!;
    const [fRes, oRes] = await Promise.all([
      supabase.from("fabricas").select("id, codigo, nome, descricao").eq("id", fabricaId).maybeSingle(),
      supabase.from("operadores_fabrica").select("id, nome, fabrica_id").eq("user_id", user!.id).eq("ativo", true).maybeSingle(),
    ]);
    setFabrica(fRes.data as Fabrica | null);
    setOperador(oRes.data as Operador | null);
    await loadStats(fabricaId);
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }

  async function loadStats(fabricaId: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const daysAgo30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [estRes, prodRes, transRes, batRes] = await Promise.all([
      supabase.from("estoque_produto_acabado").select("quantidade_sacos").eq("fabrica_id", fabricaId),
      supabase.from("batidas").select("quantidade_produzida").eq("fabrica_id", fabricaId).eq("status", "finalizada").eq("data_finalizacao", hoje),
      supabase.from("transferencias_fabrica").select("id", { count: "exact", head: true }).eq("fabrica_id", fabricaId).eq("status", "em_transito"),
      supabase.from("batidas").select("quantidade_produzida, data_finalizacao, formula_id").eq("fabrica_id", fabricaId).eq("status", "finalizada").gte("data_finalizacao", daysAgo30),
    ]);
    setStockSacos((estRes.data || []).reduce((a: number, r: any) => a + Number(r.quantidade_sacos || 0), 0));
    setProdHoje((prodRes.data || []).reduce((a: number, r: any) => a + Number(r.quantidade_produzida || 0), 0));
    setTransito(transRes.count || 0);

    // Divergências: precisamos das fórmulas para calcular
    const bats = (batRes.data || []) as any[];
    if (bats.length) {
      const fIds = Array.from(new Set(bats.map(b => b.formula_id).filter(Boolean)));
      const { data: fms } = await supabase.from("formulas_fabrica").select("id, producao_esperada").in("id", fIds);
      const espMap: Record<string, number> = {};
      (fms || []).forEach((f: any) => { espMap[f.id] = Number(f.producao_esperada || 0); });
      const count = bats.filter(b => {
        const esp = espMap[b.formula_id] || 0;
        if (esp <= 0) return false;
        const dif = Math.abs(((Number(b.quantidade_produzida || 0) - esp) / esp) * 100);
        return dif > 5;
      }).length;
      setDivergencias(count);
    } else {
      setDivergencias(0);
    }
  }

  const nomeOperadorPapel = useNomeUsuario(["operadores_fabrica"], "Operador");
  const nomeOperador = useMemo(() => operador?.nome ?? nomeOperadorPapel, [operador, nomeOperadorPapel]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fabrica) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden"><img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" /></div>
            <span className="font-bold">Consubov</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80"><LogOut className="w-5 h-5" /></Button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md"><CardContent className="p-6 text-center text-muted-foreground">
            Nenhuma fábrica vinculada ao seu perfil. Contate o administrador.
          </CardContent></Card>
        </div>
      </div>
    );
  }

  const fabricaId = fabrica.id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="bg-primary text-primary-foreground px-4 py-3 border-b border-primary/20 shrink-0 space-y-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="p-4 border-b bg-primary text-primary-foreground">
                  <SheetTitle className="text-primary-foreground flex items-center gap-2">
                    <Factory className="w-5 h-5" /> {fabrica.nome}
                  </SheetTitle>
                  <p className="text-xs text-primary-foreground/80 text-left">Operador: {nomeOperador}</p>
                </SheetHeader>
                <nav className="p-2">
                  {TABS.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => { setTab(t.key); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm transition ${active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"}`}
                      >
                        <Icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <img src={logoConsubov} alt="Consubov" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">Operador de Fábrica</h1>
              <p className="max-w-[170px] truncate text-xs opacity-80 sm:max-w-[240px]">{nomeOperador}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-primary-foreground hover:bg-primary/80" disabled={refreshing} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80" title="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <button onClick={() => setTab("producao")} className="flex items-center gap-2 text-xs opacity-90 min-w-0">
            <Factory className="w-3 h-3 shrink-0" />
            <span className="truncate">{fabrica.nome}</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <UserNotificationToggle />
            <AppVersionBadge />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Estoque Atual" value={stockSacos} suffix="sc" icon={Warehouse} />
          <StatCard label="Produção Hoje" value={prodHoje} suffix="sc" icon={Factory} />
          <StatCard label="Em Trânsito" value={transito} icon={Truck} />
          <StatCard label="Divergências (30d)" value={divergencias} icon={AlertTriangle} alert={divergencias > 0} />
        </div>

        {/* TABS CONTENT */}
        {tab === "producao" && <ProducaoTab fabricaId={fabricaId} />}
        {tab === "transferencias" && <TransferenciasTab fabricaId={fabricaId} />}
        {tab === "dados" && <DadosTab fabricaId={fabricaId} />}

      </main>
    </div>
  );
}

function StatCard({ label, value, suffix, icon: Icon, alert }: {
  label: string; value: number; suffix?: string; icon: any; alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${alert ? "bg-destructive/10" : "bg-secondary/15"}`}>
          <Icon className={`w-5 h-5 ${alert ? "text-destructive" : "text-secondary"}`} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-muted-foreground leading-tight truncate">{label}</div>
          <div className="text-lg font-bold leading-tight">
            {value.toLocaleString("pt-BR")}
            {suffix && <span className="text-xs text-muted-foreground font-normal ml-1">{suffix}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
