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
  nomeFazenda: string;
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
  nomeFazenda: "",
};

export function usePesagemResultado(pesagemId: string | null | undefined) {
  const [data, setData] = useState<PesagemResultado>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    if (!pesagemId) {
      setData(EMPTY);
      return;
    }

    setData(EMPTY);

    (async () => {
      try {
        const { data: atual, error: e1 } = await (supabase.from("pesagens") as any)
          .select("*, pastos(nome, num_animais, retiros(fazendas(nome)))")
          .eq("id", pesagemId)
          .maybeSingle();

        if (e1 || !atual) {
          console.error("Erro ao buscar pesagem atual:", e1);
          if (!cancelled) setData({ ...EMPTY, loading: false });
          return;
        }

        const { data: anteriores, error: e2 } = await (supabase.from("pesagens") as any)
          .select("media_calculada, data_pesagem")
          .eq("lote_id", atual.lote_id)
          .neq("id", pesagemId)
          .order("data_pesagem", { ascending: false })
          .limit(1);

        if (e2) console.error("Erro ao buscar pesagem anterior:", e2);

        const anterior = Array.isArray(anteriores) && anteriores.length > 0 ? anteriores[0] : null;

        const pesoAtual = Number(atual.media_calculada) || 0;
        const qtdAnimais =
          Number(atual.quantidade_animais) ||
          Number(atual.pastos?.num_animais) ||
          Number(atual.total_pesado) ||
          0;
        const nomePasto = atual.pastos?.nome || "";
        const nomeFazenda = atual.pastos?.retiros?.fazendas?.nome || "";

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
              nomeFazenda,
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
            (new Date(atual.data_pesagem).getTime() - new Date(anterior.data_pesagem).getTime()) / msDia,
          ),
        );
        const gmdCalc = Math.round((ganho / dias) * 100) / 100;
        const sinal: "+" | "-" | "" = gmdCalc > 0 ? "+" : gmdCalc < 0 ? "-" : "";

        if (!cancelled) {
          setData({
            loading: false,
            primeiraPesagem: false,
            gmd: Math.abs(gmdCalc),
            sinal,
            dias,
            pesoAtual,
            pesoAnterior,
            ganho,
            qtdAnimais,
            nomePasto,
            nomeFazenda,
          });
        }
      } catch (err) {
        console.error("Erro geral usePesagemResultado:", err);
        if (!cancelled) setData({ ...EMPTY, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pesagemId]);

  return data;
}
