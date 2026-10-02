import type { AssinanteId, VisitaId } from "./identificadores";

/**
 * Espelho das colunas de `visita_assinantes` (migrations/20260727015701:1-9;
 * types.ts:6060-6067).
 *
 * `nome` é NOT NULL mas pode ser a string vazia: o app cria a linha já sem nome
 * (AssinaturasSection.tsx:62). Nenhuma regra de preenchimento além disso está
 * comprovada.
 */
export type AssinanteRecord = {
  id: AssinanteId;
  visita_id: VisitaId;
  nome: string;
  cargo_funcao: string;
  ordem: number;
  created_at: string;
  updated_at: string;
};

/** Cargo padrão gravado ao adicionar assinante (AssinaturasSection.tsx:62; migration:5). */
export const CARGO_FUNCAO_PADRAO_ASSINANTE = "Consultor Técnico";

/**
 * Ordem seguinte do assinante: maior `ordem` + 1, com base inicial 0
 * (AssinaturasSection.tsx:61-62).
 */
export function proximaOrdemAssinante(
  assinantes: readonly { ordem: number }[],
): number {
  if (assinantes.length === 0) return 1;

  return assinantes.reduce((maior, assinante) => Math.max(maior, assinante.ordem), 0) + 1;
}