export type TipoPreco = "arroba" | "kg" | "fixo_animal";
export type ModoPercentual = "fixo" | "aleatorio" | "na";

export interface PesagemCompraCfg {
  tipo_preco: TipoPreco;
  preco_valor: number;
  modo_percentual: ModoPercentual;
  percentual_fixo: number | null;
}

export interface PesoAnimal {
  ordem: number;
  peso_kg: number;
  percentual_individual: number | null;
}

export interface AnimalCalc extends PesoAnimal {
  peso_pagavel: number | null;
  arroba_pagavel: number | null;
  valor: number;
}

/**
 * Calcula o valor a pagar por animal segundo as regras definidas:
 * - arroba: peso_pagavel = peso*(pct/100); @ = peso_pagavel/30; valor = @ * preco
 * - kg:     valor = peso * preco (pct não é usado)
 * - fixo:   valor = preco (peso_kg é só registro)
 */
export function calcularAnimais(cfg: PesagemCompraCfg, pesos: PesoAnimal[]): AnimalCalc[] {
  return pesos.map((p) => {
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
    // arroba
    const pct =
      cfg.modo_percentual === "fixo"
        ? cfg.percentual_fixo ?? 0
        : p.percentual_individual ?? 0;
    const pesoPagavel = (p.peso_kg * pct) / 100;
    const arroba = pesoPagavel / 30;
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
  return {
    totalAnimais,
    totalPeso: round2(totalPeso),
    totalPagavel: round2(totalPagavel),
    totalArroba: round3(totalArroba),
    totalValor: round2(totalValor),
    mediaPeso: totalAnimais ? round2(totalPeso / totalAnimais) : 0,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
