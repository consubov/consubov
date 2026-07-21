// Perfis de acesso do módulo SyncVet.
// Full access: administrador da empresa e médico veterinário.
// Restricted: prestador de serviço, estagiário, auxiliar — enxergam apenas
// a "Minha Agenda" (com filtragem por responsavel_id = próprio usuário) e o
// registro de trajetos do dia.
export type SyncvetPerfil =
  | "administrador"
  | "veterinario"
  | "prestador_servico"
  | "estagiario"
  | "auxiliar";

const FULL_ACCESS = new Set<SyncvetPerfil>(["administrador", "veterinario"]);

export function isSyncvetFullAccess(perfil: string | null | undefined): boolean {
  if (!perfil) return false;
  return FULL_ACCESS.has(perfil as SyncvetPerfil);
}

// Rotas (relativas a /syncvet) permitidas para perfis restritos.
export const SYNCVET_RESTRICTED_ALLOWED_PATHS = [
  "/syncvet/agenda",
  "/syncvet/trajetos",
];

export function isSyncvetRestrictedPathAllowed(pathname: string): boolean {
  return SYNCVET_RESTRICTED_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
