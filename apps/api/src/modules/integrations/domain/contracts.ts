/**
 * Integration boundary contracts.
 *
 * This module is the boundary of the adapters that already exist in the
 * repository — the ten edge functions under `functions/` — and nothing
 * more. It does not expand any integration: no new channel, no campaign, no
 * artificial intelligence flow, no file upload (there is no upload edge function
 * and no campaign table, route or type in the repository).
 *
 * The caller identity is always established on the server side; nothing in the
 * payload can prove who is calling (`send-push-notification/index.ts:34-35`,
 * `:73-74`).
 *
 * [PENDENTE] webhook signature: no edge function and no API module verifies an
 * HMAC or a `x-signature` header — zero occurrences in the repository — so no
 * signature contract was invented here.
 * [PENDENTE] integration idempotency: there is no idempotency key anywhere in the
 * repository, so a replayed push is a replayed push.
 * [PENDENTE] retry, timeout and circuit breaker: no edge function implements any
 * of them today; only the local send loop exists
 * (`send-push-notification/index.ts:620-649`).
 */

/**
 * The caller is a machine or a human. The distinction drives the authorization
 * rules and the rate limit (`send-push-notification/index.ts:36-38`).
 */
export type IntegrationCaller =
  | {
      type: "machine";
    }
  | {
      type: "human";
      userId: string;
    };

/**
 * Audience of one request (`send-push-notification/index.ts:40-44`). A request
 * carries one selection per audience, never a single merged audience.
 */
export type IntegrationSelection =
  | {
      kind: "fazenda";
      fazendaId: string;
    }
  | {
      kind: "fabrica";
      fabricaId: string;
    }
  | {
      kind: "admins";
    }
  | {
      kind: "users";
      userIds: readonly string[];
    };

/**
 * Reasons a request is refused. The set is exactly the reasons the existing
 * boundary emits — no other outcome is invented.
 */
export type IntegrationDenyReason =
  | "payload_invalido"
  | "sem_selecao"
  | "sem_destinos"
  | "selecao_proibida"
  | "escopo_negado"
  | "broadcast_proibido"
  | "rate_limit";

/** Status each reason answers with (`send-push-notification/index.ts:528`, `:543`, `:552`, `:562`, `:579`, `:617`). */
export const DENY_STATUS_BY_REASON: Readonly<
  Record<IntegrationDenyReason, 400 | 403 | 429>
> = {
  payload_invalido: 400,
  sem_selecao: 400,
  sem_destinos: 400,
  selecao_proibida: 403,
  escopo_negado: 403,
  broadcast_proibido: 403,
  rate_limit: 429,
};

/**
 * Normalized request body. Keys keep the wire spelling used by the existing
 * boundary (`send-push-notification/index.ts:22-32`); a field is present only
 * after its type check passed.
 */
export type IntegrationPayload = {
  title?: string;
  body?: string;
  url?: string;
  user_id?: string;
  user_ids?: string[];
  fazenda_id?: string;
  fabrica_id?: string;
  admins_only?: boolean;
  all?: boolean;
};

/** Content actually sent, after defaults (`send-push-notification/index.ts:600-602`). */
export type IntegrationContent = {
  title: string;
  body: string;
  url: string;
};

/** Default title when the request omits it. */
export const INTEGRATION_DEFAULT_TITLE = "Consubov";

/** Default body when the request omits it: an empty text, not an error. */
export const INTEGRATION_DEFAULT_BODY = "";

/** Default deep link when the request omits it: the application root. */
export const INTEGRATION_DEFAULT_URL = "/";

/** Result of one subscription (`send-push-notification/index.ts:652-660`). */
export type IntegrationDeliveryResult = {
  id: string;
  ok: boolean;
  status?: number;
};

/** Response of a delivery (`send-push-notification/index.ts:676`). */
export type IntegrationDeliveryReport = {
  total: number;
  sent: number;
  results: IntegrationDeliveryResult[];
};
