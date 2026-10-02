/**
 * Aritmética de arredondamento usada nas pesagens. Arredondar e truncar não são
 * equivalentes aqui: a diferença muda o valor pago por animal.
 */

/** Uma casa decimal, como em `media_calculada` e `peso_medio_aplicado`. */
export function arredondar1(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Duas casas decimais, como em `peso_individual` de balançação. */
export function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Duas casas decimais truncadas: nunca sobe. É o arredondamento da arroba
 * pagável (pesagemCompra.ts:66, :98), onde subir uma centésima de arroba
 * acrescenta valor ao produtor.
 */
export function truncar2(valor: number): number {
  return Math.floor(valor * 100) / 100;
}