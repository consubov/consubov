import type { PrincipalId, TenantId } from "./identity";

/**
 * Explicit context for any tenant-scoped query, command or infrastructure call.
 * Absence of this object never means global access.
 */
export type TenantExecutionContext = {
  tenantId: TenantId;
  principalId: PrincipalId;
  requestId: string;
  correlationId: string;
};

/**
 * Architectural boundaries that must carry tenant context whenever the operation
 * is tenant-scoped. Global operations require their own explicit policy.
 */
export const TENANT_CONTEXT_BOUNDARIES = [
  "queries",
  "commands",
  "files",
  "jobs",
  "events",
  "cache",
  "realtime",
  "reports",
  "sync",
] as const;

export type TenantContextBoundary = (typeof TENANT_CONTEXT_BOUNDARIES)[number];

export type TenantScopedQuery<TQuery> = Readonly<{
  context: TenantExecutionContext;
  query: TQuery;
}>;

export type TenantScopedCommand<TCommand> = Readonly<{
  context: TenantExecutionContext;
  command: TCommand;
}>;

export function createTenantExecutionContext(input: TenantExecutionContext): TenantExecutionContext {
  if (!input.tenantId) throw new Error("tenantId is required");
  if (!input.principalId) throw new Error("principalId is required");
  if (!input.requestId.trim()) throw new Error("requestId is required");
  if (!input.correlationId.trim()) throw new Error("correlationId is required");
  return Object.freeze({ ...input });
}
