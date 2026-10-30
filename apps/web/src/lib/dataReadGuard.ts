/** Distinguishes permission/transport failures from a legitimate empty result.
 * Errors and messages are deliberately sanitized: never show raw SQL/PII in UI.
 */
export type DataReadFailureKind = "permission" | "unavailable" | "invalid_response";

export class DataReadFailure extends Error {
  readonly kind: DataReadFailureKind;
  constructor(kind: DataReadFailureKind) {
    super(kind);
    this.kind = kind;
    this.name = "DataReadFailure";
  }
}

type ReadError = { code?: string } | null;
interface ReadResult<T> {
  data: T | null;
  error: ReadError;
  status?: number;
}

export function assertReadSuccess(result: Pick<ReadResult<unknown>, "error" | "status">): void {
  if (!result.error) return;
  if (result.status === 401 || result.status === 403 || result.error.code === "42501") {
    throw new DataReadFailure("permission");
  }
  throw new DataReadFailure("unavailable");
}

export function requireReadValue<T>(result: ReadResult<T>): T {
  assertReadSuccess(result);
  if (result.data == null) throw new DataReadFailure("invalid_response");
  return result.data;
}

export function requireReadRows<T>(result: ReadResult<readonly T[]>): T[] {
  const rows = requireReadValue(result);
  if (!Array.isArray(rows)) throw new DataReadFailure("invalid_response");
  return rows as T[];
}

export function dataReadErrorMessage(error: unknown): string {
  if (error instanceof DataReadFailure && error.kind === "permission") {
    return "A sessão não conseguiu validar o acesso aos dados desta fazenda. Entre novamente e tente de novo.";
  }
  return "Não foi possível confirmar os dados da fazenda. Verifique a conexão e tente novamente.";
}
