import { SyntheticUserSession, AuthorizedContext } from '../identity/context';
import { AuthCredentials, AuthResult, TokenPair } from '../identity/credentials';
import { SYNTHETIC_USERS, LAB_DEFAULT_PASSWORD } from '../fixtures/synthetic-users';
import { resolveActiveContext, ContextSelectionRequiredError } from '../selector/anti-first-match';
import { createClaimsFromContext } from '../jwt/claims';
import { signSyntheticJwt, SYNTHETIC_JWT_SECRET_LAB } from '../jwt/synthetic-jwt';
import { SessionManager } from '../session/session-manager';
import { ISessionStorage, LocalStorageSessionStorage } from '../storage/session-storage';

export class LocalAuthService {
  private sessionManager: SessionManager;
  private jwtSecret: string;
  private contextSelectionEpoch = 0;

  constructor(options?: {
    sessionManager?: SessionManager;
    storage?: ISessionStorage;
    jwtSecret?: string;
  }) {
    this.sessionManager =
      options?.sessionManager ??
      new SessionManager({
        storage: options?.storage ?? new LocalStorageSessionStorage()
      });
    this.jwtSecret = options?.jwtSecret ?? SYNTHETIC_JWT_SECRET_LAB;
  }

  public getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Realiza login sintético de laboratório offgrid.
   * Em conformidade com o ISO-004, a sessão inicial NUNCA assume contexto implícito.
   */
  public async login(credentials: AuthCredentials): Promise<AuthResult> {
    this.contextSelectionEpoch++;
    const userRecord = SYNTHETIC_USERS[credentials.email];
    if (!userRecord) {
      return {
        success: false,
        error: 'Credenciais inválidas: usuário sintético não localizado.'
      };
    }

    const expectedPassword = userRecord.password_hash;
    const providedPassword = credentials.password ?? LAB_DEFAULT_PASSWORD;
    if (providedPassword !== expectedPassword) {
      return {
        success: false,
        error: 'Credenciais inválidas: senha incorreta.'
      };
    }

    const profileMemberships = userRecord.memberships.filter(m => m.profile_id === userRecord.primary_profile);
    if (profileMemberships.length !== userRecord.memberships.length) {
      return { success: false, error: 'A conta de laboratório contém vínculos de mais de um perfil.' };
    }

    const activeMemberships = profileMemberships.filter(m => m.is_active);
    if (activeMemberships.length === 0) {
      return {
        success: false,
        error: 'ACESSO_NEGADO_403: Usuário não possui nenhum vínculo ativo ou permissão foi revogada.'
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 86400 * 1000); // 24h

    const session: SyntheticUserSession = {
      session_id: `sess-${userRecord.user_id}-${Date.now()}`,
      user_id: userRecord.user_id,
      user_name: userRecord.name,
      user_email: userRecord.email,
      profile_id: userRecord.primary_profile,
      memberships: profileMemberships,
      active_context: null, // NULO até escolha consciente (ISO-004)
      issued_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      device_id: credentials.device_id ?? userRecord.device_id
    };

    this.sessionManager.setSession(session, null);

    return {
      success: true,
      session,
      requires_context_selection: true,
      available_memberships: activeMemberships
    };
  }

  /**
   * Seleção explícita de contexto (fazenda/perfil) pelo operador (ISO-004).
   */
  public async selectContext(membershipId: string): Promise<AuthResult> {
    const selectionEpoch = ++this.contextSelectionEpoch;
    const currentSession = this.sessionManager.getSession();
    if (!currentSession) {
      return {
        success: false,
        error: 'Nenhuma sessão autenticada para selecionar contexto.'
      };
    }
    const expiresAt = Date.parse(currentSession.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      this.logout();
      return { success: false, error: 'Sessão expirada. Autentique-se novamente.' };
    }

    const membership = currentSession.memberships.find(item => item.membership_id === membershipId);
    if (!membership || membership.profile_id !== currentSession.profile_id || currentSession.memberships.some(item => item.profile_id !== currentSession.profile_id)) {
      return { success: false, error: 'Vínculo incompatível com o perfil único desta conta.' };
    }
    let authorizedContext: AuthorizedContext;
    try {
      authorizedContext = resolveActiveContext(currentSession, membershipId);
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }

    const claims = createClaimsFromContext(currentSession, authorizedContext, 86400);
    const accessToken = await signSyntheticJwt(claims, this.jwtSecret);
    if (selectionEpoch !== this.contextSelectionEpoch ||
        this.sessionManager.getSession()?.session_id !== currentSession.session_id) {
      return { success: false, error: 'A sessão mudou durante a seleção do contexto. Selecione novamente.' };
    }
    const refreshToken = `ref-${currentSession.user_id}-${authorizedContext.context_id}-${Date.now()}`;

    const tokens: TokenPair = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 86400
    };

    this.sessionManager.setActiveContext(authorizedContext);
    this.sessionManager.setTokens(tokens);

    return {
      success: true,
      session: this.sessionManager.getSession()!,
      tokens,
      requires_context_selection: false
    };
  }

  /**
   * Renovação offgrid de tokens para o contexto já ativo.
   */
  public async refreshSession(): Promise<AuthResult> {
    const session = this.sessionManager.getSession();
    const context = this.sessionManager.getActiveContext();

    if (!session || !context) {
      return {
        success: false,
        error: 'Sessão ou contexto ativo inexistente para renovação.'
      };
    }

    const claims = createClaimsFromContext(session, context, 86400);
    const accessToken = await signSyntheticJwt(claims, this.jwtSecret);
    const refreshToken = `ref-${session.user_id}-${context.context_id}-${Date.now()}`;

    const tokens: TokenPair = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 86400
    };

    this.sessionManager.setTokens(tokens);

    return {
      success: true,
      session,
      tokens
    };
  }

  /**
   * Troca consciente de contexto para usuários com múltiplos vínculos.
   */
  public async switchContext(newMembershipId: string): Promise<AuthResult> {
    return await this.selectContext(newMembershipId);
  }

  /**
   * Encerramento de sessão local e limpeza da partição ativa.
   */
  public logout(): void {
    this.contextSelectionEpoch++;
    this.sessionManager.clearSession();
  }
}
