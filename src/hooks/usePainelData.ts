import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------
interface Retiro {
  id: string; nome: string; capataz: string;
  ultima_salga_em: string | null; produto_id: string | null;
}
interface Pasto {
  id: string; nome: string; retiro_id: string; num_animais: number;
  peso_medio_kg: number | null; gmd_kg_dia: number | null;
  produto_id: string | null;
}
interface Lancamento {
  id: string; pasto_id: string; retiro_id: string;
  num_sacos: number; num_animais: number;
  peso_medio_kg: number | null; dias_no_pasto: number;
  created_at: string | null;
  mes_referencia: number; ano_referencia: number;
  status_consumo: string | null; indice_consumo: number | null;
  categoria: string | null; sexo: string | null;
}
interface Produto { id: string; peso_saco_kg: number; preco_por_kg: number | null; }

export interface RetiroResumo {
  id: string; nome: string; capataz: string;
  totalAnimais: number; sacosUtilizados: number;
  consumoMedio: number; gmd: number;
  diasSemSalga: number | null;
  lancamentos: Lancamento[];
  pastos: Pasto[];
}

export interface StatusDist {
  baixo: number; ideal: number; alto: number;
  baixoPct: number; idealPct: number; altoPct: number;
}

export interface PainelMetrics {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number; // g/cab/dia
  pastosNaMeta: number;
  totalPastos: number;
  custoDiario: number;
  custoMensal: number;
  eficiencia: number;
  gmdMedio: number;
  totalSalgas: number;
  statusDist: StatusDist;
}

export interface PainelFilters {
  fazendaId: string;
  retiroId?: string | null;
  mes: number;
  ano: number;
}

const emptyMetrics: PainelMetrics = {
  totalAnimais: 0, sacosUtilizados: 0, consumoMedio: 0,
  pastosNaMeta: 0, totalPastos: 0, custoDiario: 0,
  custoMensal: 0, eficiencia: 0, gmdMedio: 0, totalSalgas: 0,
  statusDist: { baixo: 0, ideal: 0, alto: 0, baixoPct: 0, idealPct: 0, altoPct: 0 },
};

