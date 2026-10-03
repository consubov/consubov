import type { PermissionScope, TenantId } from "./identity";

export type ApiConsumerStatus = "active" | "revoked";

export type ApiConsumer = {
  consumerId: string;
  name: string;
  /** Null never implies global access; global consumers require an explicit policy. */
  tenantId: TenantId | null;
  scopes: readonly PermissionScope[];
  status: ApiConsumerStatus;
  /** Opaque reference only. Never store the credential secret in this contract. */
  credentialReference: string;
  createdAt: Date;
  revokedAt: Date | null;
  expiresAt: Date | null;
  origin: string;
};

export type ApiConsumerAuditContext = {
  consumerId: string;
  tenantId: TenantId | null;
  origin: string;
};

/**
 * Quota/rate-limit are represented by policy references only. Numerical limits
 * remain a product/commercial decision and are not invented in the domain.
 */
export type ApiConsumerUsagePolicy = {
  rateLimitPolicyReference?: string;
  quotaPolicyReference?: string;
};

export type ApiConsumerCredentialDecision =
  | { allowed: true }
  | { allowed: false; reason: "revoked" | "expired" };

export function evaluateApiConsumerCredential(
  consumer: ApiConsumer,
  now: Date,
): ApiConsumerCredentialDecision {
  if (consumer.status === "revoked") return { allowed: false, reason: "revoked" };
  if (consumer.expiresAt !== null && consumer.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "expired" };
  }
  return { allowed: true };
}

/** Rotation is represented by replacing only the opaque credential reference. */
export function rotateApiConsumerCredentialReference(
  consumer: ApiConsumer,
  credentialReference: string,
): ApiConsumer {
  const nextReference = credentialReference.trim();
  if (!nextReference) throw new Error("credentialReference is required");
  return { ...consumer, credentialReference: nextReference };
}

export function toApiConsumerAuditContext(consumer: ApiConsumer): ApiConsumerAuditContext {
  return {
    consumerId: consumer.consumerId,
    tenantId: consumer.tenantId,
    origin: consumer.origin,
  };
}
