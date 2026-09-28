import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export interface PastoMapaData {
  id: string;
  pasto_id: string;
  coordenadas: number[][];
  cor: string;
  pasto_nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  consumo_medio: number | null; // consumo global g/cab/dia
  status_consumo: string | null; // status global
  ultima_movimentacao: string | null;
  ultima_salga: string | null;
  ultima_salga_sacos: number | null;
  ultimo_cocho_cheio: string | null;
  ultima_visita_tipo: "salga" | "cocho_cheio" | null;
  data_fim_carencia: string | null;
  label_offset_x: number;
  label_offset_y: number;
  label_rotation: number;
}


export interface LinhaMapaData {
  id: string;
  coordenadas: number[][];
  cor: string;
  tipo: string;
  rotulo: string | null;
}

export interface ElementoMapaData {
  id: string;
  tipo: string;
  emoji: string;
  posicao_x: number;
  posicao_y: number;
  rotulo: string | null;
}

export interface MapaData {
  id: string;
  fazenda_id: string;
  imagem_url: string;
  pastos: PastoMapaData[];
  linhas: LinhaMapaData[];
  elementos: ElementoMapaData[];
}

export function useMapaData(fazendaId: string | undefined, mes: number, ano: number, retiroId?: string) {
  const [loading, setLoading] = useState(true);
  const [mapa, setMapa] = useState<MapaData | null>(null);

  const load = useCallback(async () => {
    if (!retiroId) return;
    setLoading(true);

    const { data: mapaRow } = await supabase
      .from("mapas")
      .select("*")
      .eq("retiro_id", retiroId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mapaRow) {
      setMapa(null);
      setLoading(false);
      return;
    }

    // Load pastos_mapa, linhas_mapa, elementos_mapa in parallel
    const [pastosMapaRes, linhasRes, elementosRes] = await Promise.all([
      supabase.from("pastos_mapa").select("id, pasto_id, coordenadas, cor").eq("mapa_id", mapaRow.id),
      supabase.from("linhas_mapa").select("id, coordenadas, cor, tipo, rotulo").eq("mapa_id", mapaRow.id),
      supabase.from("elementos_mapa").select("id, tipo, emoji, posicao_x, posicao_y, rotulo").eq("mapa_id", mapaRow.id),
    ]);

    const pastosMapa = pastosMapaRes.data ?? [];
    const linhas: LinhaMapaData[] = (linhasRes.data ?? []).map((l) => ({
      id: l.id,
      coordenadas: (l.coordenadas as any) || [],
      cor: l.cor,
      tipo: l.tipo,
      rotulo: l.rotulo,
    }));
    const elementos: ElementoMapaData[] = (elementosRes.data ?? []).map((e) => ({
      id: e.id,
      tipo: e.tipo,
      emoji: e.emoji,
      posicao_x: Number(e.posicao_x),
      posicao_y: Number(e.posicao_y),
      rotulo: e.rotulo,
    }));

    if (pastosMapa.length === 0) {
      setMapa({
        id: mapaRow.id,
        fazenda_id: mapaRow.fazenda_id,
        imagem_url: mapaRow.imagem_url,
        pastos: [],
        linhas,
        elementos,
      });
      setLoading(false);
      return;
    }

    let pastoIds = pastosMapa.map((pm) => pm.pasto_id);

    if (retiroId) {
      const { data: retiroPastos } = await supabase
        .from("pastos")
        .select("id")
        .eq("retiro_id", retiroId);
      const retiroPastoIds = new Set((retiroPastos ?? []).map((p) => p.id));
      pastoIds = pastoIds.filter((id) => retiroPastoIds.has(id));
    }

    if (pastoIds.length === 0) {
      setMapa({
        id: mapaRow.id,
        fazenda_id: mapaRow.fazenda_id,
        imagem_url: mapaRow.imagem_url,
        pastos: [],
        linhas,
        elementos,
      });
      setLoading(false);
      return;
    }

    const filteredPastosMapa = pastosMapa.filter((pm) => pastoIds.includes(pm.pasto_id));

    const [pastosRes, painelMaeRes, movimentacoesRes] = await Promise.all([
      supabase.from("pastos").select("id, nome, num_animais, peso_medio_kg, categoria, sexo, data_fim_carencia, label_offset_x, label_offset_y, label_rotation").in("id", pastoIds),
      supabase.from("view_painel_mae_pasto_atual").select("pasto_id, consumo_global_g_cab_dia, status_global, ultima_salga_real_em").in("pasto_id", pastoIds),
      supabase.from("movimentacoes_animais").select("pasto_origem_id, pasto_destino_id, data").or(pastoIds.map((id) => `pasto_origem_id.eq.${id},pasto_destino_id.eq.${id}`).join(",")).order("data", { ascending: false }).limit(100),
    ]);

    const pastosMap = new Map((pastosRes.data ?? []).map((p) => [p.id, p]));

    type VisitaRow = {
      pasto_id: string;
      cocho_cheio: boolean;
      num_sacos: number;
      data_salga_informada: string | null;
      created_at: string;
    };
    const visitas: VisitaRow[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data } = await supabase
        .from("lancamentos")
        .select("pasto_id, cocho_cheio, num_sacos, data_salga_informada, created_at")
        .in("pasto_id", pastoIds)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      const page = (data ?? []) as VisitaRow[];
      visitas.push(...page);
      if (page.length < pageSize) break;
    }

    const visitaDate = (row: VisitaRow) => row.data_salga_informada || row.created_at;
    const ultimaSalgaMap = new Map<string, VisitaRow>();
    const ultimoCochoMap = new Map<string, VisitaRow>();
    for (const visita of visitas) {
      const destino = visita.cocho_cheio ? ultimoCochoMap : ultimaSalgaMap;
      const atual = destino.get(visita.pasto_id);
      if (!atual || new Date(visitaDate(visita)).getTime() > new Date(visitaDate(atual)).getTime()) {
        destino.set(visita.pasto_id, visita);
      }
    }

    const consumoMap = new Map<string, { consumo: number | null; status: string | null; data: string | null }>();
    for (const row of painelMaeRes.data ?? []) {
      if (!consumoMap.has(row.pasto_id)) {
        consumoMap.set(row.pasto_id, {
          consumo: row.consumo_global_g_cab_dia,
          status: row.status_global,
          data: row.ultima_salga_real_em,
        });
      }
    }


    const movMap = new Map<string, string>();
    for (const m of movimentacoesRes.data ?? []) {
      for (const pid of [m.pasto_origem_id, m.pasto_destino_id]) {
        if (pastoIds.includes(pid) && !movMap.has(pid)) {
          movMap.set(pid, m.data);
        }
      }
    }

    const pastosData: PastoMapaData[] = filteredPastosMapa.map((pm) => {
      const pasto = pastosMap.get(pm.pasto_id);
      const consumo = consumoMap.get(pm.pasto_id);
      const ultimaSalga = ultimaSalgaMap.get(pm.pasto_id);
      const ultimoCocho = ultimoCochoMap.get(pm.pasto_id);
      const dataUltimaSalga = ultimaSalga ? visitaDate(ultimaSalga) : null;
      const dataUltimoCocho = ultimoCocho ? visitaDate(ultimoCocho) : null;
      const ultimaVisitaTipo = dataUltimoCocho && (!dataUltimaSalga || new Date(dataUltimoCocho).getTime() > new Date(dataUltimaSalga).getTime())
        ? "cocho_cheio"
        : dataUltimaSalga
          ? "salga"
          : null;
      return {
        id: pm.id,
        pasto_id: pm.pasto_id,
        coordenadas: (pm.coordenadas as any) || [],
        cor: (pm as any).cor || "#16a34a",
        pasto_nome: pasto?.nome || "Pasto",
        num_animais: pasto?.num_animais || 0,
        peso_medio_kg: pasto?.peso_medio_kg ?? null,
        categoria: pasto?.categoria ?? null,
        sexo: pasto?.sexo ?? null,
        consumo_medio: consumo?.consumo ?? null,
        status_consumo: consumo?.status ?? null,
        ultima_movimentacao: movMap.get(pm.pasto_id) ?? null,
        ultima_salga: dataUltimaSalga,
        ultima_salga_sacos: ultimaSalga?.num_sacos ?? null,
        ultimo_cocho_cheio: dataUltimoCocho,
        ultima_visita_tipo: ultimaVisitaTipo,
        data_fim_carencia: (pasto as any)?.data_fim_carencia ?? null,
        label_offset_x: Number(pasto?.label_offset_x) || 0,
        label_offset_y: Number(pasto?.label_offset_y) || 0,
        label_rotation: Number(pasto?.label_rotation) || 0,
      };
    });

    setMapa({
      id: mapaRow.id,
      fazenda_id: mapaRow.fazenda_id,
      imagem_url: mapaRow.imagem_url,
      pastos: pastosData,
      linhas,
      elementos,
    });
    setLoading(false);
  }, [fazendaId, mes, ano, retiroId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades"], load);

  return { loading, mapa, refresh: load };
}
