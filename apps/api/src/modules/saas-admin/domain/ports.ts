/**
 * Ports of the platform administration boundary. They describe what an adapter
 * must be able to answer for the existing operations to keep working; no
 * implementation ships with this module.
 */
import type { AuthUserId, GlobalAdminId, GlobalAdminRecord, SyncVetProfile } from "./contracts";

/**
 * Directory of global administrators (`administradores` rows with `ativo = true`).
 * Read only: this module introduces no administrative write operation.
 */
export interface PlatformAdminDirectory {
  findActiveByAuthUserId(authUserId: AuthUserId): Promise<GlobalAdminRecord | null>;
  countActive(): Promise<number | null>;
  findByEmail(email: string): Promise<GlobalAdminRecord | null>;
}

/**
 * Credentials gateway. The methods below are the ones the existing flows already
 * perform; no credential operation is added here.
 */
export interface CredentialsGateway {
  /** Resolves the identity proven by an access token (`_shared/auth.ts:89`). */
  verifyAccessToken(token: string): Promise<AuthUserId | null>;
  /** Removes the access of a linked administrator (`manage-admin/index.ts:163`). */
  deleteAccess(authUserId: AuthUserId): Promise<void>;
}

/**
 * Membership of a SyncVet team, used for the company scope: the same company as
 * the target, or a global administrator
 * (`syncvet-delete-equipe/index.ts:81-100`).
 */
export interface CompanyMembershipReader {
  findActiveMembership(
    authUserId: AuthUserId,
  ): Promise<{ membershipId: string; companyId: string; profile: SyncVetProfile } | null>;
}

/** Identity of a caller, always proven by a token and never by a request body. */
export type AdminCaller = {
  admin: GlobalAdminRecord;
  authUserId: AuthUserId;
};

/** Minimal reference used when an operation only needs the target row identity. */
export type AdminTarget = {
  adminId: GlobalAdminId;
};
