import type { PrincipalId } from "../../identity-tenancy";
import type { VisitaId } from "./identificadores";

/**
 * `tipo` é a única variante de visita comprovada pelo CHECK atual
 * (migrations/20260805195314:2) e pelos quatro usos reais no app:
 * rotina (padrão do CHECK inicial, migrations/20260706181225:35), confinamento e
 * fabrica (apps/web/src/pages/VisitaTecnicaPage.tsx:237,240) e conferencia_admin
 * (apps/web/src/lib/conferenciaAdminVisita.ts:11).
 */
export const VISITA_TIPOS = [
  "rotina",
  "confinamento",
  "fabrica",
  "conferencia_admin",
] as const;

export type VisitaTipo = (typeof VISITA_TIPOS)[number];

/**
 * `status` reproduz o CHECK vigente (migrations/20260805195314:4), que é a união
 * de 'rascunho'|'finalizada' (migrations/20260706181225:36),
 * 'rascunho'|'revisao'|'finalizada' (migrations/20260706225527:19) e
 * 'em_andamento' (migrations/20260805195314:4).
 *
 * Semântica comprovada de cada valor:
 * - rascunho: valor padrão do CHECK inicial (migrations/20260706181225:36);
 * - revisao: gravado por `confirmarRevisao` (RevisaoVisitaPage.tsx:651) e pela
 *   reabertura de visita finalizada (RevisaoVisitaPage.tsx:494);
 * - finalizada: gravado com `hora_fim` (VisitaTecnicaPage.tsx:220-221),
 *   dentro do gerarPdf (RevisaoVisitaPage.tsx:827-828) e ao encerrar a
 *   conferência do admin (conferenciaAdminVisita.ts:407);
 * - em_andamento: gravado apenas ao criar a conferência do admin
 *   (conferenciaAdminVisita.ts:121). O fluxo do consultor (rotina, confinamento e
 *   fabrica) nunca grava este valor: VisitaTecnicaPage.tsx:220 e
 *   RevisaoVisitaPage.tsx:494,651,827 gravam somente finalizada/revisao.
 */
export const VISITA_STATUS = [
  "rascunho",
  "revisao",
  "finalizada",
  "em_andamento",
] as const;

export type VisitaStatus = (typeof VISITA_STATUS)[number];

/** `tipo = conferencia_admin`: administrador preenchido e consultor nulo (conferenciaAdminVisita.ts:115-121). */
export const VISITA_TIPO_CONFERENCIA_ADMIN: VisitaTipo = "conferencia_admin";

/** Colunas da tabela de indicadores do relatório (RevisaoVisitaPage.tsx:54-57,59). */
export const VISITA_INDICADOR_CHAVES = [
  "lotes_avaliados",
  "animais_avaliados",
  "peso_medio_rebanho",
  "estrategias_nutricionais",
  "score_corporal",
  "score_fezes",
  "condicao_bebedouros",
  "qualidade_pastagens",
  "taxa_lotacao",
  "taxa_lotacao_ha",
] as const;

export type VisitaIndicadorChave = (typeof VISITA_INDICADOR_CHAVES)[number];

export type VisitaIndicadorLinha = {
  key: VisitaIndicadorChave;
  label: string;
  value: string;
};

/**
 * Espelho das colunas de `visitas_tecnicas` (types.ts:6404-6430). Nenhuma coluna
 * é inventada e nenhuma é omitida: `indicadores_tabela` é gravado com a lista de
 * linhas montada em RevisaoVisitaPage.tsx:737-740,803.
 */
export type VisitaRecord = {
  id: VisitaId;
  tipo: VisitaTipo;
  status: VisitaStatus;
  /**
   * O dono da identidade é `identity-tenancy`; as colunas referenciam
   * `consultores.id` (types.ts:6494-6499) e `administradores.id`
   * (types.ts:6487-6492).
   */
  consultor_id: PrincipalId | null;
  administrador_id: PrincipalId | null;
  /** Referência a `fazendas_consultor.id` (types.ts:6501-6506). */
  fazenda_consultor_id: string | null;
  /** Referência a `fazendas.id`, usada pela conferência do admin (types.ts:6508-6513). */
  fazenda_id: string | null;
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  objetivo_visita: string | null;
  resumo_executivo: string | null;
  area_total_alqueires: number | null;
  indicadores_gerais: string | null;
  indicadores_tabela: readonly VisitaIndicadorLinha[] | null;
  pdf_url: string | null;
  deleted_at: string | null;
  consultor_nome_override: string | null;
  data_override: string | null;
  fazenda_nome_override: string | null;
  localizacao_override: string | null;
  proprietario_override: string | null;
  responsavel_override: string | null;
  created_at: string;
};