import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Scale, CalendarDays, Users, DollarSign, FileDown } from "lucide-react";
import { calcularAnimais, totalizar, type PesagemCompraCfg, type PesoAnimal } from "@/lib/pesagemCompra";

const CATEGORIA_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  aleatoria: "Aleatória",
};

type PesagemRow = {
  id: string;
  cliente_id: string;
  categoria: string;
  finalizada_at: string;
  pdf_url: string | null;
  tipo_preco: string;
  preco_valor: number | null;
  modo_percentual: string | null;
  percentual_fixo: number | null;
  preco_arroba: number | null;
  preco_kg: number | null;
  preco_fixo_animal: number | null;
};

export default function PesadorDashboard() {
  const [loading, setLoading] = useState(true);
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("");
  const [pesagens, setPesagens] = useState<PesagemRow[]>([]);
  const [pesosByPesagem, setPesosByPesagem] = useState<Record<string, PesoAnimal[]>>({});
  const [totalClientes, setTotalClientes] = useState(0);
  const [clienteNomes, setClienteNomes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser.user?.id;
      if (!uid) { setLoading(false); return; }

      const { data: pes } = await supabase
        .from("pesadores")
        .select("id, nome_empresa")
        .eq("user_id", uid)
        .maybeSingle();
      const pesadorId = (pes as any)?.id as string | undefined;
      setNomeEmpresa((pes as any)?.nome_empresa ?? "");
      if (!pesadorId) { setLoading(false); return; }

      const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

      const { data: pAno } = await supabase
        .from("pesagens_compra")
        .select("id, cliente_id, categoria, finalizada_at, pdf_url, tipo_preco, preco_valor, modo_percentual, percentual_fixo, preco_arroba, preco_kg, preco_fixo_animal")
        .eq("pesador_id", pesadorId)
        .not("finalizada_at", "is", null)
        .gte("finalizada_at", startYear)
        .order("finalizada_at", { ascending: false });
      const rows = (pAno ?? []) as PesagemRow[];
      setPesagens(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: pesos } = await supabase
          .from("pesos_pesagem_compra")
          .select("pesagem_id, ordem, peso_kg, percentual_individual, tipo_preco_individual")
          .in("pesagem_id", ids);
        const map: Record<string, PesoAnimal[]> = {};
        for (const p of pesos ?? []) {
          const key = (p as any).pesagem_id as string;
          (map[key] ||= []).push({
            ordem: (p as any).ordem,
            peso_kg: Number((p as any).peso_kg),
            percentual_individual: (p as any).percentual_individual != null ? Number((p as any).percentual_individual) : null,
            tipo_preco_individual: (p as any).tipo_preco_individual ?? null,
          });
        }
        setPesosByPesagem(map);

        const clienteIds = Array.from(new Set(rows.slice(0, 5).map((r) => r.cliente_id)));
        if (clienteIds.length > 0) {
          const { data: cs } = await supabase
            .from("clientes_pesador")
            .select("id, nome")
            .in("id", clienteIds);
          const cmap: Record<string, string> = {};
          for (const c of cs ?? []) cmap[(c as any).id] = (c as any).nome;
          setClienteNomes(cmap);
        }
      }

      const { count } = await supabase
        .from("clientes_pesador")
        .select("id", { count: "exact", head: true })
        .eq("pesador_id", pesadorId);
      setTotalClientes(count ?? 0);

      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    let animaisAno = 0;
    let animaisMes = 0;
    let valorMes = 0;
    for (const p of pesagens) {
      const d = new Date(p.finalizada_at);
      const pesos = pesosByPesagem[p.id] ?? [];
      animaisAno += pesos.length;
      if (d.getFullYear() === year && d.getMonth() === month) {
        animaisMes += pesos.length;
        const cfg: PesagemCompraCfg = {
          tipo_preco: p.tipo_preco as any,
          preco_valor: Number(p.preco_valor ?? 0),
          modo_percentual: (p.modo_percentual as any) ?? "na",
          percentual_fixo: p.percentual_fixo != null ? Number(p.percentual_fixo) : null,
          preco_arroba: p.preco_arroba != null ? Number(p.preco_arroba) : null,
          preco_kg: p.preco_kg != null ? Number(p.preco_kg) : null,
          preco_fixo_animal: p.preco_fixo_animal != null ? Number(p.preco_fixo_animal) : null,
        };
        const t = totalizar(calcularAnimais(cfg, pesos));
        valorMes += t.totalValor;
      }
    }
    return { animaisAno, animaisMes, valorMes };
  }, [pesagens, pesosByPesagem]);

  const ultimas = pesagens.slice(0, 5).map((p) => {
    const pesos = pesosByPesagem[p.id] ?? [];
    const cfg: PesagemCompraCfg = {
      tipo_preco: p.tipo_preco as any,
      preco_valor: Number(p.preco_valor ?? 0),
      modo_percentual: (p.modo_percentual as any) ?? "na",
      percentual_fixo: p.percentual_fixo != null ? Number(p.percentual_fixo) : null,
      preco_arroba: p.preco_arroba != null ? Number(p.preco_arroba) : null,
      preco_kg: p.preco_kg != null ? Number(p.preco_kg) : null,
      preco_fixo_animal: p.preco_fixo_animal != null ? Number(p.preco_fixo_animal) : null,
    };
    const t = totalizar(calcularAnimais(cfg, pesos));
    return { ...p, totalValor: t.totalValor };
  });

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando painel...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bem-vindo, {nomeEmpresa || "Pesador"}
        </h1>
        <p className="text-sm text-muted-foreground">Resumo das suas pesagens</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<Scale className="w-4 h-4" />} label="Animais pesados no ano" value={stats.animaisAno.toString()} />
        <KpiCard icon={<CalendarDays className="w-4 h-4" />} label="Animais pesados no mês" value={stats.animaisMes.toString()} />
        <KpiCard icon={<Users className="w-4 h-4" />} label="Clientes cadastrados" value={totalClientes.toString()} />
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Valor pago no mês" value={brl(stats.valorMes)} />
      </div>

    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}
