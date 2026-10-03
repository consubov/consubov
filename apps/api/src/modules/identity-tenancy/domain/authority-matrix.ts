export type AuthorityAction =
  | "create_user"
  | "manage_admin"
  | "create_capataz"
  | "self_register_farm"
  | "structural_changes"
  | "approvals"
  | "global_admin_operations";

export type AuthorityDecision =
  | "ADMIN_REQUIRED"
  | "DENY_UNTIL_APPROVED";

/**
 * Evidence-first authority contract.
 *
 * Only create-user/manage-admin have server-side evidence today. Every other
 * action stays closed until an explicit product decision exists.
 */
export const AUTHORITY_MATRIX: Readonly<Record<AuthorityAction, AuthorityDecision>> =
  Object.freeze({
    create_user: "ADMIN_REQUIRED",
    manage_admin: "ADMIN_REQUIRED",
    create_capataz: "DENY_UNTIL_APPROVED",
    self_register_farm: "DENY_UNTIL_APPROVED",
    structural_changes: "DENY_UNTIL_APPROVED",
    approvals: "DENY_UNTIL_APPROVED",
    global_admin_operations: "DENY_UNTIL_APPROVED",
  });

export function getAuthorityDecision(
  action: AuthorityAction,
): AuthorityDecision {
  return AUTHORITY_MATRIX[action];
}
