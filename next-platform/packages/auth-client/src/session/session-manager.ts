import { SyntheticUserSession, AuthorizedContext } from '../identity/context';

export class SessionManager {
  private currentSession: SyntheticUserSession | null = null;
  private listeners = new Set<(session: SyntheticUserSession | null) => void>();

  constructor(initialSession?: SyntheticUserSession) {
    if (initialSession) {
      this.currentSession = initialSession;
    }
  }

  public getSession(): SyntheticUserSession | null {
    return this.currentSession;
  }

  public getActiveContext(): AuthorizedContext | null {
    return this.currentSession?.active_context ?? null;
  }

  public setSession(session: SyntheticUserSession | null): void {
    this.currentSession = session;
    this.notify();
  }

  public setActiveContext(context: AuthorizedContext): void {
    if (!this.currentSession) {
      throw new Error('Nenhuma sessão ativa para vincular contexto.');
    }
    this.currentSession = {
      ...this.currentSession,
      active_context: context
    };
    this.notify();
  }

  public clearSession(): void {
    this.currentSession = null;
    this.notify();
  }

  public getPartitionKey(): string {
    const ctx = this.getActiveContext();
    if (!ctx || !this.currentSession) {
      return 'unauthenticated';
    }
    return `${ctx.tenant_id}::${this.currentSession.user_id}::${ctx.fazenda_id}::${ctx.profile_id}`;
  }

  public subscribe(listener: (session: SyntheticUserSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.currentSession));
  }
}
