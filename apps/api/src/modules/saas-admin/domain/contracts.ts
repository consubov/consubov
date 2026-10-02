/**
 * Platform administration contracts.
 *
 * Boundary declared by this module: it holds the vocabulary and the pure
 * guards used by the existing administration operations, and nothing else. It
 * introduces no new administrative operation and no endpoint; the deny-by-default
 * behavior of the existing flows is preserved exactly.
 *
 * There is no `super_admin` role anywhere in the repository: the global
 * administrator is a row of the `administradores` table with `ativo = true` and a
 * matching authenticated identity (`functions/_shared/auth.ts:47-52`).
 * The branded ids below exist because that distinction is load bearing: the
 * caller's identity comes from the token and never from the request body
 * (`manage-admin/index.ts:146-149`, proven by
 * `manage-admin/index.test.ts:152-186`).
 *
 * [PENDENTE] RBAC for the internal profile of a SyncVet team beyond
 * "administrador": `syncvet-delete-equipe/index.ts:79-80` documents the absence of
 * such a rule, so only the company scope is modeled here.
 * [PENDENTE] persistent audit trail: the administration flows only log to the
 * console; there is no audit table in the repository.
 * [PENDENTE] SaaS tenant/plan/subscription model: no table, route or type
 * exists, so nothing about plans or billing is modeled.
 * [PENDENTE] invitations and billing operations: absent from the repository.
 */

/**
 * Row identity of a global administrator.
 */
/**
 * Row identity of a global administrator.
 */
export type GlobalAdminId = string & { readonly __brand: "GlobalAdminId" };

/**
 * Identity of an authenticated access, as proven by the token.
 */
export type AuthUserId = string & { readonly __brand: "AuthUserId" };

/**
 * A global administrator is an `administradores` row that is active and already
 * linked to an access (`_shared/auth.ts:47-52`). `ativo` is typed as the literal
 * `true` because an inactive row is not an administrator at all and must never
 * satisfy a global scope.
 */
export type GlobalAdminRecord = {
  id: GlobalAdminId;
  userId: AuthUserId | null;
  email: string;
  nome: string;
  ativo: true;
};

/**
 * Two different things are called "administrator" in this product and must not
 * be conflated:
 *
 * - `platform`: the global administrator, without any tenant
 *   (`_shared/auth.ts:47-52`);
 * - `company`: the administrator inside one company of the SyncVet module,
 *   identified by `syncvet_equipe.perfil = 'administrador'` scoped by
 *   `empresa_id` (`send-push-notification/index.ts:212-223`,
 *   `apps/web/src/lib/syncvetPerfil.ts:14-19`).
 */
export type PlatformAdminScope =
  | {
      kind: "platform";
    }
  | {
      kind: "company";
      companyId: string;
    };

/** True only for the global administrator, who has no tenant. */
export function isPlatformAdminScope(scope: PlatformAdminScope): boolean {
  return scope.kind === "platform";
}

/** True for the administrator of one company, always bound to that company. */
export function isCompanyAdminScope(scope: PlatformAdminScope): boolean {
  return scope.kind === "company";
}

/** Profiles available inside a SyncVet team (`apps/web/src/lib/syncvetPerfil.ts:7-12`). */
export const SYNCVET_PROFILES = [
  "administrador",
  "veterinario",
  "prestador_servico",
  "estagiario",
  "auxiliar",
] as const;

export type SyncVetProfile = (typeof SYNCVET_PROFILES)[number];

export function isSyncVetProfile(value: unknown): value is SyncVetProfile {
  return (
    typeof value === "string" &&
    (SYNCVET_PROFILES as readonly string[]).includes(value)
  );
}

/**
 * Full access inside the company is exclusively the "administrador" profile
 * (`apps/web/src/lib/syncvetPerfil.ts:14-19`). Every other profile, and every
 * absent or unknown value, is restricted.
 */
export function isCompanyFullAccess(
  profile: string | null | undefined,
): boolean {
  if (!profile) return false;

  return profile === "administrador";
}

/**
 * Administration of an existing global administrator accepts only these two
 * actions; anything else is rejected as an invalid action
 * (`manage-admin/index.ts:185`).
 */
export const MANAGE_ADMIN_ACTIONS = ["update", "delete"] as const;

export type ManageAdminAction = (typeof MANAGE_ADMIN_ACTIONS)[number];

export function isManageAdminAction(value: unknown): value is ManageAdminAction {
  return (
    typeof value === "string" &&
    (MANAGE_ADMIN_ACTIONS as readonly string[]).includes(value)
  );
}