export function usePainelData(filters: PainelFilters) {
  const { fazendaId, retiroId, mes, ano } = filters;
  const [loading, setLoading] = useState(true);
  const [fazendaNome, setFazendaNome] = useState("");
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const loadData = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const [fazRes, retirosRes, prodRes] = await Promise.all([
        supabase.from("fazendas").select("nome").eq("id", fazendaId).single(),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, produto_id")
          .eq("fazenda_id", fazendaId).eq("ativo", true),
        supabase.from("produtos").select("id, peso_saco_kg, preco_por_kg"),
      ]);

      setFazendaNome(fazRes.data?.nome ?? "");
      const allRetiros = (retirosRes.data ?? []) as Retiro[];
      const retList = retiroId ? allRetiros.filter((retiro) => retiro.id === retiroId) : allRetiros;
      setRetiros(retList);
      setProdutos((prodRes.data ?? []) as Produto[]);

      let retiroIds = retList.map(r => r.id);
      if (retiroId) retiroIds = [retiroId];

      if (retiroIds.length > 0) {
        const pastosRes = await supabase.from("pastos")
          .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, produto_id")
          .in("retiro_id", retiroIds).eq("ativo", true);
        const pastosList = (pastosRes.data ?? []) as Pasto[];
        setPastos(pastosList);

        const pastoIds = pastosList.map(p => p.id);
        if (pastoIds.length > 0) {
          const lancRes = await supabase.from("lancamentos")
            .select("id, pasto_id, retiro_id, num_sacos, num_animais, peso_medio_kg, dias_no_pasto, created_at, mes_referencia, ano_referencia, status_consumo, indice_consumo, categoria, sexo")
            .in("pasto_id", pastoIds)
            .eq("ano_referencia", ano)
            .eq("mes_referencia", mes);
          setLancamentos((lancRes.data ?? []) as Lancamento[]);
        } else {
          setLancamentos([]);
        }
      } else {
        setPastos([]);
        setLancamentos([]);
      }
    } catch (e) {
      console.error("usePainelData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`painel-${fazendaId}-${retiroId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData, fazendaId, retiroId]);

  const produtoMap = useMemo(() => new Map(produtos.map(p => [p.id, p])), [produtos]);

  const metrics = useMemo<PainelMetrics>(() => {
    if (lancamentos.length === 0 && pastos.length === 0) return emptyMetrics;

    const totalAnimais = pastos.reduce((s, p) => s + (p.num_animais || 0), 0);
    const sacosUtilizados = lancamentos.reduce((s, l) => s + (l.num_sacos || 0), 0);

    let totalKgSal = 0;
    for (const l of lancamentos) {
      const pasto = pastos.find(p => p.id === l.pasto_id);
      const retiro = retiros.find(r => r.id === (pasto?.retiro_id ?? l.retiro_id));
      const prodId = pasto?.produto_id ?? retiro?.produto_id;
      const prod = prodId ? produtoMap.get(prodId) : null;
      totalKgSal += l.num_sacos * (prod?.peso_saco_kg ?? 25);
    }
    const consumoMedio = totalAnimais > 0 ? (totalKgSal * 1000) / (totalAnimais * 30) : 0;

    // Status distribution
    const lancComStatus = lancamentos.filter(l => l.status_consumo);
    const total = lancComStatus.length;
    const baixo = lancComStatus.filter(l => l.status_consumo === "Baixo").length;
    const ideal = lancComStatus.filter(l => l.status_consumo === "Ideal").length;
    const alto = lancComStatus.filter(l => l.status_consumo === "Alto").length;

    // Pastos na meta
    const pastosStatus = new Map<string, string>();
    for (const l of lancamentos) {
      if (l.status_consumo) pastosStatus.set(l.pasto_id, l.status_consumo);
    }
    const pastosNaMeta = Array.from(pastosStatus.values()).filter(s => s === "Ideal").length;

    // Custos
    const precos = produtos.filter(p => p.preco_por_kg != null && p.preco_por_kg > 0).map(p => p.preco_por_kg!);
    const precoMedio = precos.length > 0 ? precos.reduce((a, b) => a + b, 0) / precos.length : 0;
    const custoDiario = (consumoMedio / 1000) * precoMedio;
    const custoMensal = custoDiario * 30 * totalAnimais;

    // Eficiência
    const indices = lancamentos.filter(l => l.indice_consumo != null && l.indice_consumo > 0).map(l => l.indice_consumo!);
    const eficiencia = indices.length > 0 ? (indices.reduce((a, b) => a + b, 0) / indices.length) * 100 : 0;

    // GMD
    const gmdVals = pastos.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
    const gmdMedio = gmdVals.length > 0 ? gmdVals.reduce((a, b) => a + b, 0) / gmdVals.length : 0;

    return {
      totalAnimais, sacosUtilizados, consumoMedio,
      pastosNaMeta, totalPastos: pastos.length,
      custoDiario, custoMensal, eficiencia, gmdMedio,
      totalSalgas: lancamentos.length,
      statusDist: {
        baixo, ideal, alto,
        baixoPct: total > 0 ? (baixo / total) * 100 : 0,
        idealPct: total > 0 ? (ideal / total) * 100 : 0,
        altoPct: total > 0 ? (alto / total) * 100 : 0,
      },
    };
  }, [pastos, lancamentos, retiros, produtos, produtoMap]);

  // Retiros resumo
  const retirosResumo = useMemo<RetiroResumo[]>(() => {
    const now = new Date();
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      const rPastoIds = new Set(rPastos.map(p => p.id));
      const rLanc = lancamentos.filter(l => rPastoIds.has(l.pasto_id));
      const pastosNoPeriodo = rPastos.filter(p => rLanc.some(l => l.pasto_id === p.id));
      const totalAnimais = rPastos.reduce((s, p) => s + (p.num_animais || 0), 0);
      const sacosUtilizados = rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);

      let totalKg = 0;
      for (const l of rLanc) {
        const pasto = rPastos.find(p => p.id === l.pasto_id);
        const prodId = pasto?.produto_id ?? r.produto_id;
        const prod = prodId ? produtoMap.get(prodId) : null;
        totalKg += l.num_sacos * (prod?.peso_saco_kg ?? 25);
      }
      const consumoMedio = totalAnimais > 0 ? (totalKg * 1000) / (totalAnimais * 30) : 0;

      const gVals = rPastos.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
      const gmd = gVals.length > 0 ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;

      let diasSemSalga: number | null = null;
      if (r.ultima_salga_em) {
        diasSemSalga = Math.floor((now.getTime() - new Date(r.ultima_salga_em).getTime()) / 86400000);
      }

      return { id: r.id, nome: r.nome, capataz: r.capataz, totalAnimais, sacosUtilizados, consumoMedio, gmd, diasSemSalga, lancamentos: rLanc, pastos: pastosNoPeriodo };
    });
  }, [retiros, pastos, lancamentos, produtoMap]);

  return {
    loading, fazendaNome, metrics, retirosResumo, lancamentos, refresh: loadData,
  };
}
