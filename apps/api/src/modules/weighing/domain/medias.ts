import { arredondar1 } from "./arredondamento";

/**
 * `media_calculada`: média dos PESADOS, gravada com 1 casa
 * (PesagemFlowModal.tsx:98, :148; useOfflinePesagem.ts:162).
 */
export function calcularMediaCalculada(pesos: readonly number[]): number | null {
  if (pesos.length === 0) return null;

  const total = pesos.reduce((soma, peso) => soma + peso, 0);
  return arredondar1(total / pesos.length);
}

/**
 * `peso_medio_aplicado`: média que vai para o pasto depois de combinar os
 * pesados com os que ainda não foram pesados (PesagemFlowModal.tsx:68-77,
 * useOfflinePesagem.ts:174-183).
 *
 * São dois campos diferentes (types.ts:3643-3644): a média dos pesados não é a
 * média aplicada ao pasto.
 *
 * - sem nenhum peso, o pasto continua com a média que já tinha;
 * - com todos os animais pesados, ou sem média anterior válida, a média
 *   aplicada é a média dos pesados;
 * - caso contrário, os não pesados ficam com a média anterior e o total é
 *   reponderado pelo número de animais.
 */
export function calcularPesoMedioAplicado(input: {
  pesos: readonly number[];
  quantidadeAnimais: number;
  pesoMedioAtual: number | null;
}): number | null {
  const { pesos, quantidadeAnimais, pesoMedioAtual } = input;

  if (pesos.length === 0) return pesoMedioAtual;

  const media = pesos.reduce((soma, peso) => soma + peso, 0) / pesos.length;

  if (
    pesos.length >= quantidadeAnimais ||
    pesoMedioAtual == null ||
    pesoMedioAtual <= 0
  ) {
    return arredondar1(media);
  }

  const naoPesados = Math.max(0, quantidadeAnimais - pesos.length);
  const novo =
    (pesoMedioAtual * naoPesados + media * pesos.length) / quantidadeAnimais;

  return arredondar1(novo);
}