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

    setData(EMPTY);

    (async () => {
      try {
        const { data: pesagemAtual, error: pesagemError } = await (supabase.from("pesagens") as any)
          .select("id, lote_id, media_calculada, data_pesagem, quantidade_animais")
          .eq("id", pesagemAtualId)
          .maybeSingle();

        if (pesagemError || !pesagemAtual) {
          if (!cancelled) setData({ ...EMPTY, loading: false });
          return;
        }

        const { data: pasto, error: pastoError } = await (supabase.from("pastos") as any)
          .select("nome, num_animais")
          .eq("id", pesagemAtual.lote_id)
          .maybeSingle();

        if (pastoError) {
          if (!cancelled) setData({ ...EMPTY, loading: false });
          return;
        }

        const { data: anteriores, error: anteriorError } = await (supabase.from("pesagens") as any)
          .select("id, media_calculada, data_pesagem")
          .eq("lote_id", pesagemAtual.lote_id)
          .lt("data_pesagem", pesagemAtual.data_pesagem)
          .order("data_pesagem", { ascending: false })
          .limit(1);

        if (anteriorError) {
          if (!cancelled) setData({ ...EMPTY, loading: false });
          return;
        }

        const anterior = Array.isArray(anteriores) && anteriores.length > 0 ? anteriores[0] : null;
        const pesoAtual = Number(pesagemAtual.media_calculada) || 0;
        const qtdAnimais = Number(pesagemAtual.quantidade_animais) || Number(pasto?.num_animais) || 0;
        const nomePasto = pasto?.nome || "";

        if (!anterior) {
          if (!cancelled) {
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
          }
          return;
        }

        const pesoAnterior = Number(anterior.media_calculada) || 0;
        const ganho = pesoAtual - pesoAnterior;
        const msDia = 1000 * 60 * 60 * 24;
        const dias = Math.max(
          1,
          Math.round(
            (new Date(pesagemAtual.data_pesagem).getTime() - new Date(anterior.data_pesagem).getTime()) / msDia,
          ),
        );
        const gmdCalculado = ganho / dias;
        const gmd = Math.round(gmdCalculado * 100) / 100;
        const sinal: "+" | "-" | "" = gmd > 0 ? "+" : gmd < 0 ? "-" : "";

        if (!cancelled) {
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
        }
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
