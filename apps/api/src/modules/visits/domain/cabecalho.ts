export const CABECALHO_CHAVES = [
  "fazenda_nome",
  "localizacao",
  "proprietario",
  "responsavel",
  "consultor_nome",
] as const;

export type CabecalhoChave = (typeof CABECALHO_CHAVES)[number];

/** Coluna `*_override` correspondente a cada chave do cabeçalho (RevisaoVisitaPage.tsx:884). */
export const COLUNA_OVERRIDE: Readonly<Record<CabecalhoChave, string>> = {
  fazenda_nome: "fazenda_nome_override",
  localizacao: "localizacao_override",
  proprietario: "proprietario_override",
  responsavel: "responsavel_override",
  consultor_nome: "consultor_nome_override",
};

/**
 * O override só é gravado quando o valor difere do original; valor vazio ou
 * idêntico ao original grava null (apps/web/src/pages/RevisaoVisitaPage.tsx:878-887).
 * A conferência do admin usa a mesma coluna de cabeçalho da visita
 * (apps/web/src/lib/conferenciaAdminVisita.ts:39-47).
 */
export function resolverValorOverride(
  valorDigitado: string,
  valorOriginal: string,
): string | null {
  const valor = valorDigitado.trim();

  return !valor || valor === valorOriginal.trim() ? null : valor;
}