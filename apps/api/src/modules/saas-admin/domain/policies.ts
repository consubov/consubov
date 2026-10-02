/**
 * Guards of the existing global administration operations, extracted as pure
 * decisions. Every guard answers a question the current flows already ask; none
 * of them adds a new operation, and each one defaults to denial.
 *
 * [PENDENTE] persistent audit trail: the flows only log to the console, so no
 * audit decision is modeled here.
 */
import type { AuthUserId, GlobalAdminId } from "./contracts";

/**
 * Self-deletion is blocked, and the comparison uses the identity proven by the
 * token — never an identifier sent in the request body
 * (`manage-admin/index.ts:146-149`; proven by
 * `manage-admin/index.test.ts:152-186`, where `requesting_user_id` from the body
 * is ignored).
 *
 * A target without a linked access is not self-deletion: there is no identity to
 * compare, and blocking it would invent a rule that does not exist.
 */
export function mayDeleteAdmin(input: {
  targetUserId: AuthUserId | null;
  callerAuthUserId: AuthUserId;
}): boolean {
  if (input.targetUserId && input.targetUserId === input.callerAuthUserId) {
    return false;
  }

  return true;
}

/**
 * The last active administrator cannot be removed, which keeps the platform from
 * being left with no global administrator
 * (`manage-admin/index.ts:152-159`). An unknown count is treated as zero, so an
 * unreadable count denies the deletion.
 */
export function mayRemoveLastActiveAdmin(
  activeAdminCount: number | null | undefined,
): boolean {
  return (activeAdminCount ?? 0) > 1;
}

/** A row of `administradores` as far as the e-mail conflict rule needs it. */
export type GlobalAdminEmailRow = {
  id: GlobalAdminId;
  email: string | null;
};

/**
 * Duplicate e-mail detection, excluding the row being updated
 * (`manage-admin/index.ts:66-77`): when the address did not change there is no
 * conflict with itself; otherwise a different row holding the same address
 * blocks the update.
 *
 * Returns the id of the conflicting row, or null when there is none.
 */
export function findEmailConflict(input: {
  normalizedEmail: string;
  currentEmail: string | null | undefined;
  targetAdminId: GlobalAdminId;
  existing: readonly GlobalAdminEmailRow[];
}): GlobalAdminId | null {
  if (input.normalizedEmail === (input.currentEmail ?? "").toLowerCase()) {
    return null;
  }

  const conflict = input.existing.find(
    (row) =>
      row.id !== input.targetAdminId &&
      (row.email ?? "").toLowerCase() === input.normalizedEmail,
  );

  return conflict?.id ?? null;
}

/** Role accepted by the account creation flow (`create-user/index.ts:102-104`). */
export type CreateUserRequestedRole = "administrador" | "usuario" | null;

export type CreateUserIntent = {
  /** Role as accepted from the request: only two values survive, anything else becomes null. */
  requestedRole: CreateUserRequestedRole;
  /** Whether an `administradores` row will be created for the new account. */
  createsGlobalAdminRecord: boolean;
  /** Role the created account receives. */
  grantedRole: "administrador" | "usuario";
};

/**
 * Derivation of the role for a new account, verbatim from
 * `create-user/index.ts:102-106`:
 *
 *   requestedRole = role is "administrador" | "usuario" ? role : null
 *   createsGlobalAdminRecord =
 *     requestedRole === "administrador" || (requestedRole === null && !!nome)
 *   grantedRole = createsGlobalAdminRecord ? "administrador" : "usuario"
 *
 * Preserved behavior, not endorsed: the rule is fail-open. A missing or
 * unrecognized role combined with a name creates a GLOBAL administrator, so
 * "no role informed" means "administrator". The current test asserts exactly that
 * (`create-user/index.test.ts:230-261` expects 201 for an invalid role). Changing
 * this to deny-by-default would change observable behavior and therefore needs its
 * own PRD; this module only names the formula.
 */
export function deriveCreateUserIntent(input: {
  role?: unknown;
  nome?: unknown;
}): CreateUserIntent {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";

  const requestedRole: CreateUserRequestedRole =
    input.role === "administrador" || input.role === "usuario"
      ? input.role
      : null;

  const createsGlobalAdminRecord =
    requestedRole === "administrador" || (requestedRole === null && Boolean(nome));

  return {
    requestedRole,
    createsGlobalAdminRecord,
    grantedRole: createsGlobalAdminRecord ? "administrador" : "usuario",
  };
}

/**
 * An access already linked to another profile of the system cannot be reused to
 * create a global administrator (`create-user/index.ts:185-198`).
 */
export function conflictsWithExistingProfile(input: {
  hasGerenteProfile: boolean;
  hasCapatazProfile: boolean;
}): boolean {
  return input.hasGerenteProfile || input.hasCapatazProfile;
}
