// Regra: pasto com animais (num_animais > 0) precisa ter categoria.
export const CATEGORIAS_PASTO = ["Engorda", "Recria 1", "Recria 2", "Cria"] as const;
export const MSG_CATEGORIA_OBRIGATORIA =
  "Informe a categoria do pasto (Engorda, Recria 1, Recria 2 ou Cria) antes de salvar.";

export function isCategoriaValida(c: string | null | undefined): boolean {
  return !!c && (CATEGORIAS_PASTO as readonly string[]).includes(c);
}

/** true quando o resultado final tem animais e não há categoria válida. */
export function faltaCategoria(numAnimaisFinal: number, categoria: string | null | undefined): boolean {
  return numAnimaisFinal > 0 && !isCategoriaValida(categoria);
}
