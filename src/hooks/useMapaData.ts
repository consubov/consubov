import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PastoMapaData {
  id: string;
  pasto_id: string;
  coordenadas: number[][];
  pasto_nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  consumo_medio: number | null;
  status_consumo: string | null;
  ultima_movimentacao: string | null;
  ultima_salga: string | null;
}

export interface MapaData {
  id: string;
  fazenda_id: string;
  imagem_url: string;
  pastos: PastoMapaData[];
}

export function useMapaData(fazendaId: string | undefined, mes: number, ano: number) {
  const [loading, setLoading] = useState(true);
  const [mapa, setMapa] = useState<MapaData | null>(null);

  const load = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);

    // Get mapa
    const { data: mapaRow } = await supabase
      .from("mapas")
      .select("*")
      .eq("fazenda_id", fazendaId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mapaRow) {
      setMapa(null);
      setLoading(false);
      return;
    }

    // Get pastos_mapa with linked pasto data
    const { data: pastosMapa } = await supabase
      .from("pastos_mapa")
      .select("id, pasto_id, coordenadas")
      .eq("mapa_id", mapaRow.id);

    if (!pastosMapa || pastosMapa.length === 0) {
      setMapa({
        id: mapaRow.id,
        fazenda_id: mapaRow.fazenda_id,
        imagem_url: mapaRow.imagem_url,
        pastos: [],
      });
      setLoading(false);
      return;
    }

    const pastoIds = pastosMapa.map((pm) => pm.pasto_id);

    // Get pasto details
    const { data: pastos } = await supabase
      .from("pastos")
      .select("id, nome, num_animais, peso_medio_kg, categoria, sexo")
      .in("id", pastoIds);

    // Get lancamentos for consumption
    const { data: lancamentos } = await supabase
      .from("lancamentos")
      .select("pasto_id, consumo_g_cab_dia, status_consumo, created_at")
      .in("pasto_id", pastoIds)
      .eq("mes_referencia", mes)
      .eq("ano_referencia", ano)
      .order("created_at", { ascending: false });

    // Get latest movimentacao per pasto
    const { data: movimentacoes } = await supabase
      .from("movimentacoes_animais")
      .select("pasto_origem_id, pasto_destino_id, data")
      .or(pastoIds.map((id) => `pasto_origem_id.eq.${id},pasto_destino_id.eq.${id}`).join(","))
      .order("data", { ascending: false })
      .limit(100);

    // Build lookup maps
    const pastosMap = new Map((pastos ?? []).map((p) => [p.id, p]));

    // Latest lancamento per pasto
    const consumoMap = new Map<string, { consumo: number | null; status: string | null; data: string | null }>();
    for (const l of lancamentos ?? []) {
      if (!consumoMap.has(l.pasto_id)) {
        consumoMap.set(l.pasto_id, {
          consumo: l.consumo_g_cab_dia,
          status: l.status_consumo,
          data: l.created_at,
        });
      }
    }

    // Latest movimentacao per pasto
    const movMap = new Map<string, string>();
    for (const m of movimentacoes ?? []) {
      for (const pid of [m.pasto_origem_id, m.pasto_destino_id]) {
        if (pastoIds.includes(pid) && !movMap.has(pid)) {
          movMap.set(pid, m.data);
        }
      }
    }

    const pastosData: PastoMapaData[] = pastosMapa.map((pm) => {
      const pasto = pastosMap.get(pm.pasto_id);
      const consumo = consumoMap.get(pm.pasto_id);
      return {
        id: pm.id,
        pasto_id: pm.pasto_id,
        coordenadas: (pm.coordenadas as any) || [],
        pasto_nome: pasto?.nome || "Pasto",
        num_animais: pasto?.num_animais || 0,
        peso_medio_kg: pasto?.peso_medio_kg ?? null,
        categoria: pasto?.categoria ?? null,
        sexo: pasto?.sexo ?? null,
        consumo_medio: consumo?.consumo ?? null,
        status_consumo: consumo?.status ?? null,
        ultima_movimentacao: movMap.get(pm.pasto_id) ?? null,
        ultima_salga: consumo?.data ?? null,
      };
    });

    setMapa({
      id: mapaRow.id,
      fazenda_id: mapaRow.fazenda_id,
      imagem_url: mapaRow.imagem_url,
      pastos: pastosData,
    });
    setLoading(false);
  }, [fazendaId, mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, mapa, refresh: load };
}
