/**
 * Contratos da fazenda (fazendas).
 *
 * Fonte das colunas: apps/web/src/integrations/supabase/types.ts:1687-1745.
 *
 * A fazenda NÃO é o tenant. `fazendas` não possui coluna de tenant ou de
 * empresa: o vínculo com o administrador vem de `administrador_id`
 * (types.ts:1689), e as demais tabelas referenciam a fazenda por `fazenda_id`.
 * O mapeamento entre `TenantId` da API e a fazenda não tem prova no legado, por
 * isso nenhum campo deste módulo carrega `TenantId`.
 *
 * Origem dos valores literais:
 * - `intervalo_modo`: apps/web/src/pages/GerenteGmdPage.tsx:24-28 e
 *   supabase/migrations/20260402002445_*.sql:3 (intervalo_padrao_dias NOT NULL
 *   DEFAULT 3).
 * - `gmd_modo`: apps/web/src/pages/GerenteGmdPage.tsx:24-28 e :103-104 (valor
 *   fora desta lista não é gravado pelo aplicativo).
 * - `auditoria_fotos_por_bloco`: supabase/migrations/20260414133311_*.sql:4-5
 *   (CHECK entre 0 e 10).
 */

export type FarmId = string & { readonly __brand: "FarmId" };

const MAX_IDENTIFIER_LENGTH = 128;

export function createFarmId(value: string): FarmId {
  const normalized = value.trim();

  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `Farm id must be non-empty and at most ${MAX_IDENTIFIER_LENGTH} characters.`,
    );
  }

  return normalized as FarmId;
}

/** Alcance do intervalo padrão: a fazenda, um dos seus retiros ou um pasto. */
export type IntervaloModo = "fazenda" | "retiro" | "pasto";

/** Escopo do GMD configurado para a fazenda. */
export type GmdModo = "geral" | "categoria" | "retiro";

export type FarmRecord = {
  readonly id: FarmId;
  readonly nome: string;
  readonly cidade: string;
  readonly estado: string | null;
  /** Referência ao administrador dono; não é um principal de autenticação. */
  readonly administradorId: string | null;
  readonly ativo: boolean | null;
  readonly intervaloPadraoDias: number;
  readonly intervaloModo: IntervaloModo | null;
  readonly auditoriaFotosPorBloco: number | null;
  readonly exigirFotoCocho: boolean | null;
  readonly gmdModo: GmdModo | null;
  readonly veraoMesInicio: number | null;
  readonly veraoMesFim: number | null;
  readonly criadoEm: string | null;
};
