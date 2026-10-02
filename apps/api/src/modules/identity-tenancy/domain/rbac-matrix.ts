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

export const RBAC_MATRIX: Record<UserProfile, Record<Resource, Permission>> = {
  administrador: {
    usuários: "ALLOW",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "ALLOW",
    pesagens: "ALLOW",
    "administração SaaS": "ALLOW",
  },
  gerente: {
    usuários: "PENDENTE",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "ALLOW",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  capataz: {
    usuários: "DENY",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "PENDENTE",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "PENDENTE",
    visitas: "ALLOW",
    fábrica: "DENY",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  escritório: {
    usuários: "PENDENTE",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "PENDENTE",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  "operador de fábrica": {
    usuários: "DENY",
    fazendas: "N/A",
    retiros: "N/A",
    pastos: "N/A",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "DENY",
    fábrica: "ALLOW",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  consultor: {
    usuários: "DENY",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "ALLOW",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  pesador: {
    usuários: "DENY",
    fazendas: "N/A",
    retiros: "N/A",
    pastos: "N/A",
    "produtos/dietas": "N/A",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "N/A",
    visitas: "DENY",
    fábrica: "N/A",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  pecuarista: {
    usuários: "PENDENTE",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "ALLOW",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
  "SyncVet legado": {
    usuários: "DENY",
    fazendas: "ALLOW",
    retiros: "ALLOW",
    pastos: "ALLOW",
    "produtos/dietas": "ALLOW",
    operações: "ALLOW",
    relatórios: "ALLOW",
    estoque: "ALLOW",
    visitas: "ALLOW",
    fábrica: "DENY",
    pesagens: "ALLOW",
    "administração SaaS": "DENY",
  },
};

export function checkPermission(profile: UserProfile, resource: Resource): Permission {
  return RBAC_MATRIX[profile][resource];
}
