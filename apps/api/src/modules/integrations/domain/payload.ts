/**
 * Normalization of an integration request body and the audiences derived from
 * it. Pure rules, extracted from `send-push-notification/index.ts:338-405`.
 *
 * The type checks are strict on purpose: a field with the wrong type rejects the
 * whole request, while a field with the right type but no useful value is
 * rejected only when it is an audience selector. Boolean fields are coerced, so
 * the string "false" is truthy exactly like it is today.
 */
import type {
  IntegrationContent,
  IntegrationPayload,
  IntegrationSelection,
} from "./contracts";
import {
  INTEGRATION_DEFAULT_BODY,
  INTEGRATION_DEFAULT_TITLE,
  INTEGRATION_DEFAULT_URL,
} from "./contracts";

/**
 * Normalizes an unknown request body, returning null when it cannot be accepted.
 * A root value that is not a plain object — null, array or any other type — is
 * refused (`send-push-notification/index.ts:339`).
 */
export function normalizeIntegrationPayload(
  raw: unknown,
): IntegrationPayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const input = raw as Record<string, unknown>;
  const payload: IntegrationPayload = {};

  if (typeof input.title === "string") payload.title = input.title;
  if (typeof input.body === "string") payload.body = input.body;
  if (typeof input.url === "string") payload.url = input.url;

  if (input.fazenda_id !== undefined && input.fazenda_id !== null) {
    if (typeof input.fazenda_id !== "string" || !input.fazenda_id) return null;
    payload.fazenda_id = input.fazenda_id;
  }
  if (input.fabrica_id !== undefined && input.fabrica_id !== null) {
    if (typeof input.fabrica_id !== "string" || !input.fabrica_id) return null;
    payload.fabrica_id = input.fabrica_id;
  }
  if (input.user_id !== undefined && input.user_id !== null) {
    if (typeof input.user_id !== "string" || !input.user_id) return null;
    payload.user_id = input.user_id;
  }
  if (input.user_ids !== undefined && input.user_ids !== null) {
    if (!Array.isArray(input.user_ids)) return null;
    if (!input.user_ids.every((id) => typeof id === "string" && id.length > 0)) {
      return null;
    }
    payload.user_ids = input.user_ids as string[];
  }
  if (input.admins_only !== undefined && input.admins_only !== null) {
    payload.admins_only = Boolean(input.admins_only);
  }
  if (input.all !== undefined && input.all !== null) {
    payload.all = Boolean(input.all);
  }

  return payload;
}

/**
 * User identities addressed directly, without duplicates and with `user_id`
 * first (`send-push-notification/index.ts:376-383`).
 */
export function collectUserTargets(payload: IntegrationPayload): string[] {
  const targets: string[] = [];

  if (payload.user_id) targets.push(payload.user_id);
  for (const id of payload.user_ids ?? []) {
    if (!targets.includes(id)) targets.push(id);
  }

  return targets;
}

/**
 * Audiences of a normalized request, in the proven order: farm, factory,
 * administrators, users (`send-push-notification/index.ts:385-392`).
 */
export function buildIntegrationSelections(
  payload: IntegrationPayload,
  targets: readonly string[],
): IntegrationSelection[] {
  const selections: IntegrationSelection[] = [];

  if (payload.fazenda_id) {
    selections.push({ kind: "fazenda", fazendaId: payload.fazenda_id });
  }
  if (payload.fabrica_id) {
    selections.push({ kind: "fabrica", fabricaId: payload.fabrica_id });
  }
  if (payload.admins_only) selections.push({ kind: "admins" });
  if (targets.length > 0) selections.push({ kind: "users", userIds: [...targets] });

  return selections;
}

/**
 * Content defaults of an absent field: the product name as title, an empty text
 * and the application root (`send-push-notification/index.ts:600-602`).
 */
export function defaultIntegrationContent(
  payload: IntegrationPayload,
): IntegrationContent {
  return {
    title: typeof payload.title === "string" ? payload.title : INTEGRATION_DEFAULT_TITLE,
    body: typeof payload.body === "string" ? payload.body : INTEGRATION_DEFAULT_BODY,
    url: typeof payload.url === "string" ? payload.url : INTEGRATION_DEFAULT_URL,
  };
}
