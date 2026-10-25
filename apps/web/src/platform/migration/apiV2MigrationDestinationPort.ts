import { z } from "zod";
import { createApiClient } from "@/lib/api/apiClient";
import { DEFAULT_API_TIMEOUT_MS } from "@/lib/api/apiConfig";
import type {
  DestinationIdentity,
  DestinationMigrationPort,
  HydrationProof,
  RedeemedMigration,
} from "./receiveV2Migration";
import { TRANSFERABLE_DATABASES } from "./oneTouchMigrationFlow";

/**
 * Contract for the authenticated migration backend. Requests use a real
 * Auth access token; the SERVER must derive user identity and tenant from it.
 */
const identitySchema = z.object({
  tenantId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
});

const migrationSchema = identitySchema.extend({
  migrationId: z.string().min(1).max(128),
  sourceSnapshotId: z.string().min(1).max(128),
  expectedDatabases: z.array(z.enum(TRANSFERABLE_DATABASES as [
    (typeof TRANSFERABLE_DATABASES)[number],
    ...(typeof TRANSFERABLE_DATABASES)[number][],
  ])).length(TRANSFERABLE_DATABASES.length),
  expiresAt: z.string().datetime({ offset: true }),
});

export interface V2MigrationApiOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /**
   * Writes server-authorized records/blobs to the appropriate NEW local stores
   * and verifies durability. A synthetic or no-op proof is forbidden.
   */
  hydrateVerifiedData?: (receipt: RedeemedMigration) => Promise<HydrationProof>;
}

export function createV2MigrationApiPort(
  options: V2MigrationApiOptions,
): DestinationMigrationPort {
  const client = createApiClient({
    baseUrl: options.baseUrl,
    defaultTimeoutMs: DEFAULT_API_TIMEOUT_MS,
  });

  async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const token = await options.getAccessToken();
    if (!token || !options.baseUrl.trim()) throw new Error("MIGRATION_BACKEND_UNAVAILABLE");
    return client.request<T>(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      headers: { Authorization: "Bearer " + token, "cache-control": "no-store" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  return {
    async currentIdentity(): Promise<DestinationIdentity | null> {
      const result = await call<unknown>("/api/v1/migration/me", "GET");
      return identitySchema.parse(result);
    },
    async redeemOneTimeReference(code): Promise<RedeemedMigration> {
      if (!/^[A-Za-z0-9_-]{20,160}$/.test(code)) throw new Error("INVALID_REFERENCE");
      const result = await call<unknown>("/api/v1/migration/redeem", "POST", { code });
      return migrationSchema.parse(result);
    },
    async findVerifiedMigrationForIdentity(identity): Promise<RedeemedMigration | null> {
      // No userId or tenantId in request: backend derives both from JWT.
      const result = await call<unknown>("/api/v1/migration/pending", "GET");
      if (result === null) return null;
      const parsed = migrationSchema.parse(result);
      if (parsed.tenantId !== identity.tenantId || parsed.userId !== identity.userId) {
        throw new Error("TENANT_MISMATCH");
      }
      return parsed;
    },
    async hydrateAuthorizedData(receipt): Promise<HydrationProof> {
      if (!options.hydrateVerifiedData) {
        // Never invent a success or create an empty recovered local database.
        throw new Error("HYDRATION_ADAPTER_NOT_CONFIGURED");
      }
      return options.hydrateVerifiedData(receipt);
    },
    async confirmDestinationReady(proof): Promise<void> {
      await call<unknown>("/api/v1/migration/complete", "POST", proof);
    },
  };
}
