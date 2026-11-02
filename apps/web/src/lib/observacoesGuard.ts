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
export function isObservationAccessDenied(
  error: { code?: string; status?: number } | null | undefined, httpStatus?: number,
): boolean {
  // PostgREST reports HTTP status on the response, not always on error.
  return error?.code === "42501" || error?.status === 401 || error?.status === 403 ||
    httpStatus === 401 || httpStatus === 403;
}
const INVALID_OBSERVATION = "Não foi possível confirmar os dados de observações.";

function rowsOrThrow<T>(result: ObservationResult<T>): T[] {
  if (result.error || !Array.isArray(result.data)) throw new Error(INVALID_OBSERVATION);
  return result.data;
}
export function confirmObservationRead<T extends ObservationIdentity>(
  result: ObservationResult<T>, farmId: string,
): T[] {
  if (!farmId.trim()) throw new Error(INVALID_OBSERVATION);
  const ids = new Set<string>();
  return rowsOrThrow(result).map(row => {
    if (!row || typeof row.id !== "string" || !row.id ||
        row.fazenda_id !== farmId || ids.has(row.id)) throw new Error(INVALID_OBSERVATION);
    ids.add(row.id);
    return row;
  });
}
export function confirmObservationResolved<T extends ObservationResolved>(
  result: ObservationResult<T>, id: string, farmId: string,
): T {
  if (!id || !farmId) throw new Error(INVALID_OBSERVATION);
  const rows = rowsOrThrow(result);
  if (rows.length !== 1) throw new Error(INVALID_OBSERVATION);
  const row = rows[0];
  if (!row || row.id !== id || row.fazenda_id !== farmId ||
      row.resolvido !== true || !row.resolvido_em ||
      !Number.isFinite(Date.parse(row.resolvido_em))) throw new Error(INVALID_OBSERVATION);
  return row;
}
export function isObservationContextCurrent(
  expectedContext: string, activeContext: string, requestId: number, latestRequestId: number,
): boolean {
  return !!expectedContext && expectedContext === activeContext &&
    requestId === latestRequestId;
}

// Confirm an offline retry by immutable identity/content, even if already resolved.
export interface ObservationUploadAck extends ObservationIdentity {
  retiro_id: string | null;
  pasto_id: string | null;
  capataz_nome: string | null;
  tipo: string | null;
  descricao: string | null;
  foto_url: string | null;
}
export function confirmObservationSynced<T extends ObservationUploadAck>(
  result: ObservationResult<T>, expected: ObservationUploadAck,
): void {
  const rows = rowsOrThrow(result);
  const fields = ["id", "fazenda_id", "retiro_id", "pasto_id", "capataz_nome",
    "tipo", "descricao", "foto_url"] as const;
  if (rows.length !== 1 || fields.some(field => rows[0]?.[field] !== expected[field])) {
    throw new Error(INVALID_OBSERVATION);
  }
}


// Fail closed when the active farm/retiro is missing or differs from the local row.
export const observationInScope = (
  row: { fazenda_id: string; retiro_id: string | null },
  farm?: string | null, retiro?: string | null,
): boolean => !!farm && !!retiro && row?.fazenda_id === farm && row.retiro_id === retiro;
