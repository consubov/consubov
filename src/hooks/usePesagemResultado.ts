import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PesagemResultado {
  loading: boolean;
  primeiraPesagem: boolean;
  gmd: number | null;
  sinal: "+" | "-" | "";
  dias: number | null;
  pesoAtual: number;
  pesoAnterior: number | null;
  ganho: number | null;
  qtdAnimais: number;
  nomePasto: string;
}

const EMPTY: PesagemResultado = {
  loading: true,
  primeiraPesagem: true,
  gmd: null,
  sinal: "",
  dias: null,
  pesoAtual: 0,
  pesoAnterior: null,
  ganho: null,
  qtdAnimais: 0,
  nomePasto: "",
};

export function usePesagemResultado(pesagemAtualId: string | null | undefined) {
  const [data, setData] = useState<PesagemResultado>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!pesagemAtualId) {
      setData(EMPTY);
      return;
    }

    (async () => {
      try {
        const { data: atual, error } = await (supabase
          .from("pesagens") as any)
          .select("id, lote_id, media_calculada, data_pesagem, quantidade_animais, total_pesado")
          .eq("id", pesagemAtualId)
          .maybeSingle();

        if (error || !atual) {
          if (!cancelled) setData({ ...EMPTY, loading: false });
          return;
        }

        const { data: pasto } = await (supabase.from("pastos") as any)
          .select("nome, num_animais")
          .eq("id", atual.lote_id)
          .maybeSingle();

        const { data: anteriorArr } = await (supabase.from("pesagens") as any)
          .select("id, media_calculada, data_pesagem")
          .eq("lote_id", atual.lote_id)
          .neq("id", pesagemAtualId)
          .order("data_pesagem", { ascending: false })
          .limit(1);

        const anterior = anteriorArr && anteriorArr.length > 0 ? anteriorArr[0] : null;

        const pesoAtual = Number(atual.media_calculada) || 0;
        const qtdAnimais =
          Number(atual.quantidade_animais) ||
          Number(atual.total_pesado) ||
          Number(pasto?.num_animais) ||
          0;
        const nomePasto = pasto?.nome || "";

        if (!anterior) {
          if (!cancelled)
            setData({
              loading: false,
              primeiraPesagem: true,
              gmd: null,
              sinal: "",
              dias: null,
              pesoAtual,
              pesoAnterior: null,
              ganho: null,
              qtdAnimais,
              nomePasto,
            });
          return;
        }

        const pesoAnterior = Number(anterior.media_calculada) || 0;
        const ganho = pesoAtual - pesoAnterior;
        const msDia = 1000 * 60 * 60 * 24;
        const dias = Math.max(
          1,
          Math.round(
            (new Date(atual.data_pesagem).getTime() -
              new Date(anterior.data_pesagem).getTime()) /
              msDia,
          ),
        );
        const gmdRaw = ganho / dias;
        const gmd = Math.round(gmdRaw * 100) / 100;
        const sinal: "+" | "-" | "" = gmd > 0 ? "+" : gmd < 0 ? "-" : "";

        if (!cancelled)
          setData({
            loading: false,
            primeiraPesagem: false,
            gmd: Math.abs(gmd),
            sinal,
            dias,
            pesoAtual,
            pesoAnterior,
            ganho,
            qtdAnimais,
            nomePasto,
          });
      } catch {
        if (!cancelled) setData({ ...EMPTY, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pesagemAtualId]);

  return data;
}
