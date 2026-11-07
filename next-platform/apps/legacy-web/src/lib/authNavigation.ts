import type { UserRole } from "@/hooks/useAuth";

export const ROLE_HOME_PATHS = {
  administrador: "/admin",
  gerente: "/gerente",
  capataz: "/capataz",
  escritorio: "/escritorio",
  operador_fabrica: "/fabrica",
  consultor: "/consultor",
  pesador: "/pesador",
  pecuarista: "/pecuarista",
  syncvet: "/syncvet",
} as const satisfies Record<Exclude<UserRole, null>, string>;

export function getRoleHomePath(role: UserRole): string | null {
  if (!role) return null;
  return ROLE_HOME_PATHS[role];
}
