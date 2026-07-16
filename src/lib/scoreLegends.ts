// Legendas curtas por quesito de avaliação usadas em telas de revisão e PDFs.
// A escala 1-5 é agora exibida UMA ÚNICA VEZ ao final da lista (via SCORE_SCALE_HINT).

const DESC: Record<string, string> = {
  fezes: "Avalia a consistência das fezes como indicador de digestão do rebanho.",
  corporal: "Avalia a condição corporal dos animais em relação ao ideal esperado.",
  escore_corporal: "Avalia a condição corporal dos animais em relação ao ideal esperado.",
  bebedouro: "Avalia limpeza e funcionamento dos bebedouros.",
  organizacao_fabrica: "Avalia limpeza e fluxo de trabalho da fábrica.",
  organizacao_geral: "Avalia limpeza e fluxo de trabalho da fábrica.",
  organizacao_insumos: "Avalia condições de estoque, empilhamento e proteção contra umidade.",
  armazenamento_insumos: "Avalia condições de estoque, empilhamento e proteção contra umidade.",
  controle_pragas: "Avalia vedação e sinais de roedores ou insetos.",
  equipamentos_manutencao: "Avalia estado de conservação de misturador, balança e moega.",
  precisao_dosagem: "Avalia calibração de balanças e conferência de fórmulas.",
  seguranca_epi: "Avalia uso de equipamentos de proteção pela equipe.",
  seguranca_epis: "Avalia uso de equipamentos de proteção pela equipe.",
  rotulagem_identificacao: "Avalia se insumos e produtos estão corretamente identificados.",
};

export const SCORE_SCALE_HINT = "Escala: 1 = fora do esperado · 5 = dentro do esperado";

export function getScoreDescription(key: string): string {
  return DESC[key] || "";
}

/**
 * Retorna apenas a descrição específica do quesito, sem a escala.
 * A escala 1-5 deve ser exibida uma única vez ao final da lista via `SCORE_SCALE_HINT`.
 */
export function getScoreLegend(key: string): string {
  return getScoreDescription(key);
}
