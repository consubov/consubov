/**
 * Segmentação dos avisos/notificações por módulo.
 * 'geral' aparece para todos; os demais só para usuários do módulo.
 */
export type ModuloAviso = "consubov" | "relatto" | "mais_arrobas" | "geral";

export const MODULOS_AVISO: { value: ModuloAviso; label: string }[] = [
  { value: "geral", label: "Geral (todos os usuários)" },
  { value: "consubov", label: "Consubov (Admin, Gerente, Capataz)" },
  { value: "relatto", label: "Relatto (Consultor)" },
  { value: "mais_arrobas", label: "Mais Arrobas (Pecuarista, Pesador)" },
];

/** Módulos que o usuário de um determinado módulo pode ver. */
export function modulosVisiveis(modulo: Exclude<ModuloAviso, "geral">): ModuloAviso[] {
  return ["geral", modulo];
}

/** Mapeia o papel do usuário para o módulo de avisos correspondente. */
export function moduloDoRole(role?: string | null): Exclude<ModuloAviso, "geral"> {
  switch (role) {
    case "consultor":
      return "relatto";
    case "pecuarista":
    case "pesador":
      return "mais_arrobas";
    default:
      return "consubov";
  }
}
