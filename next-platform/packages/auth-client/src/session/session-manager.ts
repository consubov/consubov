import { SyntheticUserSession, AuthorizedContext } from '../identity/context';
import { TokenPair } from '../identity/credentials';
import { ISessionStorage, InMemorySessionStorage } from '../storage/session-storage';
import { buildPartitionKey } from '../storage/partition';

export class SessionManager {
  private currentSession: SyntheticUserSession | null = null;
  private currentTokens: TokenPair | null = null;
  private storage: ISessionStorage;
  private listeners = new Set<(session: SyntheticUserSession | null) => void>();

  constructor(options?: {
    initialSession?: SyntheticUserSession;
    initialTokens?: TokenPair;
    storage?: ISessionStorage;
  }) {
    this.storage = options?.storage ?? new InMemorySessionStorage();
    if (options?.initialSession) {
      this.currentSession = options.initialSession;
    }
    if (options?.initialTokens) {
      this.currentTokens = options.initialTokens;
    }
    if (this.currentSession) {
      this.persistToStorage();
    }
  }

  public getSession(): SyntheticUserSession | null {
    return this.currentSession;
  }

  public getTokens(): TokenPair | null {
    return this.currentTokens;
  }

  public getActiveContext(): AuthorizedContext | null {
    return this.currentSession?.active_context ?? null;
  }

  public setSession(session: SyntheticUserSession | null, tokens?: TokenPair | null): void {
    this.currentSession = session;
    if (tokens !== undefined) {
      this.currentTokens = tokens;
    }
    this.persistToStorage();
    this.notify();
  }

  public setTokens(tokens: TokenPair | null): void {
    this.currentTokens = tokens;
    this.persistToStorage();
  }

  public setActiveContext(context: AuthorizedContext): void {
    if (!this.currentSession) {
      throw new Error('Nenhuma sessão ativa para vincular contexto.');
    }
    this.currentSession = {
      ...this.currentSession,
      active_context: context
    };
    this.persistToStorage();
    this.notify();
  }

  public clearSession(): void {
    const key = this.getPartitionKey();
    if (key !== 'unauthenticated') {
      this.storage.removeItem(key);
    }
    this.currentSession = null;
    this.currentTokens = null;
    this.notify();
  }

  public getPartitionKey(): string {
    const ctx = this.getActiveContext();
    if (!ctx || !this.currentSession) {
      return 'unauthenticated';
    }
    return buildPartitionKey(
      ctx.tenant_id,
      this.currentSession.user_id,
      ctx.fazenda_id,
      ctx.profile_id
    );
  }

  public subscribe(listener: (session: SyntheticUserSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persistToStorage(): void {
    if (!this.currentSession) return;
    const partitionKey = this.getPartitionKey();
    this.storage.setItem(partitionKey, {
      session: this.currentSession,
      tokens: this.currentTokens,
      partitionKey,
      storedAt: new Date().toISOString()
    });
  }

  public restoreFromStorage(partitionKey: string): boolean {
    const stored = this.storage.getItem(partitionKey);
    if (!stored) return false;
    this.currentSession = stored.session;
    this.currentTokens = stored.tokens;
    this.notify();
    return true;
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.currentSession));
  }
}
