/**
 * Configurações herdadas: intervalo de salgas e auditoria de fotos da saída.
 * Ambas resolvem por prioridade do nível mais específico (retiro) para o mais
 * genérico (fazenda), terminando no padrão da aplicação.
 */

/** `fazendas.intervalo_padrao_dias` é NOT NULL DEFAULT 3 (supabase/migrations/20260402002445_84520a1d.sql:3). */
export const INTERVALO_PADRAO_DIAS = 3;

export type FontesIntervaloEfetivo = {
  pasto: number | null | undefined;
  retiro: number | null | undefined;
  fazenda: number | null | undefined;
};

/**
 * Intervalo efetivo de um pasto: pasto → retiro → fazenda → 3.
 * A precedência é composta em apps/web/src/lib/scoreCapatazData.ts:117 (pasto),
 * :109 (retiro), :135-136 (pasto ?? retiro) e :56 (fazenda ?? 3).
 */
export function resolverIntervaloEfetivoDias(
  fontes: FontesIntervaloEfetivo,
): number {
  return (
    fontes.pasto ?? fontes.retiro ?? fontes.fazenda ?? INTERVALO_PADRAO_DIAS
  );
}

// apps/web/src/lib/auditoriaConfig.ts:8-9
export const AUDITORIA_FOTOS_PADRAO = 3;
export const EXIGIR_FOTO_COCHO_PADRAO = true;

/**
 * `auditoria_fotos_por_bloco` é aceito de 0 a 10 por CHECK no banco
 * (supabase/migrations/20260414133311_07dc9866.sql:4-5).
 */
export type AuditoriaNivel = {
  auditoria_fotos_por_bloco: number | null;
  exigir_foto_cocho: boolean | null;
};

export type AuditoriaEfetiva = {
  fotosPorBloco: number;
  exigirFotoCocho: boolean;
};

/**
 * Prioridade retiro → fazenda → padrão (3 fotos por bloco, foto de cocho
 * obrigatória). Fonte: apps/web/src/lib/auditoriaConfig.ts:21-29
 */
export function resolverAuditoria(
  retiro: Partial<AuditoriaNivel> | null | undefined,
  fazenda: Partial<AuditoriaNivel> | null | undefined,
): AuditoriaEfetiva {
  return {
    fotosPorBloco:
      retiro?.auditoria_fotos_por_bloco ??
      fazenda?.auditoria_fotos_por_bloco ??
      AUDITORIA_FOTOS_PADRAO,
    exigirFotoCocho:
      retiro?.exigir_foto_cocho ??
      fazenda?.exigir_foto_cocho ??
      EXIGIR_FOTO_COCHO_PADRAO,
  };
}
