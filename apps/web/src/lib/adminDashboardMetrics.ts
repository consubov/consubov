/** Do not turn failed or incomplete admin queries into numeric zeros. */
export class DashboardQueryError extends Error {
  readonly kind: "permission" | "network" | "invalid_response";
  constructor(kind: "permission" | "network" | "invalid_response") {
    super(kind);
    this.kind = kind;
    this.name = "DashboardQueryError";
  }
}

export type QueryError = { code?: string; message?: string } | null;
export type CountResult = { count: number | null; error: QueryError; status?: number };

function assertSuccessful(error: QueryError, status?: number): void {
  if (!error) return;
  if (status === 401 || status === 403 || error.code === "42501") {
    throw new DashboardQueryError("permission");
  }
  throw new DashboardQueryError("network");
}

export function requireDashboardCount(result: CountResult): number {
  assertSuccessful(result.error, result.status);
  if (typeof result.count !== "number" || !Number.isSafeInteger(result.count) || result.count < 0) {
    throw new DashboardQueryError("invalid_response");
  }
  return result.count;
}

export function requireAnimalTotal(result: {
  data: readonly { num_animais: number | null }[] | null;
  error: QueryError;
  status?: number;
}): number {
  assertSuccessful(result.error, result.status);
  if (!Array.isArray(result.data)) throw new DashboardQueryError("invalid_response");
  return result.data.reduce((total: number, record: { num_animais: number | null }) => {
    const count = record.num_animais;
    if (count === null) return total;
    if (!Number.isSafeInteger(count) || count < 0) throw new DashboardQueryError("invalid_response");
    return total + count;
  }, 0);
}
