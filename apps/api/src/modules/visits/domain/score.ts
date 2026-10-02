/** Tipos aceitos pelo CHECK de `avaliacoes_score.tipo` (migrations/20260706181225:69). */
export const SCORE_TIPOS = ["fezes", "corporal", "bebedouro"] as const;

export type ScoreTipo = (typeof SCORE_TIPOS)[number];

/** `nota BETWEEN 1 AND 5`, inteiro (migrations/20260706181225:70). */
export const NOTA_SCORE_MINIMA = 1;
export const NOTA_SCORE_MAXIMA = 5;

/**
 * Espelho das colunas de `avaliacoes_score` (types.ts:588-593). As duas
 * referências são nuláveis porque o mesmo conjunto de pontuações atende ao pasto
 * da rotina e ao curral do confinamento (types.ts:610-623); o DDL de origem
 * exigia `visita_pasto_id` NOT NULL (migrations/20260706181225:68).
 */
export type AvaliacaoScoreRecord = {
  id: string;
  visita_pasto_id: string | null;
  visita_curral_id: string | null;
  tipo: ScoreTipo;
  nota: number;
};

/**
 * A nota só é válida como inteiro de 1 a 5: é o CHECK do banco
 * (migrations/20260706181225:70) e o único conjunto oferecido na tela, que só
 * habilita os botões 1..5
 * (apps/web/src/components/consultor/ScoreSamplesInput.tsx:51).
 * Não há arredondamento nem saturação comprovados, então valor inválido é
 * recusado em vez de ajustado.
 */
export function notaScoreValida(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= NOTA_SCORE_MINIMA &&
    valor <= NOTA_SCORE_MAXIMA
  );
}

export function normalizarNotaScore(valor: unknown): number | null {
  return notaScoreValida(valor) ? valor : null;
}

/**
 * Score do relatório = média aritmética simples de todas as amostras de todos
 * os pastos, sem ponderar por quantidade de animais
 * (apps/web/src/pages/RevisaoVisitaPage.tsx:154-157,765-767). Sem amostras o
 * app não formata número e mostra "—" (RevisaoVisitaPage.tsx:158), portanto o
 * agregado puro devolve null.
 */
export function mediaNotasScore(notas: readonly number[]): number | null {
  if (notas.length === 0) return null;

  return notas.reduce((soma, nota) => soma + nota, 0) / notas.length;
}