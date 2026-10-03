export type UserProfile =
  | "administrador"
  | "gerente"
  | "capataz"
  | "escritório"
  | "operador de fábrica"
  | "consultor"
  | "pesador"
  | "pecuarista"
  | "SyncVet legado";

export type Resource =
  | "usuários"
  | "fazendas"
  | "retiros"
  | "pastos"
  | "produtos/dietas"
  | "operações"
  | "relatórios"
  | "estoque"
  | "visitas"
  | "fábrica"
  | "pesagens"
  | "administração SaaS";

export type Permission = "ALLOW" | "DENY" | "PENDENTE" | "N/A";

const pendingPermissions = (): Record<Resource, Permission> => ({
  usuários: "PENDENTE",
  fazendas: "PENDENTE",
  retiros: "PENDENTE",
  pastos: "PENDENTE",
  "produtos/dietas": "PENDENTE",
  operações: "PENDENTE",
  relatórios: "PENDENTE",
  estoque: "PENDENTE",
  visitas: "PENDENTE",
  fábrica: "PENDENTE",
  pesagens: "PENDENTE",
  "administração SaaS": "PENDENTE",
});

/**
 * Evidence-first RBAC matrix.
 *
 * A cell stays PENDENTE until the exact profile/resource rule is supported by
 * an approved product decision or server-side behavioral evidence. Frontend
 * visibility and redirects are not authorization evidence.
 */
export const RBAC_MATRIX: Record<UserProfile, Record<Resource, Permission>> = {
  administrador: pendingPermissions(),
  gerente: pendingPermissions(),
  capataz: pendingPermissions(),
  escritório: pendingPermissions(),
  "operador de fábrica": pendingPermissions(),
  consultor: pendingPermissions(),
  pesador: pendingPermissions(),
  pecuarista: pendingPermissions(),
  "SyncVet legado": pendingPermissions(),
};

export function checkPermission(profile: UserProfile, resource: Resource): Permission {
  return RBAC_MATRIX[profile][resource];
}
