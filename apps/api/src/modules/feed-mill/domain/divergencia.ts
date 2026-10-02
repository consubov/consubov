/**
 * Tolerância de divergência da fábrica, em percentual.
 *
 * É o mesmo número nas três checagens de produção (batida finalizada, histórico
 * de batidas, peso da fórmula contra soma de ingredientes) e no recebimento de
 * transferência; na tela de fórmulas e na de transferências ele aparece escrito
 * como literal 5 em vez de constante.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:31, com uso em :433,
 * :731 e :781; apps/web/src/components/fabrica/FormulasTab.tsx:270;
 * apps/web/src/components/fabrica/TransferenciasTab.tsx:515.
 */
export const TOLERANCIA_PCT = 5;

/** A divergência estoura a tolerância quando o módulo passa de 5%, não ao chegar nele. */
export function acimaDaTolerancia(divergenciaPct: number): boolean {
  return Math.abs(divergenciaPct) > TOLERANCIA_PCT;
}

/**
 * Divergência percentual da batida no momento da finalização.
 *
 * Só a produção esperada precisa ser positiva; a quantidade produzida já foi
 * validada como maior que zero antes de chegar aqui, então um zero produziria
 * -100% neste caminho.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:429.
 */
export function divergenciaBatida(
  quantidadeProduzida: number,
  producaoEsperada: number | null | undefined,
): number {
  const esperada = Number(producaoEsperada ?? 0);
  return esperada > 0
    ? ((quantidadeProduzida - esperada) / esperada) * 100
    : 0;
}

/**
 * Divergência percentual da batida já registrada, mostrada no histórico e no
 * detalhe.
 *
 * Diferente de divergenciaBatida, aqui produção zero também produz zero em vez de
 * -100%. A assimetria existe no app e está preservada: as duas telas funcionam
 * como registro do que já foi finalizado.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:730 e :780.
 */
export function divergenciaBatidaRegistrada(
  quantidadeProduzida: number | null | undefined,
  producaoEsperada: number | null | undefined,
): number {
  const esperada = Number(producaoEsperada ?? 0);
  const produzida = Number(quantidadeProduzida ?? 0);
  return esperada > 0 && produzida > 0
    ? ((produzida - esperada) / esperada) * 100
    : 0;
}

/**
 * Divergência entre a soma dos ingredientes e o peso da batida da fórmula.
 * Sem peso de batida não há comparação possível e o resultado é zero.
 * Origem: apps/web/src/components/fabrica/FormulasTab.tsx:96-97.
 */
export function divergenciaPesoBatida(
  totalIngredientesKg: number,
  pesoBatida: number | null | undefined,
): number {
  const peso = Number(pesoBatida ?? 0);
  return peso > 0 ? ((totalIngredientesKg - peso) / peso) * 100 : 0;
}

export type DivergenciaRecebimento = {
  divergenciaSacos: number;
  /** Percentual sem arredondar, que é o valor comparado com a tolerância. */
  divergenciaPercentual: number;
  /** Percentual gravado no recebimento, com duas casas. */
  divergenciaPercentualArmazenada: number;
  acimaDaTolerancia: boolean;
};

/**
 * Divergência de recebimento de transferência entre sacos enviados e recebidos.
 *
 * Sinal: positivo significa falta na origem, negativo significa sobra. Sem
 * quantidade enviada não há percentual. O percentual gravado é arredondado a duas
 * casas, enquanto a comparação com a tolerância usa o valor cheio.
 * Origem: apps/web/src/components/fabrica/TransferenciasTab.tsx:471-473 (alerta em
 * :515, gravação em :484) e apps/web/src/components/gerente/GerenteNotificacoesBell.tsx:101-102 e :113-114.
 */
export function calcularDivergenciaRecebimento(
  quantidadeSacos: number,
  quantidadeRecebida: number,
): DivergenciaRecebimento {
  const divergenciaSacos = quantidadeSacos - quantidadeRecebida;
  const divergenciaPercentual =
    quantidadeSacos > 0 ? (divergenciaSacos / quantidadeSacos) * 100 : 0;

  return {
    divergenciaSacos,
    divergenciaPercentual,
    divergenciaPercentualArmazenada: Number(divergenciaPercentual.toFixed(2)),
    acimaDaTolerancia: acimaDaTolerancia(divergenciaPercentual),
  };
}
