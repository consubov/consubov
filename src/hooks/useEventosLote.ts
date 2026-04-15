import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EventoLote {
  id: string;
  lote_id: string;
  tipo: string;
  usuario_id: string | null;
  data_evento: string;
  dados: any;
  criado_em: string;
}

export interface PesagemData {
  id: string;
  evento_id: string;
  lote_id: string;
  total_pesado: number;
  pesos: number[];
  media_calculada: number | null;
  peso_medio_aplicado: number | null;
  data_pesagem: string;
}

export interface EventoSanitarioData {
  id: string;
  evento_id: string;
  lote_id: string;
  categoria: string;
  medicamento: string;
  dose: string;
  lote_completo: boolean;
  quantidade_tratada: number | null;
  tem_carencia: boolean;
  dias_carencia: number | null;
  data_fim_carencia: string | null;
  aplicador_id: string | null;
  data_aplicacao: string;
}

export function useEventosLote(loteId: string | undefined) {
  const [eventos, setEventos] = useState<EventoLote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!loteId) return;
    setLoading(true);
    const { data } = await (supabase
      .from("eventos_lote") as any)
      .select("*")
      .eq("lote_id", loteId)
      .order("data_evento", { ascending: false });
    setEventos((data as EventoLote[]) ?? []);
    setLoading(false);
  }, [loteId]);

  useEffect(() => { load(); }, [load]);

  return { eventos, loading, refresh: load };
}

export function useUltimaPesagem(loteId: string | undefined) {
  const [pesagem, setPesagem] = useState<PesagemData | null>(null);

  useEffect(() => {
    if (!loteId) return;
    (supabase
      .from("pesagens") as any)
      .select("*")
      .eq("lote_id", loteId)
      .order("data_pesagem", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setPesagem(data as PesagemData | null));
  }, [loteId]);

  return pesagem;
}

export function useUltimoSanitario(loteId: string | undefined) {
  const [sanitario, setSanitario] = useState<EventoSanitarioData | null>(null);

  useEffect(() => {
    if (!loteId) return;
    (supabase
      .from("eventos_sanitarios") as any)
      .select("*")
      .eq("lote_id", loteId)
      .order("data_aplicacao", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setSanitario(data as EventoSanitarioData | null));
  }, [loteId]);

  return sanitario;
}

export function calcCarenciaDias(dataFimCarencia: string | null | undefined): number {
  if (!dataFimCarencia) return 0;
  const fim = new Date(dataFimCarencia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
  return Math.max(0, diff);
}
