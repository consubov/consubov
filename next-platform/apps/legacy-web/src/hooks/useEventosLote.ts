import { useCallback, useEffect, useState } from "react";
import {
  getUltimaPesagem,
  getUltimoSanitario,
  listEventosLote,
  type EventoLote,
  type EventoSanitarioData,
  type PesagemData,
} from "@/features/lotes/repositories/eventosLoteRepository";

export type { EventoLote, EventoSanitarioData, PesagemData };

export function useEventosLote(loteId: string | undefined, refreshKey?: number) {
  const [eventos, setEventos] = useState<EventoLote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!loteId) return;
    setLoading(true);
    const data = await listEventosLote(loteId);
    setEventos(data);
    setLoading(false);
  }, [loteId, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { eventos, loading, refresh: load };
}

export function useUltimaPesagem(loteId: string | undefined) {
  const [pesagem, setPesagem] = useState<PesagemData | null>(null);

  useEffect(() => {
    if (!loteId) return;
    void getUltimaPesagem(loteId).then(setPesagem);
  }, [loteId]);

  return pesagem;
}

export function useUltimoSanitario(loteId: string | undefined) {
  const [sanitario, setSanitario] = useState<EventoSanitarioData | null>(null);

  useEffect(() => {
    if (!loteId) return;
    void getUltimoSanitario(loteId).then(setSanitario);
  }, [loteId]);

  return sanitario;
}

export function calcCarenciaDias(
  dataFimCarencia: string | null | undefined,
): number {
  if (!dataFimCarencia) return 0;
  const fim = new Date(dataFimCarencia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
  return Math.max(0, diff);
}
