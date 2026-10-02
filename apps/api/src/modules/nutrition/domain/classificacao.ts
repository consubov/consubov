import { chaveCategoriaConsumo } from "./categoria";
import type { ProdutoMargens } from "./produto";

export type StatusConsumoQuatroEstados =
  | "Baixo"
  | "Atenção"
  | "Ideal"
  | "Alto"
  | "ERRO";

/**
 * Percentuais de margem da categoria. `null` significa "não migrado": o produto
 * ainda não tem margem percentual preenchida e o cálculo cai no caminho legado
 * de margem por 100kg PV.
 * Origem: apps/web/src/lib/consumoCalc.ts:75-87.
 */
export type MargensPctCategoria = {
  mais: number | null;
  menos: number | null;
};

function percentual(valor: number | null | undefined): number | null {
  return valor == null ? null : Number(valor);
}

/**
 * Margens percentuais da categoria informada.
 * Só o par mais/menos totalmente preenchido habilita a classificação de quatro
 * estados; zero é um valor válido e continua habilitando.
 */
export function getPctPorCategoria(
  categoria: string,
  produto: ProdutoMargens,
): MargensPctCategoria {
  switch (chaveCategoriaConsumo(categoria)) {
    case "recria1":
      return {
        mais: percentual(produto.margem_mais_recria1_pct),
        menos: percentual(produto.margem_menos_recria1_pct),
      };
    case "recria2":
      return {
        mais: percentual(produto.margem_mais_recria2_pct),
        menos: percentual(produto.margem_menos_recria2_pct),
      };
    case "engorda":
      return {
        mais: percentual(produto.margem_mais_engorda_pct),
        menos: percentual(produto.margem_menos_engorda_pct),
      };
  }
}

/**
 * Classificação de quatro estados em torno do consumo esperado, com buffer
 * amarelo nas bordas.
 * Origem: apps/web/src/lib/consumoCalc.ts:57-73, que espelha a função IMMUTABLE
 * classificar_consumo em migrations/20260916215502_f68602fc….sql:1-22.
 *
 * Divergência do banco preservada aqui: o banco devolve NULL para esperado igual a
 * zero (…sql:13) e o caminho da aplicação devolve "ERRO", que é o valor que as
 * telas esperam receber.
 */
export function classificarConsumo4(
  consumoG: number,
  esperadoG: number,
  margemMaisPct: number,
  margemMenosPct: number,
  bufferG: number,
): StatusConsumoQuatroEstados {
  if (esperadoG <= 0) return "ERRO";

  const limiteInf = esperadoG * (1 - margemMenosPct / 100);
  const limiteSup = esperadoG * (1 + margemMaisPct / 100);
  const buffer = bufferG > 0 ? bufferG : 0;

  if (consumoG < limiteInf) return "Baixo";
  if (consumoG < limiteInf + buffer) return "Atenção";
  if (consumoG > limiteSup) return "Alto";
  if (consumoG > limiteSup - buffer) return "Atenção";
  return "Ideal";
}
