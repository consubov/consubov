/**
 * Credential and input rules of the existing administration flows, extracted as
 * pure functions. Nothing here talks to a database or to an access provider; the
 * callers keep performing the requests they already perform.
 *
 * The gate order is preserved and stays deny-by-default: configuration, then
 * token, then administrator row (`_shared/auth.ts:68-109`). A missing
 * configuration fails before any credential is read, and a valid token without an
 * active administrator row is never treated as administrator.
 */

/**
 * Extracts the token of a `Bearer` header (`_shared/auth.ts:15-21`): the header
 * must exist, split into exactly two parts and the scheme must be `bearer`
 * case-insensitively.
 *
 * Verbatim behavior kept on purpose: a header ending in a space yields an empty
 * second part, and the push boundary is the place that additionally rejects an
 * empty token (`send-push-notification/index.ts:120`).
 */
export function parseBearerHeader(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  return parts[1];
}

/** Canonical form of an e-mail before comparison or storage (`create-user/index.ts:19`). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Shape check of an e-mail (`create-user/index.ts:22`): exactly one `@`, no
 * whitespace and a dot after the `@`. It validates the shape only, never the
 * existence of the mailbox.
 */
export function isEmailShape(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Minimum password length enforced when a new password is supplied
 * (`manage-admin/index.ts:87-92`, `create-user/index.ts:129-132`). A missing
 * password is not a violation here: whether one is required is decided by the
 * operation, not by this rule.
 */
export const MIN_PASSWORD_LENGTH = 6;

export function isPasswordLengthAllowed(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/**
 * Identifier guard for destructive operations (`syncvet-delete-equipe/index.ts:15-16`).
 *
 * The running guard validates the UUID shape only and does not inspect the
 * version nibble, so a non-v4 UUID in the same shape is accepted today. The name
 * is kept because that is the identifier the repository treats as v4
 * (`gen_random_uuid()`); tightening the check would change behavior and needs
 * its own PRD.
 */
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): boolean {
  return typeof value === "string" && UUID_SHAPE.test(value);
}
