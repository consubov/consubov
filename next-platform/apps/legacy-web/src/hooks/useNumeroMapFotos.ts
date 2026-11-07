import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSnapshot } from "@/lib/consultorOffline/snapshotStore";
import {
  computeConfinamentoPhotoNumbering,
  computeRotinaPhotoNumbering,
  type FotoRefLike,
  type PastoOrCurralLike,
  type TopicoLike,
} from "@/lib/photoNumbering";

export type NumeroMapTipo = "rotina" | "confinamento";

interface Options {
  visitaId: string | undefined;
  tipo: NumeroMapTipo;
  /** Tópicos já carregados na tela (com suas fotos). */
  topicos: TopicoLike[];
  /**
   * Pastos/currais com fotos. Quando omitido (telas de visita em andamento,
   * que não carregam fotos de pasto/curral), o hook busca as referências
   * mínimas no Supabase, com fallback para o snapshot offline.
   */
  itens?: PastoOrCurralLike[];
}

/**
 * Numeração global de fotos da visita (id da foto -> número sequencial),
 * compartilhada entre as telas de visita em andamento e de revisão.
 */
export function useNumeroMapFotos({ visitaId, tipo, topicos, itens }: Options): Record<string, number> {
  const [fetched, setFetched] = useState<PastoOrCurralLike[]>([]);
  const needsFetch = itens === undefined;

  useEffect(() => {
    if (!needsFetch || !visitaId) return;
    let cancelled = false;

    (async () => {
      const parentCol = tipo === "confinamento" ? "visita_curral_id" : "visita_pasto_id";
      const itensCol = tipo === "confinamento" ? "currais" : "pastos";
      const snap = await loadSnapshot(visitaId).catch(() => null);
      const snapItens: any[] = ((snap as any)?.[itensCol] as any[]) || [];
      let result: PastoOrCurralLike[] = snapItens.map((i: any) => ({
        id: i.id,
        fotos: (Array.isArray(i.fotos) ? i.fotos : []).map((f: any) => ({ id: f.id, ordem: f.ordem })) as FotoRefLike[],
      }));

      const online = typeof navigator === "undefined" || navigator.onLine;
      if (online) {
        try {
          const table = tipo === "confinamento" ? "visita_currais" : "visita_pastos";
          const { data: rows } = await (supabase as any).from(table)
            .select("id, ordem").eq("visita_id", visitaId).order("ordem");
          const ids = ((rows as any[]) || []).map(r => r.id);
          if (ids.length > 0) {
            const { data: fotos } = await supabase.from("visita_fotos")
              .select("id, ordem, " + parentCol).in(parentCol, ids).order("ordem");
            const byParent: Record<string, FotoRefLike[]> = {};
            ((fotos as any[]) || []).forEach((f: any) => {
              const key = f[parentCol];
              (byParent[key] ??= []).push({ id: f.id, ordem: f.ordem });
            });
            result = ids.map((id: string) => ({ id, fotos: byParent[id] || [] }));
          } else {
            result = [];
          }
        } catch {
          /* mantém o fallback do snapshot */
        }
      }

      if (!cancelled) setFetched(result);
    })();

    return () => { cancelled = true; };
  }, [needsFetch, visitaId, tipo, topicos.length]);

  const efetivos = itens ?? fetched;

  return useMemo(() => {
    return tipo === "confinamento"
      ? computeConfinamentoPhotoNumbering(efetivos, topicos)
      : computeRotinaPhotoNumbering(topicos, efetivos);
  }, [tipo, efetivos, topicos]);
}

export default useNumeroMapFotos;
