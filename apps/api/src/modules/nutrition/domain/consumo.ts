import { calcularCategoriaViva, chaveCategoriaConsumo } from "./categoria";
import {
  classificarConsumo4,
  getPctPorCategoria,
  type StatusConsumoQuatroEstados,
} from "./classificacao";
import type {
  ProdutoConsumoPorCategoria,
  ProdutoMargemPorCategoria,
  ProdutoMargens,
} from "./produto";

/** Caminho de três estados para produto ainda não migrado a margens percentuais. */
export type StatusConsumoLegado = "ABAIXO" | "ACIMA" | "IDEAL" | "ERRO";

/** Classificação única por índice, usada em painel, relatório e lançamentos. */
export type StatusConsumoUnificado = "Baixo" | "Ideal" | "Alto" | "—";

export type ConsumoInput = {
  num_sacos: number;
  peso_saco_kg: number;
  num_animais: number;
  /** dias_intervalo (lançamento por QR) ou dias_no_pasto (lançamento manual). */
  dias: number;
  peso_medio_kg: number;
  /** consumo esperado por 100kg PV, já resolvido para a categoria. */
  consumo_por_100kg_categoria: number;
  /** margem legada por 100kg PV, já resolvida para a categoria. */
  margem: number;
  sexo?: string | null;
  /** produto completo habilita categoria ao vivo e classificação de quatro estados. */
  produto?: ProdutoMargens | null;
};

export type ConsumoResult = {
  consumo_real_g_cab_dia: number;
  consumo_esperado_g_cab_dia: number;
  consumo_real_kg: number;
  consumo_esperado_kg: number;
  indice_consumo: number;
  status_consumo: StatusConsumoQuatroEstados | StatusConsumoLegado;
};

const arredondarDuasCasas = (valor: number): number =>
  Number(valor.toFixed(2));

/**
 * Consumo por categoria viva (kg por 100kg PV), com 0 quando a coluna está vazia.
 * Origem: apps/web/src/lib/consumoCalc.ts:258-266.
 */
export function getConsumoPorCategoria(
  categoria: string,
  produto: ProdutoConsumoPorCategoria,
): number {
  switch (chaveCategoriaConsumo(categoria)) {
    case "recria1":
      return Number(produto.consumo_recria1 || 0);
    case "recria2":
      return Number(produto.consumo_recria2 || 0);
    case "engorda":
      return Number(produto.consumo_engorda || 0);
  }
}

/**
 * Margem legada por categoria viva (por 100kg PV), com 0 quando a coluna está vazia.
 * Origem: apps/web/src/lib/consumoCalc.ts:271-279.
 */
export function getMargemPorCategoria(
  categoria: string,
  produto: ProdutoMargemPorCategoria,
): number {
  switch (chaveCategoriaConsumo(categoria)) {
    case "recria1":
      return Number(produto.margem_recria1 || 0);
    case "recria2":
      return Number(produto.margem_recria2 || 0);
    case "engorda":
      return Number(produto.margem_engorda || 0);
  }
}

/**
 * Cálculo de consumo de um lançamento.
 * Origem: apps/web/src/lib/consumoCalc.ts:111-190.
 *
 * Regras preservadas, na ordem em que decidem:
 * - sem animais, dias ou peso de saco não há consumo calculável (retorna null);
 * - a categoria viva (peso + sexo) tem precedência sobre qualquer categoria salva;
 * - coluna de consumo/margem da categoria viva em zero ou vazia cede lugar ao
 *   valor já informado na entrada, porque a coluna ausente é indício de produto
 *   não migrado e não de consumo zero;
 * - sem consumo esperado o resultado é "ERRO" com todos os derivados zerados;
 * - com percentuais de margem da categoria preenchidos classifica em quatro
 *   estados, senão usa a margem legada, senão cai no índice 0.8/1.2.
 */
