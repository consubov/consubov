// Legendas curtas por quesito de avaliação usadas em telas de revisão e PDFs.
// Formato final exibido: `${descricao} (1 = fora do esperado · 5 = dentro do esperado)`.

const DESC: Record<string, string> = {
  fezes: "Avalia a consistência das fezes como indicador de digestão do rebanho.",
  corporal: "Avalia a condição corporal dos animais em relação ao ideal esperado.",
  escore_corporal: "Avalia a condição corporal dos animais em relação ao ideal esperado.",
  bebedouro: "Avalia limpeza e funcionamento dos bebedouros.",
  organizacao_fabrica: "Avalia limpeza, layout e fluxo de trabalho da fábrica.",
  organizacao_geral: "Avalia limpeza, layout e fluxo de trabalho da fábrica.",
  organizacao_insumos: "Avalia condições de estoque, empilhamento e proteção contra umidade.",
  armazenamento_insumos: "Avalia condições de estoque, empilhamento e proteção contra umidade.",
  controle_pragas: "Avalia vedação e sinais de roedores ou insetos.",
  equipamentos_manutencao: "Avalia estado de conservação de misturador, balança e moega.",
  precisao_dosagem: "Avalia calibração de balanças e conferência de fórmulas.",
  seguranca_epi: "Avalia uso de equipamentos de proteção pela equipe.",
  seguranca_epis: "Avalia uso de equipamentos de proteção pela equipe.",
  rotulagem_identificacao: "Avalia se insumos e produtos estão corretamente identificados.",
};

const SUFFIX = "(1 = fora do esperado · 5 = dentro do esperado)";

export function getScoreDescription(key: string): string {
  return DESC[key] || "";
}

export function getScoreLegend(key: string): string {
  const d = getScoreDescription(key);
  return d ? `${d} ${SUFFIX}` : SUFFIX;
}

export const SCORE_SCALE_HINT = SUFFIX;
