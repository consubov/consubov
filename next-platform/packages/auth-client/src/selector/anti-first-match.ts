import { AuthorizedContext, MembershipRecord, SyntheticUserSession } from '../identity/context';
import { getCapabilitiesForProfile } from '../rbac/capabilities';

export class ContextSelectionRequiredError extends Error {
  constructor(public readonly availableMemberships: readonly MembershipRecord[]) {
    super('SELEÇÃO_EXPLÍCITA_OBRIGATÓRIA: Usuário possui múltiplos vínculos ou nenhum contexto ativo.');
    this.name = 'ContextSelectionRequiredError';
  }
}

export class UnauthorizedContextError extends Error {
  constructor(message: string) {
    super(`ACESSO_NEGADO_403: ${message}`);
    this.name = 'UnauthorizedContextError';
  }
}

/**
 * Garante que NUNCA haja seleção implícita pelo índice [0] (ISO-004).
 */
export function resolveActiveContext(
  session: SyntheticUserSession,
  chosenMembershipId?: string
): AuthorizedContext {
  const activeMemberships = session.memberships.filter(m => m.is_active);

  if (activeMemberships.length === 0) {
    throw new UnauthorizedContextError('Usuário não possui nenhum vínculo ativo no sistema.');
  }

  // Se o contexto já estiver selecionado e for válido, mantém
  if (!chosenMembershipId && session.active_context) {
    const stillValid = activeMemberships.some(
      m => m.tenant_id === session.active_context?.tenant_id &&
           m.fazenda_id === session.active_context?.fazenda_id &&
           m.profile_id === session.active_context?.profile_id
    );
    if (stillValid) return session.active_context;
  }

  // Sem escolha explícita, bloqueia imediatamente
  if (!chosenMembershipId) {
    throw new ContextSelectionRequiredError(activeMemberships);
  }

  const selected = activeMemberships.find(m => m.membership_id === chosenMembershipId);
  if (!selected) {
    throw new UnauthorizedContextError('O vínculo selecionado não pertence ao usuário ou foi revogado.');
  }

  return {
    context_id: `${selected.tenant_id}:${selected.fazenda_id}:${selected.profile_id}`,
    tenant_id: selected.tenant_id,
    tenant_nome: selected.tenant_nome,
    product_id: 'consubov',
    fazenda_id: selected.fazenda_id,
    fazenda_nome: selected.fazenda_nome,
    retiro_id: selected.retiro_id,
    retiro_nome: selected.retiro_nome,
    profile_id: selected.profile_id,
    capabilities: getCapabilitiesForProfile(selected.profile_id)
  };
}