export function calcularConsumo(input: ConsumoInput): ConsumoResult | null {
  const {
    num_sacos,
    peso_saco_kg,
    num_animais,
    dias,
    peso_medio_kg,
    produto,
    sexo,
  } = input;

  if (num_animais <= 0 || dias <= 0 || peso_saco_kg <= 0) return null;

  const categoriaViva = calcularCategoriaViva(peso_medio_kg, sexo);

  const consumo_por_100kg_categoria = produto
    ? getConsumoPorCategoria(categoriaViva, produto) ||
      input.consumo_por_100kg_categoria
    : input.consumo_por_100kg_categoria;
  const margem = produto
    ? getMargemPorCategoria(categoriaViva, produto) || input.margem
    : input.margem;

  const consumo_real_g_cab_dia =
    ((num_sacos * peso_saco_kg) / (num_animais * dias)) * 1000;
  const consumo_real_kg = num_sacos * peso_saco_kg;

  const consumo_esperado_g_cab_dia =
    ((consumo_por_100kg_categoria * peso_medio_kg) / 100) * 1000;
  const consumo_esperado_kg =
    (consumo_esperado_g_cab_dia / 1000) * num_animais * dias;

  if (consumo_esperado_g_cab_dia <= 0) {
    return {
      consumo_real_g_cab_dia,
      consumo_esperado_g_cab_dia: 0,
      consumo_real_kg,
      consumo_esperado_kg: 0,
      indice_consumo: 0,
      status_consumo: "ERRO",
    };
  }

  const indice_consumo = arredondarDuasCasas(
    consumo_real_kg / consumo_esperado_kg,
  );

  const pct = produto
    ? getPctPorCategoria(categoriaViva, produto)
    : { mais: null, menos: null };

  let status_consumo: StatusConsumoQuatroEstados | StatusConsumoLegado;

  if (produto && pct.mais != null && pct.menos != null) {
    status_consumo = classificarConsumo4(
      consumo_real_g_cab_dia,
      consumo_esperado_g_cab_dia,
      pct.mais,
      pct.menos,
      Number(produto.amarelo_buffer_g ?? 0),
    );
  } else {
    // margem legada é por 100kg PV: escala pelo peso médio para g/cab/dia
    const margem_g = margem * peso_medio_kg * 10;

    if (margem_g > 0) {
      if (consumo_real_g_cab_dia < consumo_esperado_g_cab_dia - margem_g) {
        status_consumo = "ABAIXO";
      } else if (consumo_real_g_cab_dia > consumo_esperado_g_cab_dia + margem_g) {
        status_consumo = "ACIMA";
      } else {
        status_consumo = "IDEAL";
      }
    } else {
      status_consumo =
        indice_consumo < 0.8
          ? "ABAIXO"
          : indice_consumo > 1.2
            ? "ACIMA"
            : "IDEAL";
    }
  }

  return {
    consumo_real_g_cab_dia,
    consumo_esperado_g_cab_dia,
    consumo_real_kg,
    consumo_esperado_kg,
    indice_consumo,
    status_consumo,
  };
}

/**
 * Classificação por índice de consumo, única para painel, relatório e lançamentos.
 * Índice <= 0 significa "sem esperado conhecido" e não é classificado.
 * Origem: apps/web/src/lib/consumoCalc.ts:208-213.
 */
export function consumoStatusUnificado(indice: number): StatusConsumoUnificado {
  if (indice <= 0) return "—";
  if (indice < 0.8) return "Baixo";
  if (indice <= 1.2) return "Ideal";
  return "Alto";
}

/**
 * Índice real / esperado, nas mesmas unidades. Zero quando qualquer lado não é positivo.
 * Origem: apps/web/src/lib/consumoCalc.ts:220-223.
 */
export function calcIndiceConsumo(
  consumoReal: number,
  consumoEsperado: number,
): number {
  if (consumoEsperado <= 0 || consumoReal <= 0) return 0;
  return consumoReal / consumoEsperado;
}

/**
 * Consumo esperado em g/cab/dia a partir da recomendação por 100kg de peso vivo.
 * Origem: apps/web/src/lib/consumoCalc.ts:230-233.
 */
export function calcConsumoEsperadoGCabDia(
  consumoPor100kg: number,
  pesoMedioKg: number,
): number {
  if (consumoPor100kg <= 0 || pesoMedioKg <= 0) return 0;
  return ((consumoPor100kg * pesoMedioKg) / 100) * 1000;
}

/**
 * Consumo real em g/cab/dia a partir de sacos, peso do saco, animais e dias.
 * Origem: apps/web/src/lib/consumoCalc.ts:239-247.
 */
export function calcConsumoGCabDia(
  numSacos: number,
  pesoSacoKg: number,
  numAnimais: number,
  dias: number,
): number {
  if (numAnimais <= 0 || dias <= 0 || numSacos <= 0 || pesoSacoKg <= 0) return 0;
  return (numSacos * pesoSacoKg * 1000) / (numAnimais * dias);
}

export type PeriodoConsumo = {
  numAnimais: number;
  dias: number;
};

/**
 * Consumo em g/cab/dia ponderado por animal-dia, para um período com variações de
 * lotação entre salgas.
 *
 * Exemplo: 200 animais × 15 dias e 100 animais × 15 dias dão 4500 animal-dias;
 * 450 kg consumidos no período resultam em 100 g/cab/dia.
 * Origem: apps/web/src/lib/consumoCalc.ts:295-303.
 */
export function calcConsumoAnimalDia(
  periodos: readonly PeriodoConsumo[],
  totalKgConsumido: number,
): number {
  if (totalKgConsumido <= 0) return 0;

  const totalAnimalDia = periodos.reduce(
    (sum, periodo) => sum + periodo.numAnimais * periodo.dias,
    0,
  );
  if (totalAnimalDia <= 0) return 0;

  return (totalKgConsumido * 1000) / totalAnimalDia;
}
