/** UI integrity checks only. Database RLS and atomic sync remain mandatory. */
export interface ObservationIdentity { id: string; fazenda_id: string; }
export interface ObservationResolved extends ObservationIdentity {
  resolvido: boolean;
  resolvido_em: string | null;
  resolvido_por: string | null;
}
export interface ObservationResult<T> {
  data: T[] | null;
  error: { code?: string; message?: string; status?: number } | null;
}
/** A known permission rejection must invalidate stale UI caches, not fall back to them. */
export function isObservationAccessDenied(error: { code?: string; status?: number } | null | undefined): boolean {
  return error?.code === "42501" || error?.status === 401 || error?.status === 403;
}
function rowsOrThrow<T>(result: ObservationResult<T>): T[] {
  if (result.error || !Array.isArray(result.data)) throw new Error("Não foi possível confirmar os dados de observações.");
  return result.data;
}
export function confirmObservationRead<T extends ObservationIdentity>(
  result: ObservationResult<T>, farmId: string,
): T[] {
  if (!farmId.trim()) throw new Error("Fazenda de observação inválida.");
  const ids = new Set<string>();
  return rowsOrThrow(result).map(row => {
    if (!row || typeof row.id !== "string" || !row.id ||
        row.fazenda_id !== farmId || ids.has(row.id)) throw new Error("Dados de observações inconsistentes.");
    ids.add(row.id);
    return row;
  });
}
export function confirmObservationResolved<T extends ObservationResolved>(
  result: ObservationResult<T>, id: string, farmId: string,
): T {
  if (!id || !farmId) throw new Error("Identificação da observação inválida.");
  const rows = rowsOrThrow(result);
  if (rows.length !== 1) throw new Error("Gravação de observação não confirmada.");
  const row = rows[0];
  if (!row || row.id !== id || row.fazenda_id !== farmId ||
      row.resolvido !== true || !row.resolvido_em ||
      !Number.isFinite(Date.parse(row.resolvido_em))) throw new Error("Gravação de observação inconsistente.");
  return row;
}
export function isObservationContextCurrent(
  expectedContext: string, activeContext: string, requestId: number, latestRequestId: number,
): boolean {
  return !!expectedContext && expectedContext === activeContext &&
    requestId === latestRequestId;
}