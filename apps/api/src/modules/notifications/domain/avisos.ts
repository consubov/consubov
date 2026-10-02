/**
 * Segmentação dos avisos por módulo. 'geral' aparece para todos; os demais só
 * para os usuários do módulo. Regra extraída sem alteração de
 * apps/web/src/lib/avisosModulo.ts:5-30.
 */

export type ModuloAviso = "consubov" | "relatto" | "mais_arrobas" | "geral";

export type ModuloAvisoProprio = Exclude<ModuloAviso, "geral">;

export const MODULOS_AVISO: ReadonlyArray<{
  readonly value: ModuloAviso;
  readonly label: string;
}> = [
  { value: "geral", label: "Geral (todos os usuários)" },
  { value: "consubov", label: "Consubov (Admin, Gerente, Capataz)" },
  { value: "relatto", label: "Relatto (Consultor)" },
  { value: "mais_arrobas", label: "Mais Arrobas (Pecuarista, Pesador)" },
];

/** Módulos visíveis para o usuário de um determinado módulo. */
export function modulosVisiveis(
  modulo: ModuloAvisoProprio,
): ModuloAviso[] {
  return ["geral", modulo];
}

/**
 * Papel do usuário para o módulo de avisos. Papéis não mapeados — e papel
 * ausente — caem em "consubov", como no legado.
 */
export function moduloDoAviso(role?: string | null): ModuloAvisoProprio {
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
