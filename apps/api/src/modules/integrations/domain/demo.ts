/**
 * Boundary of the demonstration account signup: how a free-text name becomes a
 * stored name, extracted from `relatto-demo-signup/index.ts:16-17`, `:28-30`.
 *
 * Only the shape rules are modeled. No credential is generated here: the demo
 * address and password are minted by the adapter.
 */

/** Maximum stored name length (`relatto-demo-signup/index.ts:17`). */
export const DEMO_NAME_MAX_LENGTH = 60;

/** Shortest accepted name, applied to each of the two names (`index.ts:28`). */
export const DEMO_NAME_MIN_LENGTH = 2;

/**
 * Cleans a name: trims, collapses every run of whitespace into a single space
 * and truncates to the stored length. A value that is not a string becomes an
 * empty name, which then fails the minimum length check instead of being
 * accepted as absent.
 */
export function cleanDemoName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, DEMO_NAME_MAX_LENGTH)
    : "";
}

/** A cleaned name is accepted only when it reaches the minimum length. */
export function isDemoNameAllowed(name: string): boolean {
  return name.length >= DEMO_NAME_MIN_LENGTH;
}
