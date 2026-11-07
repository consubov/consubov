// Perfis de acesso do módulo SyncVet.
// Full access: SOMENTE administrador da empresa.
// Restricted: veterinário (não-admin), prestador de serviço, estagiário, auxiliar —
// enxergam apenas o "Meu Painel", "Minha Agenda", Trajetos, Fazendas (leitura),
// Partos e Preferências. NÃO enxergam Painel do Admin, Financeiro, Medicamentos,
// Sêmen, Protocolos, Equipe nem Empresa.
export type SyncvetPerfil =
  | "administrador"
  | "veterinario"
  | "prestador_servico"
  | "estagiario"
  | "auxiliar";

const FULL_ACCESS = new Set<SyncvetPerfil>(["administrador"]);

export function isSyncvetFullAccess(perfil: string | null | undefined): boolean {
  if (!perfil) return false;
  return FULL_ACCESS.has(perfil as SyncvetPerfil);
}

// Rotas (relativas a /syncvet) permitidas para perfis restritos.
export const SYNCVET_RESTRICTED_ALLOWED_PATHS = [
  "/syncvet/meu-painel",
  "/syncvet/agenda",
  "/syncvet/trajetos",
  "/syncvet/partos",
  "/syncvet/fazendas",
  "/syncvet/preferencias",
];

export function isSyncvetRestrictedPathAllowed(pathname: string): boolean {
  return SYNCVET_RESTRICTED_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
