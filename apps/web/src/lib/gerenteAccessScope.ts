/**
 * A saved farm filter never authorizes a new read. Only server-confirmed
 * memberships for the active role may select the farm used by dashboard hooks.
 */
export type GerenteFazenda = { id: string; nome: string };

export function resolveGerenteAccessScope(
  roleId: string | null,
  verifiedRoleId: string | null,
  vinculadas: readonly GerenteFazenda[],
  requestedFazendaId: string | null,
): { fazendasAutorizadas: readonly GerenteFazenda[]; activeFazendaId: string } {
  const fazendasAutorizadas =
    roleId && verifiedRoleId === roleId ? vinculadas : [];
  const activeFazendaId = fazendasAutorizadas.some(({ id }) => id === requestedFazendaId)
    ? requestedFazendaId ?? ""
    : fazendasAutorizadas[0]?.id ?? "";
  return { fazendasAutorizadas, activeFazendaId };
}

/** Optional source failures cannot block a confirmed manager farm. */
export function gerenteBlockingReadError(
  painelError: string | null,
  fazendasError: string | null,
  verifiedRoleId: string | null,
  activeRoleId: string | null,
): string | null {
  return painelError || (fazendasError && verifiedRoleId !== activeRoleId ? fazendasError : null);
}
