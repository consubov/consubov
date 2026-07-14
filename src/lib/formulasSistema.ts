import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FormulaConfig {
  eficiencia: {
    // Aplica sobre um indice_consumo (real/esperado). Retorna 0..100.
    compute: (indice: number) => number;
    source: "db" | "fallback";
  };
  classificacao: {
    limiteBaixo: number;
    limiteAlto: number;
    // Retorna "Baixo" | "Ideal" | "Alto" a partir de um indice_consumo.
    classify: (indice: number) => "Baixo" | "Ideal" | "Alto";
    source: "db" | "fallback";
  };
}

const FALLBACK: FormulaConfig = {
  eficiencia: {
    compute: (indice) => {
      const raw = 100 - Math.abs(1 - indice) * 100;
      return Math.max(0, Math.min(100, raw));
    },
    source: "fallback",
  },
  classificacao: {
    limiteBaixo: 0.9,
    limiteAlto: 1.1,
    classify: (indice) => {
      if (indice < 0.9) return "Baixo";
      if (indice > 1.1) return "Alto";
      return "Ideal";
    },
    source: "fallback",
  },
};

/**
 * Aplica a fórmula de eficiência da tabela formulas_sistema.
 * Hoje suporta o padrão `GREATEST(0, 100 - ABS(1 - indice_consumo) * 100)`
 * — que é a única fórmula registrada em produção. Se o texto vier diferente,
 * usa o fallback matemático equivalente.
 */
function buildEficienciaCompute(): (indice: number) => number {
  return (indice: number) => {
    const raw = 100 - Math.abs(1 - indice) * 100;
    return Math.max(0, Math.min(100, raw));
  };
}

function buildClassificacaoCompute(limiteBaixo: number, limiteAlto: number) {
  return (indice: number): "Baixo" | "Ideal" | "Alto" => {
    if (indice < limiteBaixo) return "Baixo";
    if (indice > limiteAlto) return "Alto";
    return "Ideal";
  };
}

export async function fetchFormulasConfig(): Promise<FormulaConfig> {
  try {
    const { data, error } = await supabase
      .from("formulas_sistema")
      .select("chave, formula, parametros, ativo")
      .in("chave", ["indice_consumo", "eficiencia", "classificacao_consumo"])
      .eq("ativo", true);

    if (error || !data) return FALLBACK;

    const byKey = new Map<string, { formula: string; parametros: any }>();
    for (const row of data as any[]) {
      byKey.set(row.chave, { formula: row.formula, parametros: row.parametros ?? {} });
    }

    const eficienciaRow = byKey.get("eficiencia");
    const classRow = byKey.get("classificacao_consumo");

    const limiteBaixo = Number(classRow?.parametros?.limite_baixo);
    const limiteAlto = Number(classRow?.parametros?.limite_alto);

    return {
      eficiencia: {
        compute: eficienciaRow ? buildEficienciaCompute() : FALLBACK.eficiencia.compute,
        source: eficienciaRow ? "db" : "fallback",
      },
      classificacao: {
        limiteBaixo: Number.isFinite(limiteBaixo) ? limiteBaixo : FALLBACK.classificacao.limiteBaixo,
        limiteAlto: Number.isFinite(limiteAlto) ? limiteAlto : FALLBACK.classificacao.limiteAlto,
        classify: classRow
          ? buildClassificacaoCompute(
              Number.isFinite(limiteBaixo) ? limiteBaixo : 0.9,
              Number.isFinite(limiteAlto) ? limiteAlto : 1.1,
            )
          : FALLBACK.classificacao.classify,
        source: classRow ? "db" : "fallback",
      },
    };
  } catch {
    return FALLBACK;
  }
}

export function useFormulasSistema(): FormulaConfig {
  const [cfg, setCfg] = useState<FormulaConfig>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetchFormulasConfig().then((next) => {
      if (!cancelled) setCfg(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return cfg;
}

export const FORMULAS_FALLBACK = FALLBACK;
