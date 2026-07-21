export type TipoPreco = "arroba" | "kg" | "fixo_animal" | "misto";
export type TipoPrecoIndividual = "arroba" | "kg" | "fixo_animal";
export type ModoPercentual = "fixo" | "aleatorio" | "na";

export interface PesagemCompraCfg {
  tipo_preco: TipoPreco;
  preco_valor: number;
  modo_percentual: ModoPercentual;
  percentual_fixo: number | null;
  // Preços independentes para lotes "misto" (categoria "aleatoria")
  preco_arroba?: number | null;
  preco_kg?: number | null;
  preco_fixo_animal?: number | null;
  // Mapa por categoria para lotes "aleatoria" (novo modelo)
  categorias_map?: Record<string, { tipo_preco: TipoPrecoIndividual; preco_valor: number }> | null;
}

export interface PesoAnimal {
  ordem: number;
  peso_kg: number;
  percentual_individual: number | null;
  tipo_preco_individual?: TipoPrecoIndividual | null;
  categoria_individual?: string | null;
}

export interface AnimalCalc extends PesoAnimal {
  peso_pagavel: number | null;
  arroba_pagavel: number | null;
  valor: number;
}

/**
 * ARROBA DE CARCAÇA: peso_carcaca (peso_vivo × rendimento%) ÷ 15.
 */
export function calcularAnimais(cfg: PesagemCompraCfg, pesos: PesoAnimal[]): AnimalCalc[] {
  return pesos.map((p) => {
    // Lote misto (aleatória): usa categoria_individual + categorias_map (novo modelo).
    // Fallback legado: tipo_preco_individual + preços do lote.
    if (cfg.tipo_preco === "misto") {
      const mapped =
        p.categoria_individual && cfg.categorias_map
          ? cfg.categorias_map[p.categoria_individual]
          : null;
      const tipoInd = (mapped?.tipo_preco ?? p.tipo_preco_individual ?? "kg") as TipoPrecoIndividual;
      if (tipoInd === "kg") {
        const preco = mapped?.preco_valor ?? cfg.preco_kg ?? 0;
        return {
          ...p,
          peso_pagavel: p.peso_kg,
          arroba_pagavel: null,
          valor: round2(p.peso_kg * preco),
        };
      }
      if (tipoInd === "fixo_animal") {
        const preco = mapped?.preco_valor ?? cfg.preco_fixo_animal ?? 0;
        return {
          ...p,
          peso_pagavel: null,
          arroba_pagavel: null,
          valor: round2(preco),
        };
      }
      // arroba
      const pct = p.percentual_individual ?? 0;
      const pesoPagavel = (p.peso_kg * pct) / 100;
      const arroba = trunc2(pesoPagavel / 15);
      const preco = mapped?.preco_valor ?? cfg.preco_arroba ?? 0;
      return {
        ...p,
        peso_pagavel: round2(pesoPagavel),
        arroba_pagavel: arroba,
        valor: round2(arroba * preco),
      };
    }

    if (cfg.tipo_preco === "kg") {
      return {
        ...p,
        peso_pagavel: p.peso_kg,
        arroba_pagavel: null,
        valor: round2(p.peso_kg * cfg.preco_valor),
      };
    }
    if (cfg.tipo_preco === "fixo_animal") {
      return {
        ...p,
        peso_pagavel: null,
        arroba_pagavel: null,
        valor: round2(cfg.preco_valor),
      };
    }
    // arroba (categoria não-aleatória)
    const pct =
      cfg.modo_percentual === "fixo"
        ? cfg.percentual_fixo ?? 0
        : p.percentual_individual ?? 0;
    const pesoPagavel = (p.peso_kg * pct) / 100;
    const arroba = pesoPagavel / 15;
    return {
      ...p,
      peso_pagavel: round2(pesoPagavel),
      arroba_pagavel: round3(arroba),
      valor: round2(arroba * cfg.preco_valor),
    };
  });
}

export function totalizar(animais: AnimalCalc[]) {
  const totalAnimais = animais.length;
  const totalPeso = animais.reduce((s, a) => s + a.peso_kg, 0);
  const totalPagavel = animais.reduce((s, a) => s + (a.peso_pagavel ?? 0), 0);
  const totalArroba = animais.reduce((s, a) => s + (a.arroba_pagavel ?? 0), 0);
  const totalValor = animais.reduce((s, a) => s + a.valor, 0);
  const mediaPeso = totalAnimais ? totalPeso / totalAnimais : 0;
  // Média de @ por animal = @ pagáveis totais ÷ nº de animais
  const mediaArrobaPorAnimal = totalAnimais ? totalArroba / totalAnimais : 0;
  return {
    totalAnimais,
    totalPeso: round2(totalPeso),
    totalPagavel: round2(totalPagavel),
    totalArroba: round3(totalArroba),
    totalValor: round2(totalValor),
    mediaPeso: round2(mediaPeso),
    mediaArrobaPorAnimal: round3(mediaArrobaPorAnimal),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
