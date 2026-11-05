import { ProductId, UserProfileId, AtomicCommandEnvelope } from '@consubov/contracts';
import { AuthorizedContext, SyntheticUserSession } from '../identity/context';

export interface SyntheticJwtClaims {
  // RFC 7519 Standard Claims
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;

  // Identidade do Usuário
  user_id: string;
  email: string;
  name: string;

  // Contexto Multi-Tenant e Territorial
  tenant_id: string;
  fazenda_id: string;
  retiro_id: string | null;
  product_id: ProductId;
  device_id: string;
  session_id: string;

  // Autorização e RBAC
  profile_id: UserProfileId;
  roles: readonly string[];
  permissions: readonly string[];
}

/**
 * Constrói claims completas a partir da sessão e do contexto autorizado consciente.
 */
export function createClaimsFromContext(
  session: SyntheticUserSession,
  context: AuthorizedContext,
  expiresInSeconds: number = 86400
): SyntheticJwtClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: session.user_id,
    iss: 'consubov:auth:local',
    aud: 'consubov:platform:api',
    iat: now,
    exp: now + expiresInSeconds,
    user_id: session.user_id,
    email: session.user_email,
    name: session.user_name,
    tenant_id: context.tenant_id,
    fazenda_id: context.fazenda_id,
    retiro_id: context.retiro_id,
    product_id: context.product_id,
    device_id: session.device_id,
    session_id: session.session_id,
    profile_id: context.profile_id,
    roles: [context.profile_id],
    permissions: context.capabilities
  };
}

/**
 * Valida se as claims do JWT conferem com o contexto ativo selecionado.
 */
export function validateClaimsAgainstContext(
  claims: SyntheticJwtClaims,
  context: AuthorizedContext
): boolean {
  if (claims.tenant_id !== context.tenant_id) return false;
  if (claims.fazenda_id !== context.fazenda_id) return false;
  if (claims.profile_id !== context.profile_id) return false;
  if (claims.product_id !== context.product_id) return false;
  return true;
}

export interface CommandAuthorizationResult {
  authorized: boolean;
  errorCode?: 'UNAUTHORIZED' | 'CONTEXT_MISMATCH' | 'PROFILE_MISMATCH' | 'USER_MISMATCH' | 'FAZENDA_MISMATCH' | 'FORBIDDEN_COMMAND';
  reason?: string;
}

/**
 * Guard anti-spoofing em tempo de execução:
 * Compara o Bearer Token autenticado (claims) com o envelope submetido.
 */
export function assertCommandAuthorization(
  claims: SyntheticJwtClaims,
  envelope: AtomicCommandEnvelope<any>
): CommandAuthorizationResult {
  if (claims.tenant_id !== envelope.tenant_id) {
    return {
      authorized: false,
      errorCode: 'CONTEXT_MISMATCH',
      reason: `Violação anti-spoofing multi-tenant: tenant_id do token (${claims.tenant_id}) diverge do envelope (${envelope.tenant_id})`
    };
  }

  if (claims.user_id !== envelope.user_id) {
    return {
      authorized: false,
      errorCode: 'USER_MISMATCH',
      reason: `Violação anti-spoofing de usuário: user_id do token (${claims.user_id}) diverge do envelope (${envelope.user_id})`
    };
  }

  // Administrador pode atuar no escopo global sem fazenda_id obrigatória
  if (claims.profile_id !== 'administrador') {
    if (claims.fazenda_id !== envelope.fazenda_id) {
      return {
        authorized: false,
        errorCode: 'FAZENDA_MISMATCH',
        reason: `Violação anti-spoofing territorial: fazenda_id do token (${claims.fazenda_id}) diverge do envelope (${envelope.fazenda_id})`
      };
    }
  }

  if (claims.profile_id !== envelope.profile_id) {
    return {
      authorized: false,
      errorCode: 'PROFILE_MISMATCH',
      reason: `Violação anti-spoofing de perfil: profile_id do token (${claims.profile_id}) diverge do envelope (${envelope.profile_id})`
    };
  }

  return { authorized: true };
}
