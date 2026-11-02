import type { Database } from "@/integrations/supabase/types";
import { DataReadFailure } from "@/lib/dataReadGuard";

/** Only the selected columns needed by both read-only dashboard projections. */
type ViewConsumoRow = Database["public"]["Views"]["view_consumo_tempo_real"]["Row"];

export type ConsumoRowInput = Pick<
  ViewConsumoRow,
  | "id"
  | "pasto_id"
  | "retiro_id"
  | "fazenda_id"
  | "num_sacos"
  | "num_animais"
  | "dias_no_pasto"
  | "mes_referencia"
  | "ano_referencia"
>;

export type ConsumoRowValid<T extends ConsumoRowInput> = T & {
  [K in keyof ConsumoRowInput]-?: NonNullable<ConsumoRowInput[K]>;
};

/**
 * A view may return nullable columns even for a valid SQL response.
 * Do not coerce missing identity/quantities to zero or silently drop rows.
 * Fail closed for a different farm/retiro or an incomplete projection.
 */
export function requireConsumoRows<T extends ConsumoRowInput>(
  rows: readonly T[],
  fazendaId: string,
  retiroIds: readonly string[],
): ConsumoRowValid<T>[] {
  const authorizedRetiroIds = new Set(retiroIds);

  return rows.map((row) => {
    if (
      row.fazenda_id !== fazendaId ||
      row.retiro_id == null ||
      !authorizedRetiroIds.has(row.retiro_id)
    ) {
      throw new DataReadFailure("permission");
    }

    if (
      !row.id ||
      !row.pasto_id ||
      row.num_sacos == null ||
      row.num_animais == null ||
      row.dias_no_pasto == null ||
      row.mes_referencia == null ||
      row.ano_referencia == null
    ) {
      throw new DataReadFailure("invalid_response");
    }

    return row as ConsumoRowValid<T>;
  });
}
